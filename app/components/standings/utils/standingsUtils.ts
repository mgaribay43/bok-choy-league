import Link from "next/link";

export interface TeamEntry {
  id: string;
  name: string;
  manager: string;
  realManager: string;
  rank: number;
  logo: string;
  record: string;
}

export type StandingsProps = {
  topThree?: boolean;
};

export const getCurrentSeason = async (): Promise<string> => {
  try {
    const response = await fetch(
      "https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=2025"
    );
    if (!response.ok) throw new Error("Failed to fetch league settings");
    const json = await response.json();
    const league = json.fantasy_content.league[0];
    return league.season;
  } catch {
    return String(new Date().getFullYear());
  }
};

export const getDraftTime = async (season: string): Promise<number | null> => {
  try {
    const response = await fetch(
      `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
    );
    if (!response.ok) throw new Error("Failed to fetch league settings");
    const json = await response.json();
    const draftTime = json?.fantasy_content?.league?.[1]?.settings?.[0]?.draft_time;
    return draftTime ? Number(draftTime) * 1000 : null;
  } catch {
    return null;
  }
};

export function getDisplayManagerName(name: string) {
  if (name === "Jacob") return "Harris";
  if (name === "jake.hughes275") return "Hughes";
  if (name === "johnny5david") return "Johnny";
  if (name === "Zachary") return "Zach";
  if (name === "Michael") return "Mike";
  return name;
}

export function getTrophyUrl(place: number, season: string) {
  if (![1, 2, 3].includes(place)) return undefined;
  if (season === "2017") {
      return `https://s.yimg.com/cv/ae/default/170508/tr_nfl_${place}_2017.png`;
  }
  return `https://s.yimg.com/cv/apiv2/default/170508/tr_nfl_${place}_${season}.png`;
}