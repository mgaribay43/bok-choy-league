import { getBottomN, getTopN, getUnique, getYear, splitPlayers } from "../utils/helpers";
import { useMemo } from "react";

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
  return useMemo(() => {
    const byManager = new Map<string, { keys: Set<string>; display: Map<string, string> }>();

    for (const v of videos) {
      const manager = (v.manager || "").trim();
      const flavorRaw = (v.flavor || "").trim();
      if (!manager || !flavorRaw) continue; // count only if a flavor is present (now includes "Standard")

      const key = flavorRaw.toLowerCase();
      if (!byManager.has(manager)) byManager.set(manager, { keys: new Set(), display: new Map() });
      const bucket = byManager.get(manager)!;

      bucket.keys.add(key);
      if (!bucket.display.has(key)) bucket.display.set(key, flavorRaw); // keep first-cased label
    }

    const rows = Array.from(byManager.entries()).map(([manager, { keys, display }]) => ({
      manager,
      flavorCount: keys.size,
      flavors: Array.from(keys).map(k => display.get(k) || k),
    }));

    // Sort: most flavors desc, then alpha
    rows.sort((a, b) => b.flavorCount - a.flavorCount || a.manager.localeCompare(b.manager));
    return rows;
  }, [videos]);
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

// =======================
// Longest Active No-Ice Streak Calculation Hook
// =======================
export function useLongestActiveNoIceStreak(
  videos: IceVideo[],
  currentSeason: string,
  currentWeek: number
) {
  const allSeasons = Array.from(new Set(videos.map(v => v.season))).filter(Boolean).sort();

  // Build all season/week pairs for 17 weeks per season, but only up to the previous week for the current season
  const allSeasonWeeks: { season: string; weekNum: number }[] = [];
  allSeasons.forEach((season, idx) => {
    if (season === currentSeason) {
      if (currentWeek > 1) {
        for (let weekNum = 1; weekNum < currentWeek; weekNum++) {
          allSeasonWeeks.push({ season, weekNum });
        }
      } else if (currentWeek === 1 && idx > 0) {
        // If current week is 1, include week 17 of previous season
        const prevSeason = allSeasons[idx - 1];
        if (prevSeason) {
          for (let weekNum = 1; weekNum <= 17; weekNum++) {
            allSeasonWeeks.push({ season: prevSeason, weekNum });
          }
        }
      }
    } else if (season && season < currentSeason) {
      for (let weekNum = 1; weekNum <= 17; weekNum++) {
        allSeasonWeeks.push({ season, weekNum });
      }
    }
  });

  // For each manager, build a Set of iced weeks as `${season}|${weekNum}` (only weeks 1-17)
  const allManagers = Array.from(new Set(videos.map(v => v.manager).filter(Boolean)));
  const icedWeeksByManager: Record<string, Set<string>> = {};
  allManagers.forEach(manager => {
    icedWeeksByManager[manager] = new Set(
      videos
        .filter(v =>
          v.manager === manager &&
          v.season &&
          v.week &&
          (() => {
            const num = parseInt(v.week.replace(/[^\d]/g, ""), 10);
            return num >= 1 && num <= 17;
          })()
        )
        .map(v => v.week ? `${v.season}|${parseInt(v.week.replace(/[^\d]/g, ""), 10)}` : "")
        .filter(Boolean)
    );
  });

  // For each manager, find their longest *active* streak (ending at the last included week)
  const streaks: {
    manager: string;
    streak: number;
    start: { season: string; weekNum: number; weekStr: string };
    end: { season: string; weekNum: number; weekStr: string };
  }[] = [];

  allManagers.forEach(manager => {
    let currentStreak = 0;
    let streakStart: { season: string; weekNum: number } | null = null;
    let streakEnd: { season: string; weekNum: number } | null = null;

    for (let i = 0; i < allSeasonWeeks.length; i++) {
      const sw = allSeasonWeeks[i];
      const key = `${sw.season}|${sw.weekNum}`;
      if (!icedWeeksByManager[manager].has(key)) {
        if (currentStreak === 0) streakStart = sw;
        currentStreak++;
        streakEnd = sw;
      } else {
        currentStreak = 0;
        streakStart = null;
        streakEnd = null;
      }
    }

    // Only include if the streak ends at the last included week
    if (
      currentStreak > 0 &&
      streakEnd &&
      streakStart &&
      (
        // If current week > 1, streak must end at week currentWeek-1 of current season
        (currentWeek > 1 && streakEnd.season === currentSeason && streakEnd.weekNum === currentWeek - 1) ||
        // If current week == 1, streak must end at week 17 of previous season
        (currentWeek === 1 && allSeasons.indexOf(currentSeason) > 0 &&
          streakEnd.season === allSeasons[allSeasons.indexOf(currentSeason) - 1] && streakEnd.weekNum === 17)
      )
    ) {
      streaks.push({
        manager,
        streak: currentStreak,
        start: { ...streakStart, weekStr: `Week ${streakStart.weekNum}` },
        end: { ...streakEnd, weekStr: `Week ${streakEnd.weekNum}` },
      });
    }
  });

  // Sort by streak descending, return top 3
  return streaks.sort((a, b) => b.streak - a.streak).slice(0, 3);
}

