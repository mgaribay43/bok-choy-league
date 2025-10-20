import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";

if (!admin.apps.length) admin.initializeApp();

const FIRESTORE = admin.firestore();

// Helper to build scoring map from Yahoo settings (same logic as client)
function buildScoringMap(settingsJson: any) {
  const league = settingsJson?.fantasy_content?.league;
  const settings = league?.[1]?.settings?.[0] || {};
  const modifiers = settings?.stat_modifiers?.stats || [];
  const categories = settings?.stat_categories?.stats || [];
  const map: Record<string, number> = {};
  modifiers.forEach((s: any) => {
    const id = String(s?.stat?.stat_id ?? "");
    const val = parseFloat(s?.stat?.value ?? "0");
    if (id) map[id] = val;
  });
  categories.forEach((s: any) => {
    const id = String(s?.stat?.stat_id ?? "");
    const val = parseFloat(s?.stat?.points ?? "0");
    if (id && !(id in map) && Number.isFinite(val)) map[id] = val;
  });
  return map;
}

function calcFanPts(statsArray: any[], scoringMap: Record<string, number>) {
  return Array.isArray(statsArray)
    ? statsArray.reduce((total, s) => {
        const id = String(s?.stat?.stat_id ?? "");
        if (!(id in scoringMap)) return total;
        const val = parseFloat(s?.stat?.value ?? "0");
        const mult = scoringMap[id];
        return Number.isFinite(val) && Number.isFinite(mult) ? total + val * mult : total;
      }, 0)
    : 0;
}

async function fetchNFLGamesForWeek(week: number, year: number) {
  const res = await fetch(
    `https://us-central1-bokchoyleague.cloudfunctions.net/nflMatchups?week=${week}&year=${year}`
  );
  if (!res.ok) {
    functions.logger.error("NFL Matchups fetch failed", { status: res.status });
    return {};
  }
  const data = await res.json();
  const games: Record<string, any> = {};

  const norm = (s: string) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

  (data?.data?.games || []).forEach((game: any) => {
    const home = game.homeTeam || {};
    const away = game.awayTeam || {};

    const homeAbb = (home.abbreviation || "").toString().toUpperCase();
    const awayAbb = (away.abbreviation || "").toString().toUpperCase();
    const homeFull = (home.fullName || home.name || "").toString();
    const awayFull = (away.fullName || away.name || "").toString();

    // Primary canonical keys
    if (homeAbb) games[homeAbb] = game;
    if (awayAbb) games[awayAbb] = game;

    // Additional normalized lookups (lowercase, stripped)
    if (homeAbb) games[homeAbb.toLowerCase()] = game;
    if (awayAbb) games[awayAbb.toLowerCase()] = game;
    const hNorm = norm(homeFull);
    const aNorm = norm(awayFull);
    if (hNorm) games[hNorm] = game;
    if (aNorm) games[aNorm] = game;

    // also add short tokens from full name (helps match "Patriots DEF" etc.)
    (homeFull.match(/\w+/g) || []).slice(0, 3).forEach((tok: string) => {
      const k = norm(tok);
      if (k) games[k] = game;
    });
    (awayFull.match(/\w+/g) || []).slice(0, 3).forEach((tok: string) => {
      const k = norm(tok);
      if (k) games[k] = game;
    });
  });

  // DEBUG: log keys so we can inspect what the function received and how it's indexed
  try {
    functions.logger.log("NFL games map built", {
      week,
      year,
      keysSample: Object.keys(games).slice(0, 200),
      count: Object.keys(games).length,
    });
  } catch (e) {
    functions.logger.warn("Failed to log nflGamesMap sample", { err: String(e) });
  }

  return games;
}

