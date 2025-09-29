import { onRequest } from "firebase-functions/v2/https";
import { Request, Response } from "express";
import fetch from "node-fetch";

interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  dateUTC: string;
  dateEST: string;
  status: string;
  statusDetail: string;
  week: number;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score: string;
    record: string;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score: string;
    record: string;
  };
  broadcast: string;
  venue: {
    name: string;
    city: string;
    state: string;
  };
}

/**
 * Get current NFL week number from ESPN
 */
async function getCurrentNFLWeek(): Promise<number> {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${today}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    const events = data?.events || [];
    
    if (events.length > 0) {
      return events[0]?.week?.number || 1;
    }
    
    // Fallback: estimate week based on season start (first Thursday in September)
    const year = now.getFullYear();
    const seasonStart = new Date(year, 8, 1); // September 1st
    const dayOfWeek = seasonStart.getDay();
    const firstThursday = new Date(year, 8, 1 + (4 - dayOfWeek + 7) % 7);
    
    const weeksDiff = Math.floor((now.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(18, weeksDiff + 1)); // NFL weeks 1-18
    
  } catch (error) {
    console.error('Error getting current NFL week:', error);
    return 1; // Default to week 1
  }
}

/**
 * Get NFL games for a specific week from ESPN API
 */
async function getNFLGamesForWeek(week: number, year: number = new Date().getFullYear()): Promise<ESPNGame[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${year}`;
    console.log(`[NFL Matchups] Fetching week ${week} games: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    const events = data?.events || [];
    
    console.log(`[NFL Matchups] Found ${events.length} games for week ${week}`);
    
    // Extract essential game data
    const games: ESPNGame[] = events.map((event: any) => {
      const competition = event.competitions?.[0];
      if (!competition) return null;
      
      const gameDate = new Date(competition.date);
      const gameTime = gameDate.toLocaleString("en-US", { timeZone: "America/New_York" });
      
      const homeTeam = competition.competitors?.find((team: any) => team.homeAway === 'home');
      const awayTeam = competition.competitors?.find((team: any) => team.homeAway === 'away');
      
      return {
        id: event.id,
        name: event.name,
        shortName: event.shortName,
        dateUTC: competition.date,
        dateEST: gameTime,
        status: competition.status?.type?.description || 'Scheduled',
        statusDetail: competition.status?.type?.detail || '',
        week: event.week?.number || week,
        homeTeam: {
          id: homeTeam?.team?.id || '',
          name: homeTeam?.team?.displayName || '',
          abbreviation: homeTeam?.team?.abbreviation || '',
          score: homeTeam?.score || '0',
          record: homeTeam?.records?.find((r: any) => r.type === 'total')?.summary || '0-0'
        },
        awayTeam: {
          id: awayTeam?.team?.id || '',
          name: awayTeam?.team?.displayName || '',
          abbreviation: awayTeam?.team?.abbreviation || '',
          score: awayTeam?.score || '0',
          record: awayTeam?.records?.find((r: any) => r.type === 'total')?.summary || '0-0'
        },
        broadcast: competition.broadcasts?.[0]?.names?.[0] || '',
        venue: {
          name: competition.venue?.fullName || '',
          city: competition.venue?.address?.city || '',
          state: competition.venue?.address?.state || ''
        }
      };
    }).filter((game: ESPNGame | null): game is ESPNGame => game !== null);
    
    return games;
    
  } catch (error) {
    console.error('Error fetching NFL games:', error);
    throw error;
  }
}

/**
 * Cloud function to get NFL matchup data
 * 
 * Query Parameters:
 * - week: NFL week number (optional, defaults to current week)
 * - year: NFL season year (optional, defaults to current year)
 * 
 * Example: /nflMatchups?week=4&year=2025
 */
export const nflMatchups = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req: Request, res: Response) => {
    console.log(`[NFL Matchups] Request received: ${req.method} ${req.url}`);
    
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      let week = parseInt(req.query.week as string);
      
      // If no week specified, get current week
      if (!week || isNaN(week)) {
        week = await getCurrentNFLWeek();
        console.log(`[NFL Matchups] No week specified, using current week: ${week}`);
      }
      
      // Validate week range
      if (week < 1 || week > 18) {
        res.status(400).json({ 
          error: 'Invalid week number. Must be between 1 and 18.',
          week,
          year
        });
        return;
      }
      
      console.log(`[NFL Matchups] Fetching games for week ${week}, year ${year}`);
      
      const games = await getNFLGamesForWeek(week, year);
      
      // Calculate if any games are currently in progress
      const now = new Date();
      const gamesInProgress = games.filter(game => {
        const gameDate = new Date(game.dateUTC);
        const timeDiff = now.getTime() - gameDate.getTime();
        return timeDiff >= 0 && timeDiff <= (4 * 60 * 60 * 1000); // 4 hour window
      });
      
      const response = {
        success: true,
        data: {
          week,
          year,
          totalGames: games.length,
          gamesInProgress: gamesInProgress.length,
          isActiveWeek: gamesInProgress.length > 0,
          games
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`[NFL Matchups] Returning ${games.length} games for week ${week}`);
      
      res.status(200).json(response);
      
    } catch (error) {
      console.error('[NFL Matchups] Error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch NFL matchup data',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
);