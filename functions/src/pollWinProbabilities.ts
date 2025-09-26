import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";

// Normalize status to one of Q1..Q4 or null
function normalizeQuarter(status: unknown): "Q1" | "Q2" | "Q3" | "Q4" | null {
  if (status == null) return null;
  const raw = String(status).replace(/[^\x20-\x7E]/g, "").trim().toUpperCase();
  const m = raw.match(/^Q([1-4])\b/);
  return m ? (`Q${m[1]}` as any) : null;
}

/**
 * Checks if we should poll based on NFL game start times.
 * Poll if now >= earliest strTimeLocal and now <= latest strTimeLocal + 4 hours.
 * @param events SportsDB events array
 */
function shouldPollByGameTimes(events: any[]): boolean {
  if (!Array.isArray(events) || events.length === 0) return false;

  // Parse all valid start times
  const startTimes = events
    .map(ev => {
      if (!ev.strTimeLocal || !ev.dateEventLocal) return null;
      // Combine local date and time, e.g. "2025-09-25 17:15:00"
      const dtStr = `${ev.dateEventLocal}T${ev.strTimeLocal}`;
      const dt = new Date(dtStr);
      return isNaN(dt.getTime()) ? null : dt;
    })
    .filter(Boolean) as Date[];

  if (!startTimes.length) return false;

  // Find earliest and latest start times
  const earliest = new Date(Math.min(...startTimes.map(dt => dt.getTime())));
  const latest = new Date(Math.max(...startTimes.map(dt => dt.getTime())));

  const now = new Date();

  // Poll if now >= earliest start and now <= latest start + 4 hours
  const pollStart = earliest.getTime();
  const pollEnd = latest.getTime() + 4 * 60 * 60 * 1000; // 4 hours after latest start

  return now.getTime() >= pollStart && now.getTime() <= pollEnd;
}

// NEW: gate — call SportsDB, require non-empty events, and at least one Q1–Q4
async function sportsDbShouldPoll(): Promise<boolean> {
  const date = new Date().toISOString().slice(0, 10);
  const url = `https://www.thesportsdb.com/api/v1/json/307739/eventsday.php?d=${date}&l=${encodeURIComponent("NFL")}`;

  try {
    const res = await fetch(url);
    const raw = await res.text();

    // Debug: print the raw response received by the Cloud Function
    console.log("[SportsDB raw]:", raw);

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("[SportsDB] JSON parse error:", e);
      return false;
    }

    const events: any[] = Array.isArray(data?.events) ? data.events : [];
    if (!events.length) {
      console.log("[SportsDB] events array empty — skipping polling.");
      return false;
    }

    // Use new time-based polling logic
    if (!shouldPollByGameTimes(events)) {
      console.log("[SportsDB] Not within polling window based on game start times.");
      return false;
    }

    const anyInQuarter = events.some((ev) => normalizeQuarter(ev?.strStatus) !== null);
    if (!anyInQuarter) {
      console.log("[SportsDB] no events with strStatus Q1–Q4 — skipping polling.");
      return false;
    }

    return true;
  } catch (err) {
    console.error("[SportsDB] fetch error:", err);
    return false;
  }
}

export const pollWinProbabilities = onSchedule(
  {
    schedule: "every 3 minutes",
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public",
  },
  async (_event: ScheduledEvent) => {
    // Only poll when SportsDB says there are NFL games today AND at least one is in Q1–Q4
    const shouldPoll = await sportsDbShouldPoll();
    if (!shouldPoll) return;

    const db = admin.firestore();

    // Get current season (year)
    const season = new Date().getFullYear().toString();

    // Fetch current week from yahooAPI settings endpoint
    const settingsRes = await fetch(
      `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
    );
    const settingsData: {
      fantasy_content?: {
        league?: any[];
      };
    } = await settingsRes.json() as {
      fantasy_content?: {
        league?: any[];
      };
    };
    const week =
      Number(settingsData?.fantasy_content?.league?.[0]?.current_week);

    // Fetch scoreboard for the current week
    const res = await fetch(
      `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${season}&week=${week}`
    );
    const data = (await res.json()) as {
      fantasy_content?: {
        league?: any[];
      };
    };
    const scoreboard = data?.fantasy_content?.league?.[1]?.scoreboard?.[0];
    const matchups = scoreboard?.matchups;
    // Get the first matchup object (usually key "0")
    const firstMatchupObj = matchups?.["0"]?.matchup;
    // Extract week status from the first matchup
    const weekStatus = firstMatchupObj?.status ?? "preevent";
    const games = matchups;
    const count = parseInt(games?.count ?? "0", 10);

    // Only poll and store win probabilities if the week is "midevent"
    if (weekStatus !== "midevent") {
      console.log(`Week ${week} is not midevent (status: ${weekStatus}), skipping polling.`);
      return;
    }

    for (let i = 0; i < count; i++) {
      const m = games[i.toString()]?.matchup;
      if (!m) continue;
      const teams = m[0]?.teams;
      const team1 = teams?.[0]?.team;
      const team2 = teams?.[1]?.team;
      const status = m[1]?.status ?? "";
      const matchupId = m[1]?.matchup_id ?? `${i}`;

      // Get win probabilities (simulate or use real if available)
      const team1Pct = Number(team1?.[1]?.win_probability ?? 50);
      const team2Pct = Number(team2?.[1]?.win_probability ?? 50);

      // Get team names/logos
      const t1meta = team1?.[0] || [];
      const t2meta = team2?.[0] || [];
      const t1name = t1meta.find((item: { name: any }) => item.name)?.name ?? "Team 1";
      const t2name = t2meta.find((item: { name: any }) => item.name)?.name ?? "Team 2";
      const t1logo = t1meta.find((item: { team_logos: any }) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ?? "";
      const t2logo = t2meta.find((item: { team_logos: any }) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ?? "";

      // Firestore doc for this matchup
      const matchupDocRef = db
        .collection("WinProbabilities")
        .doc(`${season}_${week}_${matchupId}`);

      // Get existing points from Firestore
      let prevPoints = [];
      try {
        const docSnap = await matchupDocRef.get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          prevPoints = docData && docData.points ? docData.points : [];
        }
      } catch {}

      // Format the current time in EST with single-digit hour if needed
      const now = new Date();
      const timeLabel = now.toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Always store points regardless of matchup status (since week is midevent)
      const newPoints = [...prevPoints, { time: timeLabel, team1Pct, team2Pct }];
      await matchupDocRef.set(
        {
          matchupId,
          team1: { name: t1name, logo: t1logo },
          team2: { name: t2name, logo: t2logo },
          points: newPoints,
          final: status === "postevent",
          season,
          week,
        },
        { merge: true }
      );
    }
  }
);