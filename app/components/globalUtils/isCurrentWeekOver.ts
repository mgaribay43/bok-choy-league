export async function isCurrentWeekOver(season: string, week: number): Promise<boolean> {
  const res = await fetch(
    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}&week=${week}`
  );
  const data = await res.json();
  // The correct path for week status is usually:
  // data.fantasy_content.league[1].scoreboard[0].matchups["0"].matchup[1].status
  const weekStatus =
    data?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups?.["0"]?.matchup?.[1]?.status ?? "";

  // Week is considered over if status is "postevent"
  return weekStatus === "postevent";
}