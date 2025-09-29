import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Test ESPN API for NFL games - Extract Essential Data Only
 * Run with: node testSportsDB.mjs
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getESPNGames() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format
  
  console.log(`[ESPN Test] Checking NFL games for ${today}`);
  console.log(`[ESPN Test] Current time: ${now.toISOString()}`);
  console.log(`[ESPN Test] Current time EST: ${now.toLocaleString("en-US", { timeZone: "America/New_York" })}`);
  
  try {
    // ESPN API endpoint for NFL scoreboard
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${today}`;
    console.log(`[ESPN Test] Fetching: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[ESPN Test] HTTP error: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    const events = data?.events || [];
    
    console.log(`[ESPN Test] Found ${events.length} games for ${today}`);
    
    if (events.length === 0) {
      console.log(`[ESPN Test] No games found`);
      return false;
    }
    
    // Extract only essential game data
    const essentialData = events.map(event => {
      const competition = event.competitions?.[0];
      if (!competition) return null;
      
      const gameDate = new Date(competition.date);
      const gameTime = gameDate.toLocaleString("en-US", { timeZone: "America/New_York" });
      
      const homeTeam = competition.competitors?.find(team => team.homeAway === 'home');
      const awayTeam = competition.competitors?.find(team => team.homeAway === 'away');
      
      return {
        id: event.id,
        name: event.name,
        shortName: event.shortName,
        dateUTC: competition.date,
        dateEST: gameTime,
        status: competition.status?.type?.description,
        statusDetail: competition.status?.type?.detail,
        week: event.week?.number,
        homeTeam: {
          id: homeTeam?.team?.id,
          name: homeTeam?.team?.displayName,
          abbreviation: homeTeam?.team?.abbreviation,
          score: homeTeam?.score,
          record: homeTeam?.records?.find(r => r.type === 'total')?.summary
        },
        awayTeam: {
          id: awayTeam?.team?.id,
          name: awayTeam?.team?.displayName,
          abbreviation: awayTeam?.team?.abbreviation,
          score: awayTeam?.score,
          record: awayTeam?.records?.find(r => r.type === 'total')?.summary
        },
        broadcast: competition.broadcasts?.[0]?.names?.[0],
        venue: {
          name: competition.venue?.fullName,
          city: competition.venue?.address?.city,
          state: competition.venue?.address?.state
        }
      };
    }).filter(game => game !== null);
    
    // Save only essential data
    const filename = `espn-essential-${today}.json`;
    const filepath = join(__dirname, filename);
    
    try {
      writeFileSync(filepath, JSON.stringify(essentialData, null, 2), 'utf8');
      console.log(`[ESPN Test] ✅ Essential data saved to: ${filename}`);
    } catch (writeError) {
      console.error(`[ESPN Test] ❌ Failed to save essential data:`, writeError);
    }
    
    // Display essential data in console
    console.log('\n=== ESSENTIAL GAME DATA ===');
    essentialData.forEach((game, idx) => {
      const timeDiff = now.getTime() - new Date(game.dateUTC).getTime();
      const minutesDiff = Math.round(timeDiff / (1000 * 60));
      const isInGameWindow = timeDiff >= 0 && timeDiff <= (4 * 60 * 60 * 1000);
      
      console.log(`\n${idx + 1}. ${game.shortName}`);
      console.log(`   Time: ${game.dateEST} EST`);
      console.log(`   Status: ${game.status}`);
      console.log(`   Broadcast: ${game.broadcast}`);
      console.log(`   Venue: ${game.venue.name} (${game.venue.city}, ${game.venue.state})`);
      console.log(`   Records: ${game.awayTeam.name} (${game.awayTeam.record}) @ ${game.homeTeam.name} (${game.homeTeam.record})`);
      console.log(`   Minutes since start: ${minutesDiff}`);
      console.log(`   In game window: ${isInGameWindow}`);
      
      if (isInGameWindow) {
        console.log(`   ✅ Game in progress - should poll`);
        return true;
      }
    });
    
    console.log(`\n=== FILE SIZE ===`);
    console.log(`Essential data: ~${Math.round(JSON.stringify(essentialData).length / 1024)} KB`);
    
  } catch (error) {
    console.error(`[ESPN Test] Error:`, error);
    return false;
  }
}

// Main execution
console.log('🔬 ESPN API Essential Data Extraction');
console.log('=====================================');

await getESPNGames();

console.log('\n✅ Test completed!');