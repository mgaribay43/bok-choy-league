// utils/getCurrentWeek.ts
export async function getCurrentWeek(season: string): Promise<number> {
  const res = await fetch(`https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`);
  const data = await res.json();
  // Yahoo's settings JSON: find the current_week value
  // You may need to adjust this path based on your actual response structure
  const currentWeek = Number(
    data?.fantasy_content?.league?.[1]?.settings?.[0]?.stat_categories?.[0]?.current_week ||
    data?.fantasy_content?.league?.[1]?.settings?.[0]?.current_week
  );
  return currentWeek || 1;
}