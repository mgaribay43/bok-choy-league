"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PlayerViewer from "./PlayerViewer";
import yahooDefImagesJson from "../data/yahooDefImages.json";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { WinProbChartModal } from "./WinProbabilityTracker";
import { useRouter } from "next/navigation";

type TeamInput = {
  id: string;              // Yahoo teamId
  name: string;
  logo?: string;
  record?: string;
  score: number;           // current team score
  projected?: number;      // team projected score
};

export interface MatchupDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  season: string;          // e.g. "2025"
  week: number;            // week to display
  team1: TeamInput;
  team2: TeamInput;
  winPct1?: number;        // optional: to render win bar like the card
  winPct2?: number;        // optional
  // NEW: optional recap URL (passed from MatchupsViewer)
  recapUrl?: string;
}

type PlayerRow = {
  playerKey: string;
  id: string;
  name: string;
  position: string;
  team: string;
  headshotUrl: string;
  selectedPosition: string;
  stats?: {
    fanPts?: number;
    projPts?: number;  // NEW: projected points this week
    byeWeek?: number | null;
  };
};

const yahooDefImages: Record<string, { hash: string; img: string; folder?: string; pxFolder?: string }> = yahooDefImagesJson;

// Small helpers reused from your other components
const slotColor = (slot: string) =>
  ({
    QB: "bg-gradient-to-br from-orange-800 to-orange-900",
    RB: "bg-gradient-to-br from-green-800 to-green-900",
    WR: "bg-gradient-to-br from-blue-800 to-blue-900",
    TE: "bg-gradient-to-br from-purple-800 to-purple-900",
    K: "bg-gradient-to-br from-yellow-800 to-yellow-900",
    DEF: "bg-gradient-to-br from-gray-800 to-gray-900",
    "W/R": "bg-gradient-to-br from-pink-800 to-pink-900",
    "W/R/T": "bg-gradient-to-br from-pink-800 to-pink-900", // ...support alias
    DST: "bg-gradient-to-br from-gray-800 to-gray-900",     // ...support alias
    "D/ST": "bg-gradient-to-br from-gray-800 to-gray-900",  // ...support alias
    BN: "bg-gradient-to-br from-slate-800 to-slate-900",
    IR: "bg-gradient-to-br from-red-800 to-red-900",
  }[slot] || "bg-gradient-to-br from-slate-800 to-slate-900");

// Normalize roster slot labels
function normalizeSlot(slot?: string) {
  const s = (slot || "").toUpperCase().replace(/\s+/g, "");
  if (s === "WR/RB/TE" || s === "W/R/T" || s === "WRRBTE") return "W/R";
  if (s === "DST" || s === "D/ST") return "DEF";
  return (slot || "").toUpperCase();
}

// NEW: abbreviate first name for tighter mobile rows (e.g., "J. Allen")
function abbreviateFirstName(full: string) {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Keep everything after the first token as the "last name" (handles "St. Brown", "Van Noy", hyphens, suffixes)
  const last = parts.slice(1).join(" ");
  const firstInitial = parts[0].charAt(0);
  return `${firstInitial}. ${last}`;
}

