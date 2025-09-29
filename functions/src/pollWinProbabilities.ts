import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";

/**
 * Check if current time falls within any NFL game windows using ESPN API
 * Returns true if we should be polling win probabilities
 */
async function shouldPollNow(): Promise<boolean> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format for ESPN
  
  console.log(`[Poll Check] Checking NFL games for ${today} via ESPN API`);
  console.log(`[Poll Check] Current time UTC: ${now.toISOString()}`);
  console.log(`[Poll Check] Current time EST: ${now.toLocaleString("en-US", { timeZone: "America/New_York" })}`);
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${today}`;
    console.log(`[Poll Check] Fetching: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`[Poll Check] ESPN API error: ${response.status}`);
      return false;
    }
    
    const data = await response.json() as any;
    const events = data?.events || [];
    
    if (events.length === 0) {
      console.log(`[Poll Check] No NFL games found for ${today}`);
      return false;
    }
    
    console.log(`[Poll Check] Found ${events.length} NFL games for ${today}`);
    
    // Check if any game is currently in progress (within 4 hours of start time)
    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;
      
      const gameDate = new Date(competition.date);
      const gameTimeEST = gameDate.toLocaleString("en-US", { timeZone: "America/New_York" });
      
      const homeTeam = competition.competitors?.find((team: any) => team.homeAway === 'home');
      const awayTeam = competition.competitors?.find((team: any) => team.homeAway === 'away');
      
      // Calculate time difference
      const timeDiff = now.getTime() - gameDate.getTime();
      const minutesDiff = Math.round(timeDiff / (1000 * 60));
      
      // Game window: from start time to 4 hours after start
      const isInGameWindow = timeDiff >= 0 && timeDiff <= (4 * 60 * 60 * 1000);
      
      console.log(`[Poll Check] ${awayTeam?.team?.displayName} @ ${homeTeam?.team?.displayName}`);
      console.log(`[Poll Check] Game time: ${gameTimeEST} EST`);
      console.log(`[Poll Check] Status: ${competition.status?.type?.description}`);
      console.log(`[Poll Check] Minutes since start: ${minutesDiff}`);
      console.log(`[Poll Check] In game window: ${isInGameWindow}`);
      
      if (isInGameWindow) {
        console.log(`[Poll Check] ✅ Game in progress - should poll`);
        return true;
      }
    }
    
    console.log(`[Poll Check] ❌ No games currently in progress`);
    return false;
    
  } catch (error) {
    console.error(`[Poll Check] Error checking games:`, error);
    return false;
  }
}

/**
 * Main polling function - runs every 3 minutes
 */
export const pollWinProbabilities = onSchedule(
  {
    schedule: "every 3 minutes",
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public",
  },
  async (_event: ScheduledEvent) => {
    console.log(`[WinProb] Starting poll at ${new Date().toISOString()}`);
    
    try {
      // Step 1: Check if we should poll based on NFL game times via ESPN API
      const shouldPoll = await shouldPollNow();
      if (!shouldPoll) {
        console.log("[WinProb] Not polling - no games in progress");
        return;
      }
      
      console.log("[WinProb] ✅ Games in progress - starting poll");
      
      // Step 2: Get current season and week from Yahoo API
      const season = new Date().getFullYear().toString();
      
      const settingsRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
      );
      
      if (!settingsRes.ok) {
        console.error(`[WinProb] Yahoo settings API error: ${settingsRes.status}`);
        return;
      }
      
      const settingsData = await settingsRes.json() as any;
      const week = Number(settingsData?.fantasy_content?.league?.[0]?.current_week);
      
      if (!week) {
        console.error("[WinProb] Could not get current week from Yahoo API");
        return;
      }
      
      console.log(`[WinProb] Processing season ${season}, week ${week}`);
      
      // Step 3: Get scoreboard data
      const scoreboardRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${season}&week=${week}`
      );
      
      if (!scoreboardRes.ok) {
        console.error(`[WinProb] Yahoo scoreboard API error: ${scoreboardRes.status}`);
        return;
      }
      
      const scoreboardData = await scoreboardRes.json() as any;
      const scoreboard = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.[0];
      const matchups = scoreboard?.matchups;
      
      if (!matchups) {
        console.log("[WinProb] No matchups found in scoreboard");
        return;
      }
      
      // Step 4: Check if week is active
      const firstMatchup = matchups?.["0"]?.matchup;
      const weekStatus = firstMatchup?.status ?? "preevent";
      
      if (weekStatus !== "midevent") {
        console.log(`[WinProb] Week not active (status: ${weekStatus}) - not storing data`);
        return;
      }
      
      console.log(`[WinProb] Week is active - processing matchups`);
      
      // Step 5: Process each matchup
      const db = admin.firestore();
      const matchupCount = parseInt(matchups?.count ?? "0", 10);
      
      for (let i = 0; i < matchupCount; i++) {
        const matchup = matchups[i.toString()]?.matchup;
        if (!matchup) continue;
        
        const teams = matchup[0]?.teams;
        const team1 = teams?.[0]?.team;
        const team2 = teams?.[1]?.team;
        const matchupId = matchup[1]?.matchup_id ?? `${i}`;
        
        // Get win probabilities (Yahoo returns as decimals 0.0-1.0)
        const team1WinProb = Number(team1?.[1]?.win_probability ?? 0.5);
        const team2WinProb = Number(team2?.[1]?.win_probability ?? 0.5);
        
        // Convert to percentages for storage
        const team1Pct = team1WinProb * 100;
        const team2Pct = team2WinProb * 100;
        
        // Skip if either team has 100% win probability
        if (team1Pct >= 100 || team2Pct >= 100) {
          console.log(`[WinProb] Skipping matchup ${matchupId} - game decided (${team1Pct}% vs ${team2Pct}%)`);
          continue;
        }
        
        // Get team info
        const team1Meta = team1?.[0] || [];
        const team2Meta = team2?.[0] || [];
        const team1Name = team1Meta.find((item: any) => item.name)?.name ?? "Team 1";
        const team2Name = team2Meta.find((item: any) => item.name)?.name ?? "Team 2";
        const team1Logo = team1Meta.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ?? "";
        const team2Logo = team2Meta.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ?? "";
        
        // Create timestamp
        const timeLabel = new Date().toLocaleString("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        
        // Get existing data
        const docRef = db.collection("WinProbabilities").doc(`${season}_${week}_${matchupId}`);
        const docSnap = await docRef.get();
        const existingPoints = docSnap.exists ? (docSnap.data()?.points || []) : [];
        
        // Add new data point
        const newPoints = [
          ...existingPoints,
          { time: timeLabel, team1Pct, team2Pct }
        ];
        
        // Save to Firestore
        await docRef.set({
          matchupId,
          team1: { name: team1Name, logo: team1Logo },
          team2: { name: team2Name, logo: team2Logo },
          points: newPoints,
          final: matchup[1]?.status === "postevent",
          season,
          week,
        }, { merge: true });
        
        console.log(`[WinProb] Updated ${team1Name} (${team1Pct.toFixed(1)}%) vs ${team2Name} (${team2Pct.toFixed(1)}%)`);
      }
      
      console.log(`[WinProb] ✅ Poll completed - processed ${matchupCount} matchups`);
      
    } catch (error) {
      console.error("[WinProb] Error during polling:", error);
    }
  }
);