// Improved lookup that handles defense/team-name cases and the expanded keys.
// Tries many normalized forms to find the appropriate game.
function getNflGameForPlayerTeam(
  nflGames: Record<string, any>,
  yahooAbbr?: string | null,
  fallbackTeamName?: string | null
) {
  if (!nflGames) return null;

  const raw = (yahooAbbr || "").toString().trim();
  const cleanAbb = raw.replace(/\s+DEF$/i, "").replace(/\./g, "").toUpperCase();
  const cleanedLower = cleanAbb.toLowerCase();

  // direct lookup attempts
  const tryKeys = new Set<string>();
  if (cleanAbb) tryKeys.add(cleanAbb);
  if (cleanedLower) tryKeys.add(cleanedLower);
  if (yahooAbbr) tryKeys.add(yahooAbbr.toString());
  if (yahooAbbr) tryKeys.add(yahooAbbr.toString().toLowerCase());

  const norm = (s: any) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (fallbackTeamName) {
    const fb = norm(fallbackTeamName);
    if (fb) tryKeys.add(fb);
    // also add first tokens of fallback name
    (fallbackTeamName.match(/\w+/g) || []).slice(0, 3).forEach((tok: string) => tryKeys.add(norm(tok)));
  }

  // try mapped yahoo -> nfl abbr (keep mapping minimal here; server function may have more)
  const YAHOO_TO_NFL_ABBR: Record<string, string> = {
    WAS: "WSH",
    JAC: "JAX",
  };
  if (cleanAbb) {
    const mapped = YAHOO_TO_NFL_ABBR[cleanAbb] || cleanAbb;
    tryKeys.add(mapped);
    tryKeys.add(mapped.toLowerCase());
  }

  // attempt all candidate keys
  for (const k of Array.from(tryKeys)) {
    if (!k) continue;
    if (nflGames[k]) return nflGames[k];
  }

  // as last resort, try partial matching against home/away full names and abbreviations
  const needle = norm(cleanAbb || fallbackTeamName || "");
  if (needle) {
    for (const key of Object.keys(nflGames)) {
      const g = nflGames[key];
      const homeAbb = norm(g?.homeTeam?.abbreviation || "");
      const awayAbb = norm(g?.awayTeam?.abbreviation || "");
      const homeName = norm(g?.homeTeam?.fullName || g?.homeTeam?.name || "");
      const awayName = norm(g?.awayTeam?.fullName || g?.awayTeam?.name || "");

      if (homeAbb === needle || awayAbb === needle) return g;
      if (homeName.includes(needle) || awayName.includes(needle)) return g;
      if (needle.includes(homeAbb) || needle.includes(awayAbb)) return g;
    }
  }

  return null;
}

async function fetchAllStarters(season: string, week: number) {
  // Fetch league settings to determine team count
  const settingsRes = await fetch(
    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
  );
  const settingsJson = await settingsRes.json();
  const league = settingsJson?.fantasy_content?.league;
  const teamCount = Number(league?.[0]?.num_teams || 12);

  const allStarters: {
    teamId: string;
    teamName: string;
    managerName: string;
    teamLogo: string;
    starters: any[];
  }[] = [];

  for (let teamId = 1; teamId <= teamCount; teamId++) {
    try {
      const rosterRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${season}&teamId=${teamId}&week=${week}`
      );
      const json = await rosterRes.json();
      const team = json.fantasy_content?.team?.[0] || {};
      const roster = json.fantasy_content?.team?.[1]?.roster;

      const teamName = team.find?.((item: any) => item.name)?.name || `Team ${teamId}`;
      const teamLogo = team.find?.((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url || "";
      const managerObj = team.find?.((item: any) => item.managers)?.managers?.[0]?.manager;
      const managerName = managerObj?.nickname || "";

      const playersObj = roster?.["0"]?.players || {};
      const starters = Object.values(playersObj || {})
        .map((obj: any) => {
          const playerData = obj?.player;
          if (!playerData) return null;
          const metaArray = playerData[0];
          const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";
          return {
            playerKey: getVal("player_key"),
            id: getVal("player_id"),
            name: getVal("name")?.full || "",
            position: getVal("display_position"),
            team: getVal("editorial_team_abbr"),
            headshotUrl: getVal("headshot")?.url || "",
            selectedPosition: playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "",
          };
        })
        .filter((p: any) => p && p.selectedPosition !== "BN" && p.selectedPosition !== "IR");

      allStarters.push({
        teamId: String(teamId),
        teamName,
        managerName,
        teamLogo,
        starters,
      });
    } catch (e) {
      functions.logger.warn("Failed to fetch roster for team", { teamId, err: String(e) });
    }
  }

  return allStarters;
}

async function fetchPlayerPoints(season: string, week: number, playerKeys: string[], scoringMap: Record<string, number>) {
  if (!playerKeys.length) return {};
  const statsMap: Record<string, number> = {};
  const batchSize = 25;
  for (let i = 0; i < playerKeys.length; i += batchSize) {
    const batchKeys = playerKeys.slice(i, i + batchSize);
    const keysParam = batchKeys.join(",");
    try {
      const statsRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${season}&week=${week}&playerKeys=${keysParam}`
      );
      const statsJson = await statsRes.json();

      batchKeys.forEach((key) => {
        statsMap[key] = 0;
      });

      Object.values(statsJson?.fantasy_content?.players || {}).forEach((playerWrapper: any) => {
        const pArr = playerWrapper?.player;
        if (!pArr) return;
        const metaArray = pArr[0];
        const playerKeyObj = metaArray.find((obj: any) => obj.player_key);
        const pKey = playerKeyObj?.player_key;
        if (!pKey) return;
        const rawStats = pArr?.[1]?.player_stats?.stats ?? [];
        statsMap[pKey] = calcFanPts(rawStats, scoringMap);
      });
    } catch (e) {
      functions.logger.warn("Failed to fetch player stats batch", { err: String(e) });
      // set defaults for batch if something failed
      const batchKeys = playerKeys.slice(i, i + batchSize);
      batchKeys.forEach((key) => {
        statsMap[key] = 0;
      });
    }
  }
  return statsMap;
}

