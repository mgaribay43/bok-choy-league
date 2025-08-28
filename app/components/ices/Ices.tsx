'use client';

// =======================
// Imports
// =======================
import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import Image from "next/image";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Listbox } from '@headlessui/react';
import Link from "next/link";

import { getFirestore, collection, getDocs } from "firebase/firestore";

// =======================
// Types
// =======================
type IceVideo = {
  id: string;
  player: string;
  manager: string;
  date: string;
  week?: string;
  season?: string;
  flavor?: string;
  [key: string]: any;
};
type IcesProps = { latestOnly?: boolean; };

// =======================
// Helper Functions
// =======================

// Extract year from date string
const getYear = (date: string) => date?.slice(0, 4) ?? "";

// Get unique values from array
const getUnique = <T,>(arr: T[]) => Array.from(new Set(arr));

// Split player string into array
const splitPlayers = (player: string) => player?.split("+").map(p => p.trim()).filter(Boolean) ?? [];

// Sort seasons descending
const sortSeasons = (seasons: string[]) => [...seasons].sort((a, b) => b.localeCompare(a));

// Get top N from a count map
const getTopN = (map: Record<string, number>, n: number) =>
  Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);

// Get bottom N from a count map
const getBottomN = (map: Record<string, number>, n: number) =>
  Object.entries(map).filter(([_, count]) => count > 0).sort((a, b) => a[1] - b[1]).slice(0, n);

// =======================
// Stats Calculation Hook
// =======================
function useStats(videos: IceVideo[]) {
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
function useFilters(videos: IceVideo[]) {
  const managers = getUnique(videos.map(v => v.manager?.trim()).filter(Boolean)).sort();
  const seasons = getUnique(videos.map(v => v.season ?? getYear(v.date)).filter(Boolean)).sort((a, b) => b.localeCompare(a));
  const players = getUnique(videos.flatMap(v => splitPlayers(v.player))).sort();
  const weeks = Array.from({ length: 17 }, (_, i) => `Week ${i + 1}`);
  return { managers, seasons, players, weeks };
}

// =======================
// Video Card Component
// =======================
function VideoCard({ video, expandedVideo, setExpandedVideo }: {
  video: IceVideo, expandedVideo: string | null, setExpandedVideo: (id: string) => void
}) {
  const videoId = video.id?.trim() ?? "";
  const isExpanded = expandedVideo === videoId;
  return (
    <div className="rounded-xl shadow-lg border border-[#444] flex flex-col items-center p-4 transition-transform hover:-translate-y-1 hover:shadow-emerald-900"
      style={{ backgroundColor: "#272828" }}
    >
      <div className="w-full mb-3">
        {/* Thumbnail or embedded video */}
        {videoId ? (
          !isExpanded ? (
            <Image
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt={`Thumbnail for ${video.player}`}
              width={400}
              height={220}
              className="rounded-lg w-full cursor-pointer"
              style={{ objectFit: "cover" }}
              onClick={() => setExpandedVideo(videoId)}
              loading="lazy"
            />
          ) : (
            <iframe
              width="100%"
              height="220"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`Ice video: ${video.player}`}
              frameBorder="0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg w-full"
            ></iframe>
          )
        ) : (
          <div className="w-full h-[175px] flex items-center justify-center bg-[#232323] rounded-lg text-emerald-400 font-bold text-xl">
            No Video
          </div>
        )}
      </div>
      {/* Player and manager info */}
      <h2 className="text-lg font-bold text-emerald-100 text-center mb-1 w-full">{video.player}</h2>
      <div className="text-sm text-emerald-300 text-center mb-1">
        <span className="font-semibold text-emerald-200">Manager:</span>{" "}
        <Link
          href={`/manager?name=${encodeURIComponent(getManagerKeyFromDisplayName(video.manager))}`}
          className="underline text-emerald-200 hover:text-emerald-400 transition"
        >
          {video.manager}
        </Link>
      </div>
      <div className="flex justify-center gap-2 text-xs text-emerald-400 mb-2">
        {video.week && (
          <span className="bg-emerald-900 text-emerald-100 px-2 py-0.5 rounded-full font-semibold">Week {video.week}</span>
        )}
        <span>{video.date}</span>
      </div>
      {/* Penalty badge */}
      {video["24_hr_penalty"] && (
        <span className="mt-2 px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-xs">24 HR PENALTY</span>
      )}
      {/* Flavor badges */}
      {video.flavor && video.flavor !== "Standard" && (
        video.flavor.toLowerCase() === "red, white & berry" ? (
          <span
            className="mt-2 px-3 py-1 rounded-full font-bold text-xs"
            style={{
              background: "linear-gradient(90deg, #e53e3e 0%, #fff 50%, #3182ce 100%)",
              color: "#353535ff",
              border: "1px solid #141414ff"
            }}
          >
            {video.flavor}
          </span>
        ) : video.flavor.toLowerCase() === "red, white & merry holiday punch" ? (
          <span
            className="mt-2 px-3 py-1 rounded-full font-bold text-xs"
            style={{
              background: "#ab2308",
              color: "#ffffffff",
              border: "1px solid #ddd"
            }}
          >
            {video.flavor}
          </span>
        ) : video.flavor.toLowerCase() === "screwdriver" ? (
          <span
            className="mt-2 px-3 py-1 rounded-full font-bold text-xs"
            style={{
              background: "#ffbc13ff",
              color: "#ffffffff",
              border: "1px solid #ddd"
            }}
          >
            {video.flavor}
          </span>
        ) : (
          <span className="mt-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
            {video.flavor}
          </span>
        )
      )}
    </div>
  );
}

