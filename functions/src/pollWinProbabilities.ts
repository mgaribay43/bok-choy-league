import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";

// ET date helper (avoids UTC boundary issues on night games)
function getETDateYYYYMMDD(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

// Parse kickoff time (UTC first, then local as last resort)
function parseKickoff(ev: any): Date | null {
  // 1) UTC timestamp (best)
  const ts = String(ev?.strTimestamp || "").trim();
  if (ts) {
    const iso = /[zZ]$/.test(ts) ? ts : ts + "Z";
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  // 2) UTC date/time
  const dateEvent = String(ev?.dateEvent || "").trim();
  const strTime = String(ev?.strTime || "").trim();
  if (dateEvent && strTime) {
    const iso = `${dateEvent}T${strTime}${/[zZ]$/.test(strTime) ? "" : "Z"}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  // 3) Local date/time (fallback; interpreted by server TZ)
  const dateEventLocal = String(ev?.dateEventLocal || ev?.strEventLocal || "").trim();
  const strTimeLocal = String(ev?.strTimeLocal || "").trim();
  if (dateEventLocal && strTimeLocal) {
    const d = new Date(`${dateEventLocal}T${strTimeLocal}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// NEW: v1 gate — between earliest kickoff and 5h after latest kickoff
async function sportsDbShouldPoll(): Promise<boolean> {
  const API_KEY =
    process.env.THESPORTSDB_API_KEY_PREMIUM ||
    process.env.THESPORTSDB_API_KEY ||
    "307739"; // set your key in env for prod

  const etDate = getETDateYYYYMMDD();
  const url = `https://www.thesportsdb.com/api/v1/json/${API_KEY}/eventsday.php?d=${etDate}&l=${encodeURIComponent(
    "NFL"
  )}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const raw = await res.text();
    const ctype = res.headers.get("content-type") || "";
    console.log("[SportsDB GET]:", url);
    console.log("[SportsDB content-type]:", ctype);
    console.log("[SportsDB raw]:", raw);

    // Parse JSON (treat events: null as empty)
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[SportsDB] JSON parse error (v1).");
      return false;
    }
    const events: any[] = Array.isArray(data?.events) ? data.events : [];
    if (!events.length) {
      console.log("[SportsDB] events array empty — skipping polling.");
      return false;
    }

    // Collect kickoff times
    const kickoffs: Date[] = events
      .map(parseKickoff)
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

    if (!kickoffs.length) {
      console.log("[SportsDB] no parsable kickoff times — skipping polling.");
      return false;
    }

    const earliest = new Date(Math.min(...kickoffs.map((d) => d.getTime())));
    const latest = new Date(Math.max(...kickoffs.map((d) => d.getTime())));
    const pollUntil = new Date(latest.getTime() + 5 * 60 * 60 * 1000);
    const now = new Date();

    const shouldPoll = now >= earliest && now <= pollUntil;
    console.log(
      `[SportsDB] events=${events.length} earliest=${earliest.toISOString()} latest=${latest.toISOString()} pollUntil=${pollUntil.toISOString()} now=${now.toISOString()} shouldPoll=${shouldPoll}`
    );

    return shouldPoll;
  } catch (err) {
    console.error("[SportsDB] v1 eventsday fetch error:", err);
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