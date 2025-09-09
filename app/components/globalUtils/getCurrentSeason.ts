export async function getCurrentSeason(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const res = await fetch(`https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${currentYear}`);
  const data = await res.json();

  // Get the season field from the response
  const currentSeason = data?.fantasy_content?.league?.[0]?.season || String(currentYear);

  return currentSeason;
}