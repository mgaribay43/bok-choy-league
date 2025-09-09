// utils/getCurrentWeek.ts
export async function getCurrentWeek(season: string): Promise<number> {
  const res = await fetch(`https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`);
  const data = await res.json();
  // Yahoo's settings JSON: find the current_week value
  // The correct path is data.fantasy_content.league[0].current_week
  const currentWeek = Number(
    data?.fantasy_content?.league?.[0]?.current_week
  );
  return currentWeek;
}