// =======================
// Longest Active All-Time No-Ice Streaks Calculation Hook
// =======================
export function useLongestAllTimeNoIceStreaks(videos: IceVideo[], currentWeek: number) {
  // 1. Get all unique seasons
  const allSeasons = Array.from(new Set(videos.map(v => v.season))).filter((s): s is string => typeof s === "string").sort();

  // 2. Build all season/week pairs for 17 weeks per season, but only up to currentWeek for the current season
  const allSeasonWeeks: { season: string; weekNum: number }[] = [];
  allSeasons.forEach(season => {
    const maxWeek = (season === allSeasons[allSeasons.length - 1]) ? currentWeek : 17;
    for (let weekNum = 1; weekNum <= maxWeek; weekNum++) {
      allSeasonWeeks.push({ season, weekNum });
    }
  });

  // 3. For each manager, build a Set of iced weeks as `${season}|${weekNum}` (only weeks 1-17)
  const allManagers = Array.from(new Set(videos.map(v => v.manager).filter(Boolean)));
  const icedWeeksByManager: Record<string, Set<string>> = {};
  allManagers.forEach(manager => {
    icedWeeksByManager[manager] = new Set(
      videos
        .filter(v => 
          v.manager === manager &&
          v.season &&
          v.week &&
          (() => {
            const num = parseInt(v.week.replace(/[^\d]/g, ""), 10);
            return num >= 1 && num <= 17;
          })()
        )
        .map(v => `${v.season}|${parseInt((v.week ?? "").replace(/[^\d]/g, ""), 10)}`)
    );
  });

  // 4. For each manager, iterate through all weeks, tracking the longest streak
  const streaks: {
    manager: string;
    streak: number;
    start: { season: string; weekNum: number };
    end: { season: string; weekNum: number };
  }[] = [];

  allManagers.forEach(manager => {
    let maxStreak = 0;
    let currentStreak = 0;
    let streakStart: { season: string; weekNum: number } | null = null;
    let streakEnd: { season: string; weekNum: number } | null = null;
    let bestStart: { season: string; weekNum: number } | null = null;
    let bestEnd: { season: string; weekNum: number } | null = null;

    allSeasonWeeks.forEach(sw => {
      const key = `${sw.season}|${sw.weekNum}`;
      if (!icedWeeksByManager[manager].has(key)) {
        if (currentStreak === 0) streakStart = sw;
        currentStreak++;
        streakEnd = sw;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          bestStart = streakStart!;
          bestEnd = streakEnd!;
        }
      } else {
        currentStreak = 0;
        streakStart = null;
        streakEnd = null;
      }
    });

    if (maxStreak > 0 && bestStart && bestEnd) {
      streaks.push({ manager, streak: maxStreak, start: bestStart, end: bestEnd });
    }
  });

  // 5. Sort by streak descending, return top 3, and add weekStr for display
  return streaks
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3)
    .map(rec => ({
      ...rec,
      start: { ...rec.start, weekStr: `Week ${rec.start.weekNum}` },
      end: { ...rec.end, weekStr: `Week ${rec.end.weekNum}` },
    }));
}