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

export function getNextTuesday3am() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // 2 = Tuesday
  const daysUntilTuesday = (9 - dayOfWeek) % 7;
  const nextTuesday = new Date(now);
  nextTuesday.setDate(now.getDate() + daysUntilTuesday);
  nextTuesday.setHours(3, 0, 0, 0);
  return nextTuesday.getTime();
}

export function getCachedTopThree(year: string) {
  if (typeof window === "undefined") return null;
  const cache = localStorage.getItem(`topThree_${year}`);
  if (!cache) return null;
  try {
    const { expires, teams } = JSON.parse(cache);
    if (Date.now() < expires) return teams;
  } catch {
    return null;
  }
  return null;
}

export function setCachedTopThree(year: string, teams: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `topThree_${year}`,
    JSON.stringify({
      expires: getNextTuesday3am(),
      teams,
    })
  );
}

export function getCachedStandings(year: string) {
  if (typeof window === "undefined") return null;
  const cache = localStorage.getItem(`standings_${year}`);
  if (!cache) return null;
  try {
    const { expires, teams } = JSON.parse(cache);
    if (Date.now() < expires) return teams;
  } catch {
    return null;
  }
  return null;
}

export function setCachedStandings(year: string, teams: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `standings_${year}`,
    JSON.stringify({
      expires: getNextTuesday3am(),
      teams,
    })
  );
}