/**
 * HTTP function to run IceTracker logic on demand (useful for testing).
 * Query params:
 *  - season (optional, defaults to current year)
 *  - week (optional, attempt to infer from settings if not provided)
 */
export const iceTracker = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req: Request, res: Response) => {
    console.log("IceTracker HTTP invoked");

    // basic CORS handling for testing from browser/tools
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const season = (req.query.season as string) || new Date().getFullYear().toString();

      // get settings (also used to find current week if not provided)
      const settingsRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
      );
      const settingsJson = await settingsRes.json();

      // determine week: prefer query param, else attempt to extract from settings
      let currentWeek = req.query.week ? parseInt(String(req.query.week), 10) : NaN;
      if (!Number.isFinite(currentWeek)) {
        currentWeek = parseInt(
          (settingsJson?.fantasy_content?.league?.[0]?.current_week ||
            settingsJson?.fantasy_content?.league?.[1]?.settings?.[0]?.current_week ||
            settingsJson?.fantasy_content?.league?.[0]?.current_week_num ||
            "1"
          ).toString(),
          10
        );
      }
      if (!Number.isFinite(currentWeek) || currentWeek <= 0) currentWeek = 1;

      // fetch NFL games for the week
      const year = new Date().getFullYear();
      const nflGamesMap = await fetchNFLGamesForWeek(currentWeek, year);

      // build scoring map
      const scoringMap = buildScoringMap(settingsJson);

      // fetch all starters and points
      const allStarters = await fetchAllStarters(season, currentWeek);
      const allPlayers = allStarters.flatMap((t) =>
        t.starters.map((p) => ({
          ...p,
          teamName: t.teamName,
          managerName: t.managerName,
          teamLogo: t.teamLogo,
        }))
      );
      const playerKeys = allPlayers.map((p) => p.playerKey).filter(Boolean);

      const pointsMapResult = await fetchPlayerPoints(season, currentWeek, playerKeys, scoringMap);

      // Determine iced players (game in progress or final and pts <= 0 or undefined)
      const zeroPlayers = allPlayers.filter((p) => {
        const pts = pointsMapResult[p.playerKey];
        const game = getNflGameForPlayerTeam(nflGamesMap, p.team, p.teamName);
        if (!game) return false;
        const status = (game.status || "").toLowerCase();
        const statusDetail = (game.statusDetail || "").toLowerCase();
        const isFinal = status.includes("final") || statusDetail.includes("final");
        const isInProgress = status.includes("in progress") || statusDetail.includes("in progress");
        return (isFinal || isInProgress) && (pts <= 0 || pts === undefined);
      });

      // Write to Firestore
      const docRef = FIRESTORE.doc("iceTracker/current");
      await docRef.set(
        {
          players: zeroPlayers,
          pointsMap: pointsMapResult,
          nflGames: nflGamesMap,
          currentWeek,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          season,
        },
        { merge: true }
      );

      functions.logger.log("IceTracker write complete", { players: zeroPlayers.length });
      res.status(200).json({ success: true, count: zeroPlayers.length });
    } catch (err) {
      console.error("IceTracker HTTP error", { err: String(err) });
      res.status(500).json({ success: false, error: String(err) });
    }
  }
);