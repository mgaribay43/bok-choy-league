import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";

/**
 * Helper to get current EST date/time and YYYYMMDD string
 */
function getESTDateObj() {
  const estString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const [datePart, timePart] = estString.split(",");
  const [month, day, year] = datePart.trim().split("/");
  return {
    estString,
    year,
    month: month.padStart(2, "0"),
    day: day.padStart(2, "0"),
    timePart: timePart?.trim() ?? "",
    yyyymmdd: `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`,
  };
}

if (!admin.apps?.length) {
  admin.initializeApp();
}

/**
 * Poll matchups for current season/week and cache in Firestore.
 * Runs every 1 minute.
 */
export const pollMatchupsData = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    timeoutSeconds: 50,
    memory: "256MiB",
    invoker: "public",
  },
  async (_event: ScheduledEvent) => {
    const est = getESTDateObj();
    console.log(`[PollMatchups] Starting poll at EST: ${est.estString}`);

    try {
      const season = est.year;

      // Get current week from Yahoo settings endpoint
      const settingsRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
      );

      if (!settingsRes.ok) {
        console.error(`[PollMatchups] Yahoo settings API error: ${settingsRes.status}`);
        return;
      }

      const settingsData = await settingsRes.json() as any;
      const week = Number(settingsData?.fantasy_content?.league?.[0]?.current_week);

      if (!week) {
        console.error("[PollMatchups] Could not determine current week from Yahoo API");
        return;
      }

      console.log(`[PollMatchups] Season ${season}, Week ${week} - fetching scoreboard`);

      // Fetch scoreboard for the current week
      const scoreboardRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${season}&week=${week}`
      );

      if (!scoreboardRes.ok) {
        console.error(`[PollMatchups] Yahoo scoreboard API error: ${scoreboardRes.status}`);
        return;
      }

      const scoreboardData = await scoreboardRes.json() as any;
      const scoreboard = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.[0];
      const matchups = scoreboard?.matchups;

      if (!matchups) {
        console.log("[PollMatchups] No matchups found in scoreboard");
        return;
      }

      // Simplify matchups for caching: id, status, teams (id, name, logo, currentScore)
      const matchupCount = parseInt(matchups?.count ?? "0", 10);
      const simplified: any[] = [];

      for (let i = 0; i < matchupCount; i++) {
        const raw = matchups[i.toString()]?.matchup;
        if (!raw) continue;

        const matchupId = raw[1]?.matchup_id ?? `${i}`;
        const status = raw[1]?.status ?? "preevent";
        const teamsRaw = raw[0]?.teams;
        const teams: any[] = [];

        if (Array.isArray(teamsRaw)) {
          for (const t of teamsRaw) {
            const team = t?.team;
            const meta = team?.[0] || [];
            const stats = team?.[1] || {};
            const teamId = meta.find((it: any) => it.team_id)?.team_id ?? "";
            const name = meta.find((it: any) => it.name)?.name ?? meta.find((it: any) => it.nickname)?.nickname ?? "";
            const logo = meta.find((it: any) => it.team_logos)?.team_logos?.[0]?.team_logo?.url ?? "";
            const currentScore = stats.home_or_away_score ?? stats.current_score ?? stats?.team_points ?? "";

            teams.push({
              teamId,
              name,
              logo,
              currentScore,
            });
          }
        }

        simplified.push({
          matchupId,
          status,
          teams,
        });
      }

      const db = admin.firestore();
      const docRef = db.collection("Matchups").doc(`${season}_${week}`);

      const timeLabel = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Firestore rejects some nested or unsupported entity types from the external API.
      // Store the raw payload as a JSON string (safe) and keep a simplified object for queries.
      let rawMatchupsJson = "";
      try {
        rawMatchupsJson = JSON.stringify(matchups);
      } catch (err) {
        console.warn("[PollMatchups] Failed to stringify raw matchups, skipping raw payload:", err);
        rawMatchupsJson = "";
      }

      await docRef.set(
        {
          season,
          week,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          estTimeLabel: timeLabel,
          simplifiedMatchups: simplified,
          rawMatchupsJson, // parse on read with JSON.parse if needed
        },
        { merge: true }
      );

      console.log(`[PollMatchups] ✅ Cached ${simplified.length} matchups for ${season} week ${week} (rawMatchups stored as JSON string)`);
    } catch (error) {
      console.error("[PollMatchups] Error during poll:", error);
    }
  }
);