function getPlayerImageUrl(player: { position: string; team?: string; headshotUrl?: string }) {
  const fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png";
  if (player.position === "DEF") {
    let rawAbbr = player.team?.toUpperCase() || "FA";
    if (rawAbbr === "WAS") rawAbbr = "WSH";
    const defInfo = yahooDefImages[rawAbbr];
    if (defInfo) {
      if (defInfo.pxFolder) {
        return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/${defInfo.folder}/${defInfo.pxFolder}/${defInfo.img}`;
      }
      const folder = defInfo.folder || "20190724";
      return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/nfl/${folder}/500x500/${defInfo.img}`;
    }
    return fallbackUrl;
  }
  if (
    !player.headshotUrl ||
    player.headshotUrl === "/fallback-avatar.png" ||
    player.headshotUrl.includes("dh/ap/default/140828/silhouette@2x.png")
  ) {
    return fallbackUrl;
  }
  const match = player.headshotUrl.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
  if (match) return match[1];
  return player.headshotUrl.replace(/(\.png).*$/, "$1");
}

// Header bits copied to match your MatchupsViewer visuals
const AvatarBox = ({ src, alt, record }: { src?: string; alt: string; record?: string }) => {
  const cleanRecord = (record || "").replace(/[()]/g, "");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <img
        src={src || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
        alt={alt}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          objectFit: "cover",
          border: "none",
          background: "#18191b",
        }}
      />
      {!!cleanRecord && (
        <span
          style={{
            fontSize: 13,
            color: "#a7a7a7",
            fontWeight: 600,
            marginTop: 2,
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {cleanRecord}
        </span>
      )}
    </div>
  );
};

const ScoreBox = ({
  value,
  projected,
  highlight,
  align = "right",
}: {
  value: string;
  projected?: string | number;
  highlight: "win" | "lose" | "tie";
  align?: "right" | "left";
}) => (
  <div
    style={{
      fontWeight: 800,
      fontSize: "clamp(20px, 6.5vw, 36px)",
      color: highlight === "win" ? "#22c55e" : highlight === "lose" ? "#dc2626" : "#e5e7eb",
      minWidth: "clamp(52px, 16vw, 84px)",
      textAlign: align,
      display: "flex",
      flexDirection: "column",
      alignItems: align === "right" ? "flex-end" : "flex-start",
      lineHeight: 1.05,
    }}
  >
    {value}
    {projected != null && projected !== "" && (
      <span
        style={{
          fontWeight: 400,
          fontSize: "clamp(11px, 3.2vw, 13px)",
          color: "#a7a7a7",
          marginTop: 2,
          whiteSpace: "nowrap",
        }}
      >
        proj: {Number(projected).toFixed(2)}
      </span>
    )}
  </div>
);

const WinBar = ({ pct1, pct2 }: { pct1?: number; pct2?: number }) => (
  <div style={{ background: "#23252b", marginTop: 8 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontWeight: 700,
        fontSize: 16,
        padding: "0 22px",
      }}
    >
      <span style={{ color: (pct1 ?? 0) >= (pct2 ?? 0) ? "#22c55e" : "#dc2626" }}>
        {Math.round(pct1 ?? 0)}%
      </span>
      <span style={{ color: "#a7a7a7", fontWeight: 600, fontSize: 15, letterSpacing: 1 }}>
        Win %
      </span>
      <span style={{ color: (pct2 ?? 0) > (pct1 ?? 0) ? "#22c55e" : "#dc2626" }}>
        {Math.round(pct2 ?? 0)}%
      </span>
    </div>
    <div
      style={{
        position: "relative",
        height: 8,
        background: "#18191b",
        borderRadius: 8,
        margin: "10px 0 0 0",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${pct1 ?? 0}%`,
          background: (pct1 ?? 0) >= (pct2 ?? 0) ? "#6f49e0ff" : "#8b96f1ff",
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
          transition: "width 0.4s",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: `${pct2 ?? 0}%`,
          background: (pct2 ?? 0) > (pct1 ?? 0) ? "#6f49e0ff" : "#8b96f1ff",
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
          transition: "width 0.4s",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${pct1 ?? 0}%`,
          top: -1,
          height: "calc(100% + 2px)",
          width: 3,
          background: "#23252b",
          borderRadius: 2,
          zIndex: 2,
          transform: "translateX(-1.5px)",
        }}
      />
    </div>
  </div>
);

// Build scoring map and compute player fan points like in RosterViewer
async function fetchLeagueSettings(year: string) {
  try {
    const response = await fetch(
      `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${year}`
    );
    if (!response.ok) throw new Error("Failed to fetch league settings");
    return await response.json();
  } catch {
    return null;
  }
}

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
        const val = parseFloat(s?.stat?.value ?? "0");
        const mult = Number(scoringMap[id] ?? 0);
        return Number.isFinite(val) && Number.isFinite(mult) ? total + val * mult : total;
      }, 0)
    : 0;
}

// Helper: chunk an array
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Parse weekly stats response into a map keyed by player_key
function extractWeeklyStatsMap(json: any, scoringMap: Record<string, number>) {
  const map: Record<string, { fanPts: number; byeWeek: number | null }> = {};

  // Try players root
  const playersRoot = json?.fantasy_content?.players;
  if (playersRoot) {
    Object.values(playersRoot).forEach((wrapper: any) => {
      const pArr = wrapper?.player;
      if (!pArr) return;
      const metaArray = pArr[0] || [];
      const playerKeyObj = metaArray.find((o: any) => o?.player_key);
      const pKey = playerKeyObj?.player_key;
      const byeObj = metaArray.find((o: any) => "bye_weeks" in o);
      const byeWeek = byeObj?.bye_weeks?.week ? Number(byeObj.bye_weeks.week) : null;
      const rawStats = pArr?.[1]?.player_stats?.stats ?? [];
      if (pKey) map[pKey] = { byeWeek, fanPts: calcFanPts(rawStats, scoringMap) };
    });
    return map;
  }

  // Fallback: some shapes nest under league[1].players
  const leaguePlayers = json?.fantasy_content?.league?.[1]?.players;
  if (leaguePlayers) {
    Object.values(leaguePlayers).forEach((wrapper: any) => {
      const pArr = wrapper?.player;
      if (!pArr) return;
      const metaArray = pArr[0] || [];
      const playerKeyObj = metaArray.find((o: any) => o?.player_key);
      const pKey = playerKeyObj?.player_key;
      const byeObj = metaArray.find((o: any) => "bye_weeks" in o);
      const byeWeek = byeObj?.bye_weeks?.week ? Number(byeObj.bye_weeks.week) : null;
      const rawStats = pArr?.[1]?.player_stats?.stats ?? [];
      if (pKey) map[pKey] = { byeWeek, fanPts: calcFanPts(rawStats, scoringMap) };
    });
  }

  return map;
}

