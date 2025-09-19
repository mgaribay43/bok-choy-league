'use client';

import React from "react";

export default function StatsSection({
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
  mostIcesInSingleWeekAllTeams, // <-- use this prop only
  longestActiveNoIceStreak,
  longestAllTimeNoIceStreaks,
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
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-8">
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
                Most Times Iced in a Single Week
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
                            <div className="font-medium">{rec.manager} - {rec.week}, {rec.season}</div>
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

            {/* Most Ices in a Single Week (All Teams) Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Most Ices in a Single Week
              </h3>
              <div className="space-y-2">
                {(mostIcesInSingleWeekAllTeams ?? []).map((rec: any, index: number) => (
                  <div key={rec.season + rec.week} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-pink-900 text-pink-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <button
                        className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none text-left text-xs sm:text-sm"
                        onClick={() => {
                          setSelectedSeason(rec.season);
                          setSelectedWeek(rec.week);
                          setSelectedManager("All");
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
                          <div className="font-medium">Week {rec.week}, {rec.season}</div>
                        </div>
                      </button>
                    </div>
                    <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                      {rec.count}
                    </span>
                  </div>
                ))}
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
                  .map((record: any, index: number) => (
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
                            <div className="font-medium text-sm">{record.manager} - {record.season}</div>
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

          {/* Fourth Row - Flavor Stats (MOVED BELOW STREAK CARDS) */}

          {/* Longest Active No Ice Streak Card */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
            <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
              Longest No Ice Streak (Active)
            </h3>
            <div className="space-y-2">
              {(longestActiveNoIceStreak ?? []).map((rec: any, index: number) => (
                <div key={rec.manager + rec.streak} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <span className="bg-cyan-900 text-cyan-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-emerald-400">{rec.manager}</span>
                    </div>
                    {rec.start && rec.end && (
                      <div className="text-xs text-emerald-300 ml-8">
                        {rec.start.weekStr} {rec.start.season} - {rec.end.weekStr} {rec.end.season}
                      </div>
                    )}
                  </div>
                  <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                    {rec.streak} week{rec.streak === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Longest All-Time No Ice Streaks Card */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
            <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
              Longest No Ice Streak (All-Time)
            </h3>
            <div className="space-y-2">
              {(longestAllTimeNoIceStreaks ?? []).map((rec: any, index: number) => (
                <div key={rec.manager + rec.streak} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <span className="bg-cyan-900 text-cyan-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-emerald-400">{rec.manager}</span>
                    </div>
                    <div className="text-xs text-emerald-300 ml-8">
                      {rec.start.weekStr} {rec.start.season} - {rec.end.weekStr} {rec.end.season}
                    </div>
                  </div>
                  <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                    {rec.streak} week{rec.streak === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Flavor Stats (now below the streak records) */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 lg:col-span-2">

            {/* Total Unique Flavors Card */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444] flex-1">
              <h3 className="text-emerald-400 font-semibold mb-3 text-center text-sm sm:text-base border-b border-[#444] pb-2">
                Flavors Consumed by League Members
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
                {(() => {
                  const list = Array.isArray(managerWithMostFlavors) ? managerWithMostFlavors : [];
                  if (!list.length) {
                    return <div className="text-emerald-300 text-sm text-center">No data available</div>;
                  }
                  const top = list.reduce(
                    (max: { manager: string; flavorCount: number; flavors: string[] }, cur: any) =>
                      !max || (cur?.flavorCount ?? 0) > (max?.flavorCount ?? 0) ? cur : max,
                    list[0]
                  );
                  const { manager, flavorCount, flavors = [] } = top || {};
                  return (
                    <div key={manager}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-emerald-400">{manager}</span>
                        <span className="text-emerald-200 font-semibold bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                          {flavorCount}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {flavors.map((flavor: string) => {
                          const flavorLower = flavor.toLowerCase();
                          if (flavorLower === "red, white & berry") {
                            return (
                              <span
                                key={flavor}
                                className="px-3 py-1 rounded-full font-bold text-xs"
                                style={{
                                  background: "linear-gradient(90deg, #e53e3e 0%, #fff 50%, #3182ce 100%)",
                                  color: "#353535ff",
                                  border: "1px solid #141414ff",
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
                                  border: "1px solid #ddd",
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
                                  border: "1px solid #ddd",
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
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}