// =======================
// Unique Ice Flavors Calculation Hook
// =======================
function useUniqueFlavors(videos: IceVideo[]) {
  const uniqueFlavors = getUnique(videos.map(video => video.flavor).filter(Boolean));
  return uniqueFlavors.length;
}

// =======================
// Manager with Most Flavors Calculation Hook
// =======================
function useManagerWithMostFlavors(videos: IceVideo[]): { manager: string; flavorCount: number; flavors: string[] }[] {
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
function useManagerWithMostConsecutiveWeeks(videos: IceVideo[]): { manager: string; consecutiveWeeks: number; weeks: string }[] {
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
function useMostIcesInSingleSeason(videos: IceVideo[]) {
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
// Stats Section Component
// =======================
// =======================
// Stats Section Component - Mobile-First Redesign
// =======================
function StatsSection({
  stats,
  handleManagerClick,
  handlePlayerClick,
  setSelectedPlayer,
  setSelectedManager,
  setSelectedSeason,
  setSelectedWeek,
  setSelectedFlavor,
  scrollToVideos,
  scrollToSeason,
  uniqueFlavorsCount,
  managerWithMostFlavors,
  managerWithMostConsecutiveWeeks,
  setCollapsedSeasons,
  mostIcesInSingleSeason,
}: any) {
  return (
    <div className="w-full mb-6">
      <div className="bg-[#232323] rounded-lg p-3 sm:p-6 border border-[#333] w-full">

        {/* Mobile: Single column stack, Desktop: Grid */}
        <div className="flex flex-col space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">

          {/* Top Row - Most/Least Iced Managers */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 lg:col-span-2">

            {/* Top Managers Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Iced Managers
              </h3>
              <div className="space-y-2">
                {stats.topManagers.map(([manager, count]: any, index: number) => (
                  <div key={manager} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-emerald-900 text-emerald-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <button
                        className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left"
                        onClick={() => { handleManagerClick(manager); scrollToVideos(); }}
                      >
                        {manager}
                      </button>
                    </div>
                    <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Managers Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Least Iced Managers
              </h3>
              <div className="space-y-2">
                {stats.bottomManagers.map(([manager, count]: any, index: number) => (
                  <div key={manager} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-900 text-blue-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <button
                        className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left"
                        onClick={() => { handleManagerClick(manager); scrollToVideos(); }}
                      >
                        {manager}
                      </button>
                    </div>
                    <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second Row - Player Stats & Week Records */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 lg:col-span-2">

            {/* Top Players Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Ices by a Player
              </h3>
              <div className="space-y-2">
                {stats.topPlayers.map(([player, count]: any, index: number) => (
                  <div key={player} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-purple-900 text-purple-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <button
                        className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left"
                        onClick={() => { handlePlayerClick(player); scrollToVideos(); }}
                      >
                        {player}
                      </button>
                    </div>
                    <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Ices in a Single Week Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Ices in a Single Week
              </h3>
              <div className="space-y-2">
                {(() => {
                  // Flatten all week records
                  const allRecords = Object.entries(stats.weekCounts as Record<string, Record<string, number>>)
                    .flatMap(([manager, weeks]) =>
                      Object.entries(weeks)
                        .map(([weekSeason, count]) => ({
                          manager,
                          week: weekSeason.split("|")[0],
                          season: weekSeason.split("|")[1],
                          count,
                          weekSeason,
                        }))
                    )
                    .sort((a, b) => b.count - a.count || b.season.localeCompare(a.season)); // Sort by count, then most recent season

                  // Deduplicate managers, keeping only their most recent record for each count
                  const seenManagers = new Set<string>();
                  const seenCounts = new Set<number>();
                  const uniqueRecords: typeof allRecords = [];
                  for (const rec of allRecords) {
                    if (!seenManagers.has(rec.manager)) {
                      uniqueRecords.push(rec);
                      seenManagers.add(rec.manager);
                      seenCounts.add(rec.count);
                    } else if (!seenCounts.has(rec.count)) {
                      uniqueRecords.push(rec);
                      seenCounts.add(rec.count);
                    }
                    if (uniqueRecords.length === 3) break;
                  }

                  return uniqueRecords.map((rec, index) => (
                    <div key={rec.manager + rec.weekSeason + index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="bg-orange-900 text-orange-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <button
                          className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left text-xs sm:text-sm"
                          onClick={() => {
                            setSelectedSeason(rec.season);
                            setSelectedWeek(rec.week);
                            setSelectedManager(rec.manager);
                            setSelectedPlayer("All");
                            setSelectedFlavor("All");
                            scrollToSeason(rec.season);
                            setCollapsedSeasons((prev: Record<string, boolean>) => {
                              const expanded: Record<string, boolean> = {};
                              Object.keys(prev).forEach(season => {
                                expanded[season] = false;
                              });
                              return expanded;
                            });
                            setTimeout(scrollToVideos, 100);
                          }}
                        >
                          <div className="truncate">
                            <div className="font-medium">{rec.manager} {rec.week}, {rec.season}</div>
                          </div>
                        </button>
                      </div>
                      <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                        {rec.count}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Third Row - Season & Consecutive Records */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 lg:col-span-2">

            {/* Most Consecutive Weeks Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Consecutive Weeks
              </h3>
              <div className="space-y-2">
                {managerWithMostConsecutiveWeeks
                  .sort((a: { consecutiveWeeks: number; }, b: { consecutiveWeeks: number; }) => b.consecutiveWeeks - a.consecutiveWeeks)
                  .slice(0, 3)
                  .map((record: { manager: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; weeks: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; consecutiveWeeks: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, index: number) => (
                    <div key={`${record.manager ?? ""}_${record.weeks ?? ""}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="bg-yellow-900 text-yellow-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <button
                          className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left"
                          onClick={() => {
                            setSelectedManager(record.manager);
                            const match = typeof record.weeks === "string" ? record.weeks.match(/Week (\d+)(?: - Week (\d+))?, (\d{4})/) : null;
                            if (match) {
                              setSelectedSeason(match[3]);
                              setSelectedWeek("All");
                            } else {
                              setSelectedSeason("All");
                              setSelectedWeek("All");
                            }
                            setSelectedPlayer("All");
                            setSelectedFlavor("All");
                            scrollToVideos();
                          }}
                        >
                          <div className="font-medium text-sm">{record.manager} {record.weeks}</div>
                        </button>
                      </div>
                      <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                        {record.consecutiveWeeks}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Most Ices in Single Season Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Ices in a Single Season
              </h3>
              <div className="space-y-2">
                {mostIcesInSingleSeason
                  .sort((a: { count: number; }, b: { count: number; }) => b.count - a.count)
                  .slice(0, 3)
                  .map(
                    (record: { manager: string; season: string; count: number }, index: number) => (
                      <div key={record.manager + record.season} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="bg-red-900 text-red-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <button
                            className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left"
                            onClick={() => {
                              setSelectedManager(record.manager);
                              setSelectedSeason(record.season);
                              setSelectedPlayer("All");
                              setSelectedWeek("All");
                              setSelectedFlavor("All");
                              scrollToVideos();
                            }}
                          >
                            <div className="font-medium text-sm">{record.manager} {record.season}</div>
                          </button>
                        </div>
                        <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                          {record.count}
                        </span>
                      </div>
                    )
                  )}
              </div>
            </div>
          </div>

          {/* Fourth Row - Flavor Stats */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 lg:col-span-2">

            {/* Total Unique Flavors Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Total Unique Flavors Consumed
              </h3>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-emerald-400 mb-1">{uniqueFlavorsCount}</div>
                <div className="text-emerald-300 text-xs">Different flavors</div>
              </div>
            </div>

            {/* Most Flavors Consumed Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Flavors Consumed
              </h3>
              <div className="space-y-3">
                {managerWithMostFlavors.map(({ manager, flavorCount, flavors }: { manager: string; flavorCount: number; flavors: string[] }) => (
                  <div key={manager}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-emerald-400">{manager}</span>
                      <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                        {flavorCount}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {flavors.map(flavor => {
                        // Use the same flavor badge logic as VideoCard
                        const flavorLower = flavor.toLowerCase();
                        if (flavorLower === "red, white & berry") {
                          return (
                            <span
                              key={flavor}
                              className="px-3 py-1 rounded-full font-bold text-xs"
                              style={{
                                background: "linear-gradient(90deg, #e53e3e 0%, #fff 50%, #3182ce 100%)",
                                color: "#353535ff",
                                border: "1px solid #141414ff"
                              }}
                            >
                              {flavor}
                            </span>
                          );
                        } else if (flavorLower === "red, white & merry holiday punch") {
                          return (
                            <span
                              key={flavor}
                              className="px-3 py-1 rounded-full font-bold text-xs"
                              style={{
                                background: "#ab2308",
                                color: "#ffffffff",
                                border: "1px solid #ddd"
                              }}
                            >
                              {flavor}
                            </span>
                          );
                        } else if (flavorLower === "screwdriver") {
                          return (
                            <span
                              key={flavor}
                              className="px-3 py-1 rounded-full font-bold text-xs"
                              style={{
                                background: "#ffbc13ff",
                                color: "#ffffffff",
                                border: "1px solid #ddd"
                              }}
                            >
                              {flavor}
                            </span>
                          );
                        } else {
                          return (
                            <span
                              key={flavor}
                              className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs"
                            >
                              {flavor}
                            </span>
                          );
                        }
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// =======================
// Filters Section Component
// =======================
function FiltersSection({
  filters,
  selectedManager,
  setSelectedManager,
  selectedSeason,
  setSelectedSeason,
  selectedPlayer,
  setSelectedPlayer,
  selectedWeek,
  setSelectedWeek,
  selectedFlavor,
  setSelectedFlavor,
  showPenaltyOnly,
  setShowPenaltyOnly,
  handleResetFilters,
  filtersExpanded,
  videos,
}: {
  filters: any;
  selectedManager: string;
  setSelectedManager: (v: string) => void;
  selectedSeason: string;
  setSelectedSeason: (v: string) => void;
  selectedPlayer: string;
  setSelectedPlayer: (v: string) => void;
  selectedWeek: string;
  setSelectedWeek: (v: string) => void;
  selectedFlavor: string;
  setSelectedFlavor: (v: string) => void;
  showPenaltyOnly: boolean;
  setShowPenaltyOnly: (v: boolean) => void;
  handleResetFilters: () => void;
  filtersExpanded: boolean;
  videos: IceVideo[];
}) {
  // --- Mobile Reset Button ---
  const ResetBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      type="button"
      className="sm:hidden ml-2 mt-0 px-3 py-1 rounded-lg text-xs bg-[#333] text-emerald-200 hover:bg-[#444] border border-[#333] flex items-center"
      onClick={onClick}
      aria-label="Reset"
      title="Reset"
      style={{ minHeight: '35px' }}
    >
      ⟲
    </button>
  );

  // --- Dynamic Week Options ---
  let weekOptions: string[] = [];
  if (selectedSeason !== "All") {
    let filtered = videos.filter(v => (v.season ?? getYear(v.date)) === selectedSeason);
    if (selectedManager !== "All") {
      filtered = filtered.filter(v => v.manager?.trim() === selectedManager);
    }
    if (selectedPlayer !== "All") {
      filtered = filtered.filter(v => splitPlayers(v.player).includes(selectedPlayer));
    }
    weekOptions = getUnique(filtered.map(v => v.week?.trim()).filter((w): w is string => !!w)).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
      return numA - numB;
    });
  }

  // --- Dynamic Player Options ---
  let playerOptions: string[] = [];
  let filteredForPlayers = videos;
  if (selectedSeason !== "All") {
    filteredForPlayers = filteredForPlayers.filter(v => (v.season ?? getYear(v.date)) === selectedSeason);
  }
  if (selectedManager !== "All") {
    filteredForPlayers = filteredForPlayers.filter(v => v.manager?.trim() === selectedManager);
  }
  if (selectedWeek !== "All") {
    filteredForPlayers = filteredForPlayers.filter(v => v.week?.trim() === selectedWeek);
  }
  playerOptions = getUnique(filteredForPlayers.flatMap(v => splitPlayers(v.player))).sort();

  // --- Dynamic Manager Options ---
  let managerOptions: string[] = [];
  if (selectedPlayer !== "All") {
    managerOptions = getUnique(
      videos
        .filter(v => splitPlayers(v.player).includes(selectedPlayer))
        .map(v => v.manager?.trim())
        .filter(Boolean)
    ).sort();
  } else {
    managerOptions = filters.managers;
  }

  // --- Dynamic Flavor Options ---
  const flavorOptions = getUnique(videos.map(v => v.flavor).filter(Boolean)).sort();

  // --- Listbox Option Render Helper ---
  const renderOptions = (options: string[]) =>
    options.map(option => (
      <Listbox.Option
        key={option}
        value={option}
        className={({ active }) =>
          `cursor-pointer select-none px-3 py-2 ${active ? "bg-emerald-100 text-emerald-700" : "text-emerald-200"}`
        }
      >
        {option}
      </Listbox.Option>
    ));

  // --- Dropdown Wrapper ---
  const Dropdown = ({
    label,
    value,
    onChange,
    options,
    disabled = false,
    grayOut = false,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    disabled?: boolean;
    grayOut?: boolean;
  }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
      <div className="flex flex-col sm:mr-6 items-start mb-2 ml-2 sm:mb-0 sm:w-48">
        {/* --- Dropdown label --- */}
        <label
          className={`block text-xs font-semibold mb-1 sm:mb-0 ${grayOut ? "text-emerald-300" : "text-emerald-200"}`}
        >
          {label}
        </label>
        <div className="flex flex-row items-center w-full">
          <div className="flex-1 relative">
            <Listbox value={value} onChange={onChange} disabled={disabled} as="div">
              {({ open }) => (
                <>
                  <Listbox.Button
                    ref={buttonRef}
                    className={`w-full px-3 py-2 rounded-lg border border-[#333] bg-[#0f0f0f] text-emerald-400 text-left ${grayOut ? "bg-gray-800 text-emerald-300 cursor-not-allowed" : ""
                      }`}
                    style={{ minHeight: '40px' }}
                  >
                    {value}
                  </Listbox.Button>
                  {open &&
                    ReactDOM.createPortal(
                      <Listbox.Options
                        className="absolute w-48 bg-[#0f0f0f] border border-[#333] rounded-lg shadow-lg z-[99999] max-h-60 overflow-y-auto"
                        style={{
                          left: buttonRef.current
                            ? buttonRef.current.getBoundingClientRect().left
                            : undefined,
                          top: buttonRef.current
                            ? buttonRef.current.getBoundingClientRect().bottom + window.scrollY
                            : undefined,
                          position: "absolute",
                        }}
                      >
                        {renderOptions(options)}
                      </Listbox.Options>,
                      document.body
                    )
                  }
                </>
              )}
            </Listbox>
          </div>
          <ResetBtn onClick={() => onChange("All")} />
        </div>
      </div>
    );
  };

  // --- Render Filter Dropdowns ---
  return (
    <div className={`overflow-hidden transition-all duration-500 ease-in-out w-full justify-center mb-2 gap-3
      ${filtersExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}
      sm:max-h-none sm:opacity-100 sm:flex sm:flex-row flex-col`}
      style={{ transitionProperty: "max-height, opacity" }}
    >
      <Dropdown
        label="Manager"
        value={selectedManager}
        onChange={setSelectedManager}
        options={["All", ...managerOptions]}
      />
      <Dropdown
        label="Season"
        value={selectedSeason}
        onChange={setSelectedSeason}
        options={["All", ...filters.seasons]}
      />
      <Dropdown
        label="Week"
        value={selectedWeek}
        onChange={setSelectedWeek}
        options={["All", ...(selectedSeason !== "All" ? weekOptions : [])]}
        disabled={selectedSeason === "All"}
        grayOut={selectedSeason === "All"}
      />
      <Dropdown
        label="Player"
        value={selectedPlayer}
        onChange={setSelectedPlayer}
        options={["All", ...playerOptions]}
      />
      <Dropdown
        label="Flavor"
        value={selectedFlavor}
        onChange={setSelectedFlavor}
        options={["All", ...flavorOptions.filter((f): f is string => typeof f === "string")]}
      />
      {/* Penalty filter */}
      <div className="w-full sm:w-auto flex justify-center sm:items-end mt-2 sm:mt-0 mb-3">
        <div className="flex flex-row sm:flex-row items-center justify-center">
          <input type="checkbox" id="penalty-filter" checked={showPenaltyOnly} onChange={e => setShowPenaltyOnly(e.target.checked)} className="accent-red-600" />
          <label htmlFor="penalty-filter" className="text-xs font-semibold text-red-700 ml-1">Penalty Ices</label>
        </div>
      </div>
      {/* Reset filters button */}
      <div className="sm:w-auto flex justify-center sm:items-end mt-2 mb-1.5 sm:mt-0">
        <div className="sm:flex-row items-center justify-center">
          <button
            className="bg-[#333] text-emerald-200 px-3 py-2.5 rounded text-xs hover:bg-[#444] whitespace-nowrap border border-[#333]"
            onClick={() => handleFullReset(
              setSelectedManager,
              setSelectedSeason,
              setSelectedPlayer,
              setSelectedWeek,
              setSelectedFlavor,
              setShowPenaltyOnly
            )}
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// =======================
// Main Ices Component
// =======================
export default function Ices({ latestOnly = false }: IcesProps) {
  // --- State ---
  const [videos, setVideos] = useState<IceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedManager, setSelectedManager] = useState<string>("All");
  const [selectedSeason, setSelectedSeason] = useState<string>("All");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("All");
  const [selectedWeek, setSelectedWeek] = useState<string>("All");
  const [selectedFlavor, setSelectedFlavor] = useState<string>("All");
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [collapsedSeasons, setCollapsedSeasons] = useState<Record<string, boolean>>({});
  const [showPenaltyOnly, setShowPenaltyOnly] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Refs for scrolling
  const videosSectionRef = useRef<HTMLDivElement>(null);
  const seasonRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // --- Load videos from Firestore ---
  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const db = getFirestore();
        const querySnapshot = await getDocs(collection(db, "Ices"));
        const allVideos: IceVideo[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // If the document has an 'entries' array (year doc), flatten it
          if (Array.isArray(data.entries)) {
            data.entries.forEach((video: IceVideo) => {
              if (video.date) {
                allVideos.push({ ...video, season: doc.id });
              }
            });
          } else {
            // If the document is a single video object
            if (data.date) {
              allVideos.push({
                ...data, season: data.season ?? doc.id,
                id: "",
                player: "",
                manager: "",
                date: ""
              });
            }
          }
        });
        setVideos(allVideos);
      } catch (err) {
        setError("Failed to load videos from Firestore.");
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  // --- Filters and Stats ---
  const filters = useFilters(videos);
  const stats = useStats(videos);
  const uniqueFlavorsCount = useUniqueFlavors(videos);
  const managerWithMostFlavors = useManagerWithMostFlavors(videos);
  const managerWithMostConsecutiveWeeksArr = useManagerWithMostConsecutiveWeeks(videos);
  const mostIcesInSingleSeason = useMostIcesInSingleSeason(videos);

  // --- Filtering Logic ---
  const filterVideo = (video: IceVideo) => {
    const managerMatch = selectedManager === "All" || video.manager?.trim() === selectedManager;
    const seasonMatch = selectedSeason === "All" || (video.season ?? getYear(video.date)) === selectedSeason;
    const playerNames = splitPlayers(video.player);
    const playerMatch = selectedPlayer === "All" || playerNames.includes(selectedPlayer);
    const weekMatch = selectedWeek === "All" || video.week?.trim() === selectedWeek;
    const flavorMatch = selectedFlavor === "All" || video.flavor?.trim() === selectedFlavor;
    const penaltyMatch = !showPenaltyOnly || !!video["24_hr_penalty"];
    return managerMatch && seasonMatch && playerMatch && weekMatch && flavorMatch && penaltyMatch;
  };

  let filteredVideos = videos.filter(filterVideo);
  if (latestOnly && filteredVideos.length > 0) {
    filteredVideos = filteredVideos.sort((a, b) => {
      const dateA = new Date(a.date.replace(/-/g, '/')).getTime();
      const dateB = new Date(b.date.replace(/-/g, '/')).getTime();
      return dateB - dateA;
    }).slice(0, 1);
  }

  // For rendering
  const renderVideos = latestOnly ? filteredVideos : videos.filter(filterVideo);

  // --- Group videos by season ---
  const videosBySeason: Record<string, IceVideo[]> = {};
  videos.forEach(video => {
    const season = video.season ?? getYear(video.date);
    if (!season) return;
    if (!videosBySeason[season]) videosBySeason[season] = [];
    videosBySeason[season].push(video);
  });
  const sortedSeasons = sortSeasons(Object.keys(videosBySeason));

  // --- Handlers ---
  const handleManagerClick = (manager: string) => {
    setSelectedManager(manager);
    setSelectedSeason("All");
    setSelectedPlayer("All");
    setSelectedWeek("All");
    setSelectedFlavor("All");
    setShowPenaltyOnly(false);
    setCollapsedSeasons({});
  };
  const handlePlayerClick = (player: string) => {
    setSelectedPlayer(player);
    setSelectedManager("All");
    setSelectedSeason("All");
    setSelectedWeek("All");
    setSelectedFlavor("All");
    setShowPenaltyOnly(false);
    setCollapsedSeasons({});
  };
  const handleResetFilters = () => {
    setSelectedPlayer("All"); setSelectedManager("All"); setSelectedSeason("All"); setSelectedWeek("All"); setShowPenaltyOnly(false); setSelectedFlavor("All");
  };
  const scrollToSeason = (season: string) => {
    seasonRefs.current[season]?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToVideos = () => {
    videosSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // =======================
  // Render
  // =======================
  return (
    <>
      <div className={latestOnly ? "w-full flex flex-col items-center bg-[#0f0f0f]" : "min-h-screen flex flex-col items-center bg-[#0f0f0f]"}>
        {/* Header and Stats */}
        {latestOnly ? (
          <button
            onClick={() => window.location.href = '/ices'}
            className="text-5xl font-extrabold mt-6 text-center hover:underline transition"
            style={{ cursor: "pointer", color: "#a7f3d0" }}
          >
            Latest Ice
          </button>
        ) : (
          <div className="w-full bg-[#232323] border-b border-[#444]">
            <div className="max-w-3xl mx-auto px-4 py-2 flex flex-col items-center">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-emerald-100 mb-2 text-center">Ices</h1>
              <div className="w-full">
                {/* Mobile toggle button for stats */}
                <button
                  className="sm:hidden w-full flex items-center justify-center bg-[#232323] border border-[#444] rounded-lg px-4 py-2 mb-2 font-bold text-emerald-100 text-lg"
                  onClick={() => setStatsExpanded(prev => !prev)}
                  aria-expanded={statsExpanded}
                >
                  <span>{statsExpanded ? "Hide Records" : "Show Records"}</span>
                  <span className="ml-2">{statsExpanded ? <ChevronUp /> : <ChevronDown />}</span>
                </button>
                {/* Stats Section: always visible on desktop, collapsible on mobile */}
                <div
                  className={`transition-all duration-500 ease-in-out w-full overflow-hidden
                  ${statsExpanded || typeof window === "undefined" || window.innerWidth >= 640 ? "h-auto opacity-100" : "h-0 opacity-0"} sm:h-auto sm:opacity-100`}
                  style={{ transitionProperty: "height, opacity", marginBottom: (statsExpanded || typeof window === "undefined" || window.innerWidth >= 640) ? "20px" : "0" }}
                >
                  <StatsSection
                    stats={stats}
                    handleManagerClick={handleManagerClick}
                    handlePlayerClick={handlePlayerClick}
                    setSelectedManager={setSelectedManager}
                    setSelectedSeason={setSelectedSeason}
                    setSelectedWeek={setSelectedWeek}
                    setSelectedPlayer={setSelectedPlayer}
                    setSelectedFlavor={setSelectedFlavor}
                    scrollToVideos={scrollToVideos}
                    scrollToSeason={scrollToSeason}
                    uniqueFlavorsCount={uniqueFlavorsCount}
                    managerWithMostFlavors={managerWithMostFlavors}
                    managerWithMostConsecutiveWeeks={managerWithMostConsecutiveWeeksArr}
                    setCollapsedSeasons={setCollapsedSeasons}
                    mostIcesInSingleSeason={mostIcesInSingleSeason}
                  />
                </div>
              </div>
              {/* Filters Section */}
              <FiltersSection
                filters={filters}
                selectedManager={selectedManager}
                setSelectedManager={setSelectedManager}
                selectedSeason={selectedSeason}
                setSelectedSeason={setSelectedSeason}
                selectedPlayer={selectedPlayer}
                setSelectedPlayer={setSelectedPlayer}
                setSelectedFlavor={setSelectedFlavor}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                selectedFlavor={selectedFlavor}
                showPenaltyOnly={showPenaltyOnly}
                setShowPenaltyOnly={setShowPenaltyOnly}
                handleResetFilters={handleResetFilters}
                filtersExpanded={filtersExpanded}
                videos={videos}
              />
              {/* Mobile filters toggle button */}
              <button
                className="sm:hidden w-full flex items-center justify-center bg-[#232323] border border-[#444] rounded-lg px-4 py-2 mb-2 font-bold text-emerald-100 text-base transition-all duration-300"
                onClick={() => setFiltersExpanded(prev => !prev)}
                aria-expanded={filtersExpanded}
              >
                <span>{filtersExpanded ? "Hide Filters" : "Show Filters"}</span>
              </button>
            </div>
          </div>
        )}
        {/* Main Videos Section */}
        <main
          ref={videosSectionRef}
          className={latestOnly
            ? "w-full max-w-4xl px-2 sm:px-6 py-4 pb-24 flex flex-col items-center"
            : "w-full max-w-4xl px-2 sm:px-6 py-8 pb-24 flex flex-col items-center"}
        >
          {/* Loading/Error/No Results */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              </div>
            </div>
          ) : error ? (
            <p className="text-center text-red-500 text-lg mt-10">{error}</p>
          ) : renderVideos.length === 0 ? (
            <p className="text-center text-slate-500 text-lg mt-10">No videos found for this filter.</p>
          ) : latestOnly ? (
            renderVideos.map((video, idx) => (
              <VideoCard key={video.id?.trim() + idx} video={video} expandedVideo={expandedVideo} setExpandedVideo={setExpandedVideo} />
            ))
          ) : (
            <div className="w-full">
              {/* Render videos grouped by season */}
              {sortedSeasons.map(season => {
                const seasonVideos = videosBySeason[season].filter(filterVideo);
                if (seasonVideos.length === 0) return null;
                const isCollapsed = collapsedSeasons[season] ?? false;
                return (
                  <div
                    key={season}
                    className="mb-2"
                    ref={el => { seasonRefs.current[season] = el; }}
                  >
                    {/* Season header with collapse toggle */}
                    <button className="w-full flex items-center justify-between bg-[#232323] border border-[#444] rounded-lg px-4 py-2 mb-1 font-bold text-emerald-100 text-lg transition hover:bg-[#333]"
                      onClick={() => setCollapsedSeasons(prev => ({ ...prev, [season]: !prev[season] }))}>
                      <span>{season}</span>
                      <span className="ml-2">{isCollapsed ? "▼" : "▲"}</span>
                    </button>
                    {/* Collapsible season videos */}
                    <SeasonCollapse
                      isCollapsed={isCollapsed}
                      videos={seasonVideos}
                      expandedVideo={expandedVideo}
                      setExpandedVideo={setExpandedVideo}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      {/* Footer */}
      {!latestOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center text-yellow-800 text-sm font-medium">
          All videos are unlisted on YouTube and only viewable to those who possess the link. (i.e. us)
        </div>
      )}
    </>
  );
}

// =======================
// Season Collapse Component
// =======================
function SeasonCollapse({ isCollapsed, videos, expandedVideo, setExpandedVideo }: {
  isCollapsed: boolean;
  videos: IceVideo[];
  expandedVideo: string | null;
  setExpandedVideo: (id: string) => void;
}) {
  const collapseRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const collapseEl = collapseRef.current;
    const gridEl = gridRef.current;
    if (!collapseEl || !gridEl) return;

    // Function to update maxHeight based on grid content
    const updateHeight = () => {
      if (!isCollapsed) {
        collapseEl.style.maxHeight = gridEl.scrollHeight + "px";
      }
    };

    // Set initial height
    if (!isCollapsed) {
      collapseEl.style.maxHeight = gridEl.scrollHeight + "px";
    } else {
      collapseEl.style.maxHeight = "0px";
    }

    // Observe grid for size changes
    let resizeObserver: ResizeObserver | null = null;
    if (!isCollapsed) {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(gridEl);
    }

    // Cleanup
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [isCollapsed, videos.length, expandedVideo]);

  return (
    <div
      ref={collapseRef}
      className={`overflow-hidden transition-all duration-500 ease-in-out w-full ${!isCollapsed ? "opacity-100" : "opacity-0"}`}
      style={{ transitionProperty: "max-height, opacity", marginBottom: "32px", minHeight: "1px" }}
    >
      <div
        ref={gridRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
      >
        {[...videos].reverse().map((video, idx) =>
          <VideoCard key={video.id?.trim() + idx} video={video} expandedVideo={expandedVideo} setExpandedVideo={setExpandedVideo} />
        )}
      </div>
    </div>
  );
}

// Add this function above your FiltersSection definition:
function handleFullReset(
  setSelectedManager: (v: string) => void,
  setSelectedSeason: (v: string) => void,
  setSelectedPlayer: (v: string) => void,
  setSelectedWeek: (v: string) => void,
  setSelectedFlavor: (v: string) => void,
  setShowPenaltyOnly: (v: boolean) => void
) {
  setSelectedManager("All");
  setSelectedSeason("All");
  setSelectedPlayer("All");
  setSelectedWeek("All");
  setSelectedFlavor("All");
  setShowPenaltyOnly(false);
}

// Add this reverse lookup helper:
function getManagerKeyFromDisplayName(displayName: string): string {
  if (displayName === "Harris") return "Jacob";
  if (displayName === "Hughes") return "jake.hughes275";
  if (displayName === "Johnny") return "johnny5david";
  if (displayName === "Zach") return "Zachary";
  if (displayName === "Mike") return "Michael";
  return displayName;
}