export default function MatchupDetails({
  isOpen,
  onClose,
  season,
  week,
  team1,
  team2,
  winPct1,
  winPct2,
  recapUrl,
}: MatchupDetailsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [players1, setPlayers1] = useState<PlayerRow[]>([]);
  const [players2, setPlayers2] = useState<PlayerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [selectedStats, setSelectedStats] = useState<any[] | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  const [chartOpen, setChartOpen] = useState(false);                 // NEW
  const [wpCount, setWpCount] = useState<number | null>(null);       // NEW
  const [chartSel, setChartSel] = useState<{
    matchupId?: string;
    team1: { name: string; logo: string | undefined };
    team2: { name: string; logo: string | undefined };
    points?: any[];
    final?: boolean;
  } | null>(null);                                                   // NEW
  const [pendingChartOpen, setPendingChartOpen] = useState(false);

  useEffect(() => {
    if (pendingChartOpen && chartSel && chartSel.points && chartSel.points.length > 0) {
      setChartOpen(true);
      setPendingChartOpen(false);
    }
  }, [pendingChartOpen, chartSel]);

  const team1Win = Number(team1.score) > Number(team2.score);
  const team2Win = Number(team2.score) > Number(team1.score);

  const starters1 = useMemo(
    () => players1.filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR"),
    [players1]
  );
  const bench1 = useMemo(() => players1.filter((p) => p.selectedPosition === "BN"), [players1]);
  const ir1 = useMemo(() => players1.filter((p) => p.selectedPosition === "IR"), [players1]);

  const starters2 = useMemo(
    () => players2.filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR"),
    [players2]
  );
  const bench2 = useMemo(() => players2.filter((p) => p.selectedPosition === "BN"), [players2]);
  const ir2 = useMemo(() => players2.filter((p) => p.selectedPosition === "IR"), [players2]);

  const total1 = useMemo(
    () =>
      starters1.reduce((sum, p) => (p.stats?.fanPts != null ? sum + Number(p.stats.fanPts) : sum), 0),
    [starters1]
  );
  const total2 = useMemo(
    () =>
      starters2.reduce((sum, p) => (p.stats?.fanPts != null ? sum + Number(p.stats.fanPts) : sum), 0),
    [starters2]
  );

  // Order to render starters like Yahoo
  const SLOT_ORDER = ["QB", "WR", "WR", "RB", "RB", "TE", "W/R", "K", "DEF"];

  // Helpers to build mobile rows
  function groupBySlot(players: PlayerRow[]) {
    const map = new Map<string, PlayerRow[]>();
    players.forEach((p) => {
      const slot = normalizeSlot(p.selectedPosition || p.position || "UTIL");
      if (!map.has(slot)) map.set(slot, []);
      map.get(slot)!.push(p);
    });
    return map;
  }

  function buildStarterRows(left: PlayerRow[], right: PlayerRow[]) {
    const leftMap = groupBySlot(left);
    const rightMap = groupBySlot(right);

    const rows: { slot: string; left?: PlayerRow; right?: PlayerRow }[] = [];
    // Separate counters per side
    const leftCounts: Record<string, number> = {};
    const rightCounts: Record<string, number> = {};

    const getNext = (
      m: Map<string, PlayerRow[]>,
      counts: Record<string, number>,
      slot: string
    ) => {
      const arr = m.get(slot) || [];
      const idx = counts[slot] || 0;
      const val = arr[idx];
      if (val) counts[slot] = idx + 1;
      return val;
    };

    // Pass 1: expected slots/quantities
    SLOT_ORDER.forEach((slot) => {
      const s = normalizeSlot(slot);
      rows.push({
        slot: s,
        left: getNext(leftMap, leftCounts, s),
        right: getNext(rightMap, rightCounts, s),
      });
    });

    // Pass 2: any remaining players (extra flex, etc.)
    const allSlots = new Set<string>([...leftMap.keys(), ...rightMap.keys()]);
    allSlots.forEach((slot) => {
      const lArr = leftMap.get(slot) || [];
      const rArr = rightMap.get(slot) || [];
      const li = leftCounts[slot] || 0;
      const ri = rightCounts[slot] || 0;
      const maxLeft = lArr.length - li;
      const maxRight = rArr.length - ri;
      const max = Math.max(maxLeft, maxRight);
      for (let i = 0; i < max; i++) {
        rows.push({
          slot,
          left: lArr[li + i],
          right: rArr[ri + i],
        });
      }
    });

    return rows;
  }

  function buildPairedRows(left: PlayerRow[], right: PlayerRow[], slotLabel: string) {
    const maxLen = Math.max(left.length, right.length);
    const rows: { slot: string; left?: PlayerRow; right?: PlayerRow }[] = [];
    const s = normalizeSlot(slotLabel);
    for (let i = 0; i < maxLen; i++) rows.push({ slot: s, left: left[i], right: right[i] });
    return rows;
  }

  // Replace your main roster/scoring effect with this version:
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    // Initial load: show spinner
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const settings = await fetchLeagueSettings(season);
        const scoringMap = buildScoringMap(settings);

        // Fetch both rosters for the week
        const [r1, r2] = await Promise.all([
          fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${season}&teamId=${team1.id}&week=${week}`
          ),
          fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${season}&teamId=${team2.id}&week=${week}`
          ),
        ]);
        if (!r1.ok || !r2.ok) throw new Error("Failed to fetch rosters");
        const [j1, j2] = [await r1.json(), await r2.json()];

        const parseRoster = (json: any): PlayerRow[] => {
          const roster = json?.fantasy_content?.team?.[1]?.roster;
          const playersObj = roster?.["0"]?.players || {};
          return Object.values(playersObj)
            .map((obj: any) => {
              const playerData = obj?.player;
              if (!playerData) return null;
              const metaArray = playerData[0];
              const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";
              const selectedPosition =
                playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "";
              const projRaw = playerData?.[1]?.player_projected_points?.total;
              const proj = projRaw != null && projRaw !== "" && !isNaN(Number(projRaw)) ? Number(projRaw) : undefined;

              return {
                playerKey: getVal("player_key"),
                id: getVal("player_id"),
                name: getVal("name")?.full || "",
                position: getVal("display_position"),
                team: getVal("editorial_team_abbr"),
                headshotUrl: getVal("headshot")?.url || "",
                selectedPosition,
                stats: { projPts: proj },
              } as PlayerRow;
            })
            .filter(Boolean) as PlayerRow[];
        };

        const parsed1 = parseRoster(j1);
        const parsed2 = parseRoster(j2);

        // Fetch weekly stats for all players (chunk to avoid 25-player limit)
        const allKeysArr = [...parsed1, ...parsed2].map((p) => p.playerKey).filter(Boolean);
        if (allKeysArr.length) {
          const CHUNK_SIZE = 24;
          const chunks = chunk(allKeysArr, CHUNK_SIZE);

          const statsMaps = await Promise.all(
            chunks.map(async (keys) => {
              const statsRes = await fetch(
                `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${season}&week=${week}&playerKeys=${keys.join(
                  ","
                )}`
              );
              if (!statsRes.ok) throw new Error("Failed to fetch player stats");
              const json = await statsRes.json();
              return extractWeeklyStatsMap(json, scoringMap);
            })
          );

          const statsMap: Record<string, { fanPts: number; byeWeek: number | null }> = {};
          for (const m of statsMaps) Object.assign(statsMap, m);

          if (!cancelled) {
            setPlayers1(
              parsed1.map((p) => ({
                ...p,
                stats: {
                  fanPts: statsMap[p.playerKey]?.fanPts ?? 0,
                  projPts: p.stats?.projPts,
                  byeWeek: statsMap[p.playerKey]?.byeWeek ?? null,
                },
              }))
            );
            setPlayers2(
              parsed2.map((p) => ({
                ...p,
                stats: {
                  fanPts: statsMap[p.playerKey]?.fanPts ?? 0,
                  projPts: p.stats?.projPts,
                  byeWeek: statsMap[p.playerKey]?.byeWeek ?? null,
                },
              }))
            );
          }
        } else if (!cancelled) {
          setPlayers1(parsed1);
          setPlayers2(parsed2);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "An error occurred");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Poll for updates every 30 seconds, but do NOT show spinner
    const pollInterval = setInterval(async () => {
      try {
        const settings = await fetchLeagueSettings(season);
        const scoringMap = buildScoringMap(settings);

        const [r1, r2] = await Promise.all([
          fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${season}&teamId=${team1.id}&week=${week}`
          ),
          fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${season}&teamId=${team2.id}&week=${week}`
          ),
        ]);
        if (!r1.ok || !r2.ok) return;
        const [j1, j2] = [await r1.json(), await r2.json()];

        const parseRoster = (json: any): PlayerRow[] => {
          const roster = json?.fantasy_content?.team?.[1]?.roster;
          const playersObj = roster?.["0"]?.players || {};
          return Object.values(playersObj)
            .map((obj: any) => {
              const playerData = obj?.player;
              if (!playerData) return null;
              const metaArray = playerData[0];
              const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";
              const selectedPosition =
                playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "";
              const projRaw = playerData?.[1]?.player_projected_points?.total;
              const proj = projRaw != null && projRaw !== "" && !isNaN(Number(projRaw)) ? Number(projRaw) : undefined;

              return {
                playerKey: getVal("player_key"),
                id: getVal("player_id"),
                name: getVal("name")?.full || "",
                position: getVal("display_position"),
                team: getVal("editorial_team_abbr"),
                headshotUrl: getVal("headshot")?.url || "",
                selectedPosition,
                stats: { projPts: proj },
              } as PlayerRow;
            })
            .filter(Boolean) as PlayerRow[];
        };

        const parsed1 = parseRoster(j1);
        const parsed2 = parseRoster(j2);

        // Fetch weekly stats for all players (chunk to avoid 25-player limit)
        const allKeysArr = [...parsed1, ...parsed2].map((p) => p.playerKey).filter(Boolean);
        if (allKeysArr.length) {
          const CHUNK_SIZE = 24;
          const chunks = chunk(allKeysArr, CHUNK_SIZE);

          const statsMaps = await Promise.all(
            chunks.map(async (keys) => {
              const statsRes = await fetch(
                `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${season}&week=${week}&playerKeys=${keys.join(
                  ","
                )}`
              );
              if (!statsRes.ok) return {};
              const json = await statsRes.json();
              return extractWeeklyStatsMap(json, scoringMap);
            })
          );

          const statsMap: Record<string, { fanPts: number; byeWeek: number | null }> = {};
          for (const m of statsMaps) Object.assign(statsMap, m);

          // Merge new stats into existing player objects, preserving old data for unchanged players
          const mergePlayers = (oldArr: PlayerRow[], newArr: PlayerRow[], statsMap: Record<string, { fanPts: number; byeWeek: number | null }>) =>
            newArr.map((newP) => {
              const oldP = oldArr.find((p) => p.playerKey === newP.playerKey);
              const fanPts = statsMap[newP.playerKey]?.fanPts ?? oldP?.stats?.fanPts ?? 0;
              const projPts = newP.stats?.projPts ?? oldP?.stats?.projPts;
              const byeWeek = statsMap[newP.playerKey]?.byeWeek ?? oldP?.stats?.byeWeek ?? null;
              return {
                ...oldP,
                ...newP,
                stats: {
                  fanPts,
                  projPts,
                  byeWeek,
                },
              };
            });

          setPlayers1((prev) => mergePlayers(prev, parsed1, statsMap));
          setPlayers2((prev) => mergePlayers(prev, parsed2, statsMap));

          // NEW: Update team1.score and team2.score for the scoreboard if changed
          const newTotal1 = parsed1
            .filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR")
            .reduce((sum, p) => statsMap[p.playerKey]?.fanPts != null ? sum + statsMap[p.playerKey].fanPts : sum, 0);

          const newTotal2 = parsed2
            .filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR")
            .reduce((sum, p) => statsMap[p.playerKey]?.fanPts != null ? sum + statsMap[p.playerKey].fanPts : sum, 0);

          // Only update if changed
          if (Number(team1.score) !== Number(newTotal1)) {
            team1.score = newTotal1;
          }
          if (Number(team2.score) !== Number(newTotal2)) {
            team2.score = newTotal2;
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [isOpen, season, week, team1.id, team2.id]);

  const openPlayer = async (p: PlayerRow) => {
    setSelectedPlayer(p);
    setSelectedStats(null);
    setLoadingPlayer(true);
    try {
      const res = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstatsyear&year=${season}&playerKeys=${p.playerKey}`
      );
      const json = await res.json();
      const playersObj = json?.fantasy_content?.league?.[1]?.players || {};
      let statsByWeek: any[] = [];
      Object.values(playersObj).forEach((playerWrapper: any) => {
        const playerArr = playerWrapper?.player;
        if (!playerArr) return;
        const keyObj = playerArr[0]?.find((o: any) => o.player_key);
        if (keyObj?.player_key === p.playerKey) {
          statsByWeek = playerArr[1]?.player_stats?.stats_by_week || [];
        }
      });
      setSelectedStats(statsByWeek || []);
    } catch {
      setSelectedStats([]);
    } finally {
      setLoadingPlayer(false);
    }
  };

  // Discover Win Prob data for this matchup (and prep selection for the chart modal)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, "WinProbabilities"));
        let match: any = null;
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (
            d.season === season &&
            d.week === week &&
            d.points?.length &&
            (
              (d.team1?.name === team1.name && d.team2?.name === team2.name) ||
              (d.team1?.name === team2.name && d.team2?.name === team1.name)
            )
          ) {
            match = d;
          }
        });

        if (cancelled) return;

        if (match) {
          setWpCount(Array.isArray(match.points) ? match.points.length : 0);
          setChartSel({
            matchupId: match.matchupId, // <-- ADD THIS LINE
            team1: match.team1,
            team2: match.team2,
            points: match.points,
            final: !!match.final,
          });
        } else {
          setWpCount(0);
          setChartSel({
            team1: { name: team1.name, logo: team1.logo },
            team2: { name: team2.name, logo: team2.logo },
          });
        }
      } catch {
        if (!cancelled) {
          setWpCount(0);
          setChartSel({
            team1: { name: team1.name, logo: team1.logo },
            team2: { name: team2.name, logo: team2.logo },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, season, week, team1.name, team1.logo, team2.name, team2.logo]);

  // Polling effect for Win Probability data
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchWinProb = async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, "WinProbabilities"));
        let match: any = null;
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (
            d.season === season &&
            d.week === week &&
            d.points?.length &&
            (
              (d.team1?.name === team1.name && d.team2?.name === team2.name) ||
              (d.team1?.name === team2.name && d.team2?.name === team1.name)
            )
          ) {
            match = d;
          }
        });

        if (cancelled) return;

        if (match) {
          setWpCount(Array.isArray(match.points) ? match.points.length : 0);
          setChartSel({
            matchupId: match.matchupId,
            team1: match.team1,
            team2: match.team2,
            points: match.points,
            final: !!match.final,
          });
        } else {
          setWpCount(0);
          setChartSel({
            team1: { name: team1.name, logo: team1.logo },
            team2: { name: team2.name, logo: team2.logo },
          });
        }
      } catch {
        if (!cancelled) {
          setWpCount(0);
          setChartSel({
            team1: { name: team1.name, logo: team1.logo },
            team2: { name: team2.name, logo: team2.logo },
          });
        }
      }
    };

    fetchWinProb();
    const interval = setInterval(fetchWinProb, 60000); // poll every minute

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, season, week, team1.name, team1.logo, team2.name, team2.logo]);

  const [headerScore1, setHeaderScore1] = useState<number>(team1.score);
  const [headerScore2, setHeaderScore2] = useState<number>(team2.score);

  // Sync header scores with roster totals whenever roster totals change
  useEffect(() => {
    setHeaderScore1(total1);
    setHeaderScore2(total2);
  }, [total1, total2]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#0f0f0f] rounded-2xl shadow-2xl w-[95vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-[#242424]">
        {/* NEW: Actions bar above header card */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-end gap-2 border-b border-[#242424] bg-[#0f0f0f]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-black/40 text-slate-200 hover:bg-black/60"
          >
            &times;
          </button>
        </div>

        {/* Header (matchup card style) */}
        <div className="p-4">
          <div
            style={{
              background: "#23252b",
              borderRadius: 16,
              padding: "14px 18px 10px 18px",
              boxShadow: "0 2px 12px 0 #000",
              border: "2px solid #232323",
            }}
          >
            {/* Names row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0 font-semibold text-slate-100 truncate">
                <span
                  style={{ cursor: "pointer", color: "#38bdf8", textDecoration: "underline" }}
                  onClick={() => router.push(`/roster?year=${season}&teamId=${team1.id}&week=${week}`)}
                  title={`View ${team1.name} roster`}
                  tabIndex={0}
                  role="link"
                >
                  {team1.name}
                </span>
              </div>
              <div className="w-3" />
              <div className="flex-1 min-w-0 font-semibold text-slate-100 text-right truncate">
                <span
                  style={{ cursor: "pointer", color: "#38bdf8", textDecoration: "underline" }}
                  onClick={() => router.push(`/roster?year=${season}&teamId=${team2.id}&week=${week}`)}
                  title={`View ${team2.name} roster`}
                  tabIndex={0}
                  role="link"
                >
                  {team2.name}
                </span>
              </div>
            </div>

            {/* Avatars + Scores */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0 0 0",
                marginBottom: 8,
                gap: 8,
              }}
            >
              <AvatarBox src={team1.logo} alt={team1.name} record={team1.record} />
              <ScoreBox
                value={Number(headerScore1).toFixed(2)}
                projected={team1.projected}
                highlight={headerScore1 > headerScore2 ? "win" : headerScore2 > headerScore1 ? "lose" : "tie"}
                align="right"
              />
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "clamp(20px, 5.5vw, 28px)",
                  color: "#6b7280",
                  margin: "0 2px",
                }}
              >
                /
              </div>
              <ScoreBox
                value={Number(headerScore2).toFixed(2)}
                projected={team2.projected}
                highlight={headerScore2 > headerScore1 ? "win" : headerScore1 > headerScore2 ? "lose" : "tie"}
                align="left"
              />
              <AvatarBox src={team2.logo} alt={team2.name} record={team2.record} />
            </div>

            <WinBar pct1={winPct1} pct2={winPct2} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-emerald-200">
              Loading rosters...
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">{error}</div>
          ) : (
            <>
              {/* Mobile: Yahoo-like 3-column table */}
              <div className="md:hidden">
                <MobileRosterTable
                  title={`${team1.name} vs ${team2.name}`}
                  leftTeam={{ name: team1.name }}
                  rightTeam={{ name: team2.name }}
                  starterRows={buildStarterRows(starters1, starters2)}
                  benchRows={buildPairedRows(bench1, bench2, "BN")}
                  irRows={buildPairedRows(ir1, ir2, "IR")}
                  onClickLeft={(p) => openPlayer(p)}
                  onClickRight={(p) => openPlayer(p)}
                />
              </div>

              {/* Desktop: keep existing two-card layout */}
              <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Team 1 */}
                <div className="bg-[#181818] rounded-xl border border-[#232323] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#232323] flex items-center justify-between">
                    <div className="font-bold text-emerald-200">{team1.name}</div>
                    <div className="text-sm text-slate-300">
                      Total: <span className="font-bold">{total1.toFixed(2)}</span>
                      {team1.projected != null && (
                        <span className="ml-2 text-slate-400">Proj: {Number(team1.projected).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <Section title="Starters">
                    {starters1.map((p) => (
                      <RosterRow key={p.playerKey} p={p} onClick={() => openPlayer(p)} />
                    ))}
                  </Section>
                  <Section title="Bench">
                    {bench1.map((p) => (
                      <RosterRow key={p.playerKey} p={p} onClick={() => openPlayer(p)} />
                    ))}
                    {ir1.length > 0 && (
                      <>
                        <div className="mt-2 mb-1 border-t border-[#232323]" />
                        <div className="px-3 py-2 text-xs font-bold text-emerald-200">IR</div>
                        {ir1.map((p) => (
                          <RosterRow key={p.playerKey} p={p} onClick={() => openPlayer(p)} />
                        ))}
                      </>
                    )}
                  </Section>
                </div>

                {/* Team 2 */}
                <div className="bg-[#181818] rounded-xl border border-[#232323] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#232323] flex items-center justify-between">
                    <div className="font-bold text-emerald-200">{team2.name}</div>
                    <div className="text-sm text-slate-300">
                      Total: <span className="font-bold">{total2.toFixed(2)}</span>
                      {team2.projected != null && (
                        <span className="ml-2 text-slate-400">Proj: {Number(team2.projected).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <Section title="Starters">
                    {starters2.map((p) => (
                      <RosterRow key={p.playerKey} p={p} onClick={() => openPlayer(p)} />
                    ))}
                  </Section>
                  <Section title="Bench">
                    {bench2.map((p) => (
                      <RosterRow key={p.playerKey} p={p} onClick={() => openPlayer(p)} />
                    ))}
                    {ir2.length > 0 && (
                      <>
                        <div className="mt-2 mb-1 border-t border-[#232323]" />
                        <div className="px-3 py-2 text-xs font-bold text-emerald-200">IR</div>
                        {ir2.map((p) => (
                          <RosterRow key={p.playerKey} p={p} onClick={() => openPlayer(p)} />
                        ))}
                      </>
                    )}
                  </Section>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Player modal */}
      {selectedPlayer && (
        loadingPlayer ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
          </div>
        ) : (
          <PlayerViewer
            player={{
              name: selectedPlayer.name,
              position: selectedPlayer.position,
              team: selectedPlayer.team,
              headshotUrl: getPlayerImageUrl(selectedPlayer),
              season,
              stats: { fanPts: selectedPlayer.stats?.fanPts ?? 0, byeWeek: selectedPlayer.stats?.byeWeek ?? null },
            }}
            stats={selectedStats || []}
            onClose={() => setSelectedPlayer(null)}
          />
        )
      )}

      {/* NEW: Win Probability chart modal */}
      {chartOpen && chartSel && (
        <WinProbChartModal
          isOpen={chartOpen}
          onClose={() => setChartOpen(false)}
          selected={{
            matchupId: chartSel.matchupId, // <-- ADD THIS LINE
            team1: { name: chartSel.team1.name, logo: chartSel.team1.logo || "" },
            team2: { name: chartSel.team2.name, logo: chartSel.team2.logo || "" },
            points: chartSel.points,
            final: chartSel.final,
          }}
          season={season}
          week={week}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 py-2 text-xs font-bold text-emerald-200">{title}</div>
      <div className="divide-y divide-[#232323]">{children}</div>
    </div>
  );
}

function RosterRow({ p, onClick }: { p: PlayerRow; onClick: () => void }) {
  const isBye = p.stats?.byeWeek === undefined ? false : p.stats?.byeWeek === p.stats?.byeWeek; // keep as simple flag if needed
  return (
    <div
      className="flex items-center gap-3 py-2 px-2 bg-[#181818] hover:bg-[#232323] transition cursor-pointer"
      onClick={onClick}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-white text-base shadow ${slotColor(
          p.selectedPosition || p.position
        )}`}
      >
        {p.selectedPosition || p.position}
      </div>
      <Image
        src={getPlayerImageUrl(p)}
        alt={p.name}
        width={40}
        height={40}
        className={`w-10 h-10 rounded-full border-2 border-[#232323] object-cover ${
          p.position === "DEF" ? "object-contain p-1" : ""
        }`}
        style={p.position === "DEF" ? { background: "#232323" } : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-white truncate">{p.name}</div>
        <div className="text-xs text-emerald-300 truncate">
          {p.team} - {p.position}
        </div>
      </div>
      <div className="flex flex-col items-end min-w-[60px]">
        <div className="font-bold text-sky-300 text-sm">
          {p.stats?.fanPts != null ? Number(p.stats.fanPts).toFixed(2) : "-"}
        </div>
        <div className="text-[11px] text-slate-400">
          {p.stats?.projPts != null ? Number(p.stats.projPts).toFixed(2) : "—"}
        </div>
      </div>
    </div>
  );
}

// NEW: Mobile Yahoo-like roster table
function MobileRosterTable({
  title,
  leftTeam,
  rightTeam,
  starterRows,
  benchRows,
  irRows,
  onClickLeft,
  onClickRight,
}: {
  title: string;
  leftTeam: { name: string };
  rightTeam: { name: string };
  starterRows: { slot: string; left?: PlayerRow; right?: PlayerRow }[];
  benchRows: { slot: string; left?: PlayerRow; right?: PlayerRow }[];
  irRows: { slot: string; left?: PlayerRow; right?: PlayerRow }[];
  onClickLeft: (p: PlayerRow) => void;
  onClickRight: (p: PlayerRow) => void;
}) {
  return (
    <div className="bg-[#181818] rounded-xl border border-[#232323] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#232323] flex items-center justify-between">
        <div className="font-bold text-emerald-200">{leftTeam.name}</div>
        <div className="text-xs text-slate-400">vs</div>
        <div className="font-bold text-emerald-200 text-right">{rightTeam.name}</div>
      </div>

      <MobileRows rows={starterRows} onClickLeft={onClickLeft} onClickRight={onClickRight} />

      {benchRows.length > 0 && (
        <>
          <div className="px-3 py-2 text-xs font-bold text-emerald-200 border-t border-[#232323]">Bench</div>
          <MobileRows rows={benchRows} onClickLeft={onClickLeft} onClickRight={onClickRight} />
        </>
      )}

      {irRows.length > 0 && (
        <>
          <div className="px-3 py-2 text-xs font-bold text-emerald-200 border-t border-[#232323]">IR</div>
          <MobileRows rows={irRows} onClickLeft={onClickLeft} onClickRight={onClickRight} />
        </>
      )}
    </div>
  );
}

function MobileRows({
  rows,
  onClickLeft,
  onClickRight,
}: {
  rows: { slot: string; left?: PlayerRow; right?: PlayerRow }[];
  onClickLeft: (p: PlayerRow) => void;
  onClickRight: (p: PlayerRow) => void;
}) {
  return (
    <div className="divide-y divide-[#232323]">
      {rows.map((row, idx) => (
        <div
          key={`${row.slot}-${idx}`}
          className="grid items-stretch"
          // Fixed-width middle column; no column gap so the tag column stays exactly centered
          style={{ gridTemplateColumns: "minmax(0,1fr) 52px minmax(0,1fr)" }}
        >
          <MobilePlayerCell p={row.left} onClick={onClickLeft} align="left" />
          <div className="flex items-center justify-center w-[52px]">
            <div
              className={`w-10 h-10 rounded-md text-xs font-bold text-white flex items-center justify-center ${slotColor(
                row.slot
              )}`}
              title={row.slot}
            >
              {row.slot}
            </div>
          </div>
          <MobilePlayerCell p={row.right} onClick={onClickRight} align="right" />
        </div>
      ))}
    </div>
  );
}

function MobilePlayerCell({
  p,
  onClick,
  align,
}: {
  p?: PlayerRow;
  onClick: (p: PlayerRow) => void;
  align: "left" | "right";
}) {
  if (!p) {
    return <div className="py-2 px-2" />;
  }
  return (
    <button
      type="button"
      onClick={() => onClick(p)}
      // Symmetric padding; no internal gaps that push the center column
      className={`flex items-center py-2 px-3 hover:bg-[#232323] transition ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      {/* Mobile: no headshot */}
      <div className="min-w-0 flex-1">
        <div className="font-bold text-xs text-white truncate">{abbreviateFirstName(p.name)}</div>
        <div className="text-[11px] text-slate-400 truncate">
          {p.team} - {p.position}
        </div>
      </div>
      <div className={`min-w-[54px] flex flex-col ${align === "right" ? "items-start" : "items-end"}`}>
        <div className="font-bold text-sky-300 text-sm">
          {p.stats?.fanPts != null ? Number(p.stats.fanPts).toFixed(2) : "-"}
        </div>
        <div className="text-[11px] text-slate-400">
          {p.stats?.projPts != null ? Number(p.stats.projPts).toFixed(2) : "—"}
        </div>
      </div>
    </button>
  );
}