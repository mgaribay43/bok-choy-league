import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";

// Helper: Returns true if an NFL game is live using TheSportsDB
async function isNFLGameLive_TheSportsDB() {
  const API_KEY = "123";
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const url = `https://www.thesportsdb.com/api/v1/json/${API_KEY}/eventsday.php?d=${today}&s=American%20Football`;

  try {
    const res = await fetch(url);
    const data: any = await res.json();
    // TheSportsDB marks live games with strStatus === "Live"
    const liveGames = (data.events || []).filter(
      (event: any) => event.strStatus === "Live"
    );
    return liveGames.length > 0;
  } catch (err) {
    console.error("Error checking NFL live status:", err);
    return false;
  }
}

export const pollWinProbabilities = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public",
  },
  async (event: ScheduledEvent) => {
    // Only poll if an NFL game is live according to TheSportsDB
    const isLive = await isNFLGameLive_TheSportsDB();
    if (!isLive) {
      console.log("No NFL games are live according to TheSportsDB, skipping polling.");
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