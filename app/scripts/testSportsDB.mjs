import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Test ESPN API for NFL games - Save Full Response
 * Run with: node testSportsDB.mjs
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to get YYYYMMDD date string in US Eastern Time
function getEasternDateYYYYMMDD() {
  const estString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  // estString format: M/D/YYYY, h:mm:ss AM/PM
  const [datePart] = estString.split(",");
  const [month, day, year] = datePart.trim().split("/");
  return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
}

async function getESPNGames() {
  // Use US Eastern Time for NFL schedule
  const today = getEasternDateYYYYMMDD();

  console.log(`[ESPN Test] Checking NFL games for ${today} (EST)`);
  console.log(`[ESPN Test] Current time UTC: ${new Date().toISOString()}`);
  console.log(`[ESPN Test] Current time EST: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`);

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

    // Save full response
    const filename = `espn-full-${today}.json`;
    const filepath = join(__dirname, filename);

    try {
      writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[ESPN Test] ✅ Full response saved to: ${filename}`);
    } catch (writeError) {
      console.error(`[ESPN Test] ❌ Failed to save full response:`, writeError);
    }

    // Display top-level keys and event count for quick inspection
    console.log('\n=== ESPN API TOP-LEVEL KEYS ===');
    console.log(Object.keys(data));
    if (data?.events) {
      console.log(`Events count: ${data.events.length}`);
    } else {
      console.log('No events found in response.');
    }

  } catch (error) {
    console.error(`[ESPN Test] Error:`, error);
    return false;
  }
}

// Main execution
console.log('🔬 ESPN API Full Response Extraction');
console.log('=====================================');

await getESPNGames();

console.log('\n✅ Test completed!');