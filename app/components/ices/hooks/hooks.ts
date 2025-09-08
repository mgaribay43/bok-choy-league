import { getBottomN, getTopN, getUnique, getYear, splitPlayers } from "../utils/helpers";

export type IceVideo = {
  id: string;
  player: string;
  manager: string;
  date: string;
  week?: string;
  season?: string;
  flavor?: string;
  [key: string]: any;
};

// =======================
// Stats Calculation Hook
// =======================
export function useStats(videos: IceVideo[]) {
  const managerIcedCount: Record<string, number> = {};
  const playerIcedCount: Record<string, number> = {};
  const weekCounts: Record<string, Record<string, number>> = {};

  // Aggregate stats
  videos.forEach(video => {
    const manager = video.manager?.trim();
    const playerNames = splitPlayers(video.player);
    if (manager) managerIcedCount[manager] = (managerIcedCount[manager] || 0) + playerNames.length;
    playerNames.forEach(player => playerIcedCount[player] = (playerIcedCount[player] || 0) + 1);

    const week = video.week?.trim();
    const season = video.season ?? getYear(video.date);
    if (manager && week && season) {
      const key = `${week}|${season}`;
      if (!weekCounts[manager]) weekCounts[manager] = {};
      weekCounts[manager][key] = (weekCounts[manager][key] || 0) + playerNames.length;
    }
  });

  // Find max week records
  let maxWeekRecords: { manager: string; week: string; season: string; count: number }[] = [];
  let maxCount = 0;
  Object.entries(weekCounts).forEach(([manager, weeks]) => {
    Object.entries(weeks).forEach(([weekSeason, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxWeekRecords = [{ manager, week: weekSeason.split("|")[0], season: weekSeason.split("|")[1], count }];
      } else if (count === maxCount) {
        maxWeekRecords.push({ manager, week: weekSeason.split("|")[0], season: weekSeason.split("|")[1], count });
      }
    });
  });

  return {
    topManagers: getTopN(managerIcedCount, 3),
    bottomManagers: getBottomN(managerIcedCount, 3),
    topPlayers: getTopN(playerIcedCount, 3),
    maxWeekRecords,
    weekCounts,
  };
}

// =======================
// Filters Calculation Hook
// =======================
export function useFilters(videos: IceVideo[]) {
  const managers = getUnique(videos.map(v => v.manager?.trim()).filter(Boolean)).sort();
  const seasons = getUnique(videos.map(v => v.season ?? getYear(v.date)).filter(Boolean)).sort((a, b) => b.localeCompare(a));
  const players = getUnique(videos.flatMap(v => splitPlayers(v.player))).sort();
  const weeks = Array.from({ length: 17 }, (_, i) => `Week ${i + 1}`);
  return { managers, seasons, players, weeks };
}

// =======================
// Unique Ice Flavors Calculation Hook
// =======================
export function useUniqueFlavors(videos: IceVideo[]) {
  const uniqueFlavors = getUnique(videos.map(video => video.flavor).filter(Boolean));
  return uniqueFlavors.length;
}

// =======================
// Manager with Most Flavors Calculation Hook
// =======================
export function useManagerWithMostFlavors(videos: IceVideo[]): { manager: string; flavorCount: number; flavors: string[] }[] {
  const managerFlavorCount: Record<string, Set<string>> = {};

  videos.forEach(video => {
    const manager = video.manager?.trim();
    const flavor = video.flavor?.trim();
    if (manager && flavor) {
      if (!managerFlavorCount[manager]) {
        managerFlavorCount[manager] = new Set();
      }
      managerFlavorCount[manager].add(flavor);
    }
  });

  const maxFlavorCount = Math.max(...Object.values(managerFlavorCount).map(flavors => flavors.size));

  const managersWithMostFlavors = Object.entries(managerFlavorCount)
    .filter(([, flavors]) => flavors.size === maxFlavorCount)
    .map(([manager, flavors]) => ({ manager, flavorCount: flavors.size, flavors: Array.from(flavors) }));

  return managersWithMostFlavors;
}

