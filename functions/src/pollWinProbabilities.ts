import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";

// Helper: Returns true if now is likely during NFL games (Eastern Time)
function isNFLGameWindow() {
  const now = new Date();

  // Get Eastern Time dynamically using Intl.DateTimeFormat
  const easternTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const easternHour = easternTime.getHours();
  const day = easternTime.getDay(); // 0=Sunday, 1=Monday, ..., 4=Thursday, 6=Saturday

  // Thursday Night: Thursday 8pm–11:59pm (day 4, 20–23) and Friday 12am–1am (day 5, 0–1)
  if ((day === 4 && easternHour >= 20 && easternHour <= 23) ||
      (day === 5 && easternHour >= 0 && easternHour <= 1)) return true;

  // Sunday: Sunday 1pm–11:59pm (day 0, 13–23) and Monday 12am–1am (day 1, 0–1)
  if ((day === 0 && easternHour >= 13 && easternHour <= 23) ||
      (day === 1 && easternHour >= 0 && easternHour <= 1)) return true;

  // Monday Night: Monday 8pm–11:59pm (day 1, 20–23) and Tuesday 12am–1am (day 2, 0–1)
  if ((day === 1 && easternHour >= 20 && easternHour <= 23) ||
      (day === 2 && easternHour >= 0 && easternHour <= 1)) return true;

  return false;
}

export const pollWinProbabilities = onSchedule(
  {
    schedule: "every 5 minutes", // Change polling interval to every 5 minutes
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public",
  },
  async (event: ScheduledEvent) => {
    // Only poll if it's likely during NFL games
    if (!isNFLGameWindow()) {
      console.log("Not during NFL game window, skipping polling.");
      return;
    }

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

      // Always store points regardless of matchup status (since week is midevent)
      const now = new Date();
      const timeLabel = now.toLocaleTimeString();
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