// =======================
// Manager with Most Consecutive Weeks Calculation Hook
// =======================
export function useManagerWithMostConsecutiveWeeks(videos: IceVideo[]): { manager: string; consecutiveWeeks: number; weeks: string }[] {
  const managerWeekCounts: Record<string, Set<string>> = {};

  videos.forEach(video => {
    const manager = video.manager?.trim();
    const week = video.week?.trim();
    const season = video.season ?? getYear(video.date);
    if (manager && week && season) {
      const key = `${season}|${week}`;
      if (!managerWeekCounts[manager]) {
        managerWeekCounts[manager] = new Set();
      }
      managerWeekCounts[manager].add(key);
    }
  });

  const streaks: { manager: string; consecutiveWeeks: number; weeks: string }[] = [];

  Object.entries(managerWeekCounts).forEach(([manager, weeksSet]) => {
    const weeksArr = Array.from(weeksSet)
      .map(str => {
        const [season, week] = str.split("|");
        return { season, weekNum: parseInt(week.replace("Week ", "")), weekStr: week };
      })
      .sort((a, b) => a.season.localeCompare(b.season) || a.weekNum - b.weekNum);

    let currentStreak = 1;
    let longestStreak = 1;
    let currentStreakWeeks = [weeksArr[0]];
    let longestStreakWeeks = [...currentStreakWeeks];

    for (let i = 1; i < weeksArr.length; i++) {
      const prev = weeksArr[i - 1];
      const curr = weeksArr[i];
      if (
        curr.season === prev.season &&
        curr.weekNum === prev.weekNum + 1
      ) {
        currentStreak++;
        currentStreakWeeks.push(curr);
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          longestStreakWeeks = [...currentStreakWeeks];
        }
      } else {
        currentStreak = 1;
        currentStreakWeeks = [curr];
      }
    }

    let streakWeeks = "";
    if (longestStreakWeeks.length > 1) {
      const first = longestStreakWeeks[0];
      const last = longestStreakWeeks[longestStreakWeeks.length - 1];
      streakWeeks = `Week ${first.weekNum} - Week ${last.weekNum}, ${first.season}`;
    } else if (longestStreakWeeks.length === 1) {
      const only = longestStreakWeeks[0];
      streakWeeks = `Week ${only.weekNum}, ${only.season}`;
    }

    streaks.push({ manager, consecutiveWeeks: longestStreak, weeks: streakWeeks });
  });

  // Sort and take top 3
  return streaks.sort((a, b) => b.consecutiveWeeks - a.consecutiveWeeks).slice(0, 3);
}

// =======================
// Most Ices in a Single Season Calculation Hook
// =======================
export function useMostIcesInSingleSeason(videos: IceVideo[]) {
  // Map: manager -> season -> count
  const managerSeasonCounts: { manager: string; season: string; count: number }[] = [];
  const countsMap: Record<string, Record<string, number>> = {};

  videos.forEach(video => {
    const manager = video.manager?.trim();
    const season = video.season ?? getYear(video.date);
    const playerCount = splitPlayers(video.player).length;
    if (manager && season) {
      if (!countsMap[manager]) countsMap[manager] = {};
      countsMap[manager][season] = (countsMap[manager][season] || 0) + playerCount;
    }
  });

  Object.entries(countsMap).forEach(([manager, seasons]) => {
    Object.entries(seasons).forEach(([season, count]) => {
      managerSeasonCounts.push({ manager, season, count });
    });
  });

  // Sort and take top 3
  return managerSeasonCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

// =======================
// Most Ices in a Single Week All Teams Calculation Hook
// =======================
export function useMostIcesInSingleWeekAllTeams(videos: IceVideo[]) {
  // Map: season|week -> count
  const weekCounts: Record<string, { season: string; week: string; count: number }> = {};

  videos.forEach(video => {
    const season = video.season ?? getYear(video.date);
    const week = video.week?.trim();
    const playerCount = splitPlayers(video.player).length;
    if (season && week) {
      const key = `${season}|${week}`;
      if (!weekCounts[key]) {
        weekCounts[key] = { season, week, count: 0 };
      }
      weekCounts[key].count += playerCount;
    }
  });

  // Convert to array and sort
  const weekArr = Object.values(weekCounts).sort((a, b) => b.count - a.count);
  return weekArr.slice(0, 3);
}