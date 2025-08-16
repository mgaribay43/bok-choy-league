'use client';

import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import Image from "next/image";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Listbox } from '@headlessui/react';

// --- Types ---
type IceVideo = {
  id: string;
  player: string;
  manager: string;
  date: string;
  week?: string;
  season?: string;
  [key: string]: any;
};
type IcesProps = { latestOnly?: boolean; };

// --- Helpers ---
const getYear = (date: string) => date?.slice(0, 4) ?? "";
const getUnique = <T,>(arr: T[]) => Array.from(new Set(arr));
const splitPlayers = (player: string) => player?.split("+").map(p => p.trim()).filter(Boolean) ?? [];
const sortSeasons = (seasons: string[]) => [...seasons].sort((a, b) => b.localeCompare(a));
const sortVideosByWeek = (videos: IceVideo[]) => [...videos].sort((a, b) => {
  if (a.week && b.week) {
    const weekA = parseInt(a.week.replace(/[^0-9]/g, ""), 10);
    const weekB = parseInt(b.week.replace(/[^0-9]/g, ""), 10);
    return weekB - weekA;
  }
  if (a.week) return -1;
  if (b.week) return 1;
  return b.date?.localeCompare(a.date ?? "") ?? 0;
});
const getTopN = (map: Record<string, number>, n: number) =>
  Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
const getBottomN = (map: Record<string, number>, n: number) =>
  Object.entries(map).filter(([_, count]) => count > 0).sort((a, b) => a[1] - b[1]).slice(0, n);

// --- Stats Calculation ---
function useStats(videos: IceVideo[]) {
  const managerIcedCount: Record<string, number> = {};
  const playerIcedCount: Record<string, number> = {};
  const weekCounts: Record<string, Record<string, number>> = {};

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

// --- Filters ---
function useFilters(videos: IceVideo[]) {
  const managers = getUnique(videos.map(v => v.manager?.trim()).filter(Boolean)).sort();
  const seasons = getUnique(videos.map(v => v.season ?? getYear(v.date)).filter(Boolean)).sort((a, b) => b.localeCompare(a));
  const players = getUnique(videos.flatMap(v => splitPlayers(v.player))).sort();
  const weeks = Array.from({ length: 17 }, (_, i) => `Week ${i + 1}`);
  return { managers, seasons, players, weeks };
}

// --- UI Renderers ---
function VideoCard({ video, expandedVideo, setExpandedVideo }: {
  video: IceVideo, expandedVideo: string | null, setExpandedVideo: (id: string) => void
}) {
  const videoId = video.id?.trim() ?? "";
  const isExpanded = expandedVideo === videoId;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-emerald-100 flex flex-col items-center p-4 transition-transform hover:-translate-y-1 hover:shadow-emerald-300">
      <div className="w-full mb-3">
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
          <div className="w-full h-[175px] flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 font-bold text-xl">
            No Video
          </div>
        )}
      </div>
      <h2 className="text-lg font-bold text-emerald-700 text-center mb-1 w-full">{video.player}</h2>
      <div className="text-sm text-slate-600 text-center mb-1">
        <span className="font-semibold text-emerald-600">Manager:</span> {video.manager}
      </div>
      <div className="flex justify-center gap-2 text-xs text-slate-500 mb-2">
        {video.week && (
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{video.week}</span>
        )}
        <span>{video.date}</span>
      </div>
      {video["24_hr_penalty"] && (
        <span className="mt-2 px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-xs">24 HR PENALTY</span>
      )}
    </div>
  );
}

function StatsSection({ stats, handleManagerClick, handlePlayerClick, setSelectedPlayer, setSelectedManager, setSelectedSeason, setSelectedWeek, scrollToVideos }: any) {
  return (
    <div className="w-full mb-6">
      <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-100 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h3 className="text-emerald-700 font-semibold mb-2 text-center text-base">Most Iced Managers</h3>
            <ul className="list-decimal list-inside text-slate-700 text-center">
              {stats.topManagers.map(([manager, count]: any) => (
                <li key={manager}>
                  <button
                    className="font-semibold text-emerald-700 hover:underline focus:outline-none"
                    onClick={() => { handleManagerClick(manager); scrollToVideos(); }}
                  >
                    {manager}
                  </button> ({count})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-emerald-700 font-semibold mb-2 text-center text-base">Least Iced Managers</h3>
            <ul className="list-decimal list-inside text-slate-700 text-center">
              {stats.bottomManagers.map(([manager, count]: any) => (
                <li key={manager}>
                  <button
                    className="font-semibold text-emerald-700 hover:underline focus:outline-none"
                    onClick={() => { handleManagerClick(manager); scrollToVideos(); }}
                  >
                    {manager}
                  </button> ({count})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-emerald-700 font-semibold mb-2 text-center text-base">Most Ices Per Player</h3>
            <ul className="list-decimal list-inside text-slate-700 text-center">
              {stats.topPlayers.map(([player, count]: any) => (
                <li key={player}>
                  <button
                    className="font-semibold text-emerald-700 hover:underline focus:outline-none"
                    onClick={() => { handlePlayerClick(player); scrollToVideos(); }}
                  >
                    {player}
                  </button> ({count})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-emerald-700 font-semibold mb-2 text-center text-base">Most Ices by a Manager in a Single Week</h3>
            <ol className="list-decimal list-inside text-slate-700 text-center">
              {Object.entries(stats.weekCounts as Record<string, Record<string, number>>)
                .flatMap(([manager, weeks]) => (
                  Object.entries(weeks)
                    .sort(([, countA], [, countB]) => countB - countA)
                    .slice(0, 3)
                    .map(([weekSeason, count], idx) => ({ manager, weekSeason, count, idx }))
                ))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map(({ manager, weekSeason, count, idx }) => (
                  <li key={manager + weekSeason + idx}>
                    <button
                      className="font-semibold text-emerald-700 hover:underline focus:outline-none"
                      onClick={() => {
                        setSelectedManager(manager);
                        setSelectedSeason(weekSeason.split('|')[1]);
                        setSelectedWeek("All");
                        scrollToVideos();
                      }}
                    >
                      {manager}
                    </button>{" - "}
                    <button
                      className="hover:underline focus:outline-none text-emerald-700"
                      onClick={() => {
                        setSelectedSeason(weekSeason.split('|')[1]);
                        setSelectedWeek(weekSeason.split('|')[0]);
                        setSelectedManager(manager);
                        setSelectedPlayer("All"); // <-- Add this line
                        scrollToVideos();
                      }}
                    >
                      {weekSeason.split('|')[0]}, {weekSeason.split('|')[1]}
                    </button> ({count})
                  </li>
                ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  showPenaltyOnly: boolean;
  setShowPenaltyOnly: (v: boolean) => void;
  handleResetFilters: () => void;
  filtersExpanded: boolean;
  videos: IceVideo[];
}) {
  // Small reset button for mobile, styled to match dropdown height
  const ResetBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      type="button"
      className="sm:hidden ml-2 mt-0 px-3 py-1 rounded-lg text-xs bg-slate-200 text-slate-700 hover:bg-slate-400 border border-slate-300 flex items-center"
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
  // Always enabled, but filtered by other selections if set
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
    // Only managers who have been iced by the selected player
    managerOptions = getUnique(
      videos
        .filter(v => splitPlayers(v.player).includes(selectedPlayer))
        .map(v => v.manager?.trim())
        .filter(Boolean)
    ).sort();
  } else {
    managerOptions = filters.managers;
  }

  // --- Listbox Option Render Helper ---
  const renderOptions = (options: string[]) =>
    options.map(option => (
      <Listbox.Option
        key={option}
        value={option}
        className={({ active }) =>
          `cursor-pointer select-none px-3 py-2 ${active ? "bg-emerald-100 text-emerald-700" : "text-slate-700"
          }`
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
        <label
          className={`block text-xs font-semibold mb-1 sm:mb-0 ${grayOut ? "text-gray-400" : "text-emerald-700"
            }`}
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
                    className={`w-full px-3 py-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 text-left ${grayOut ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
                      }`}
                    style={{ minHeight: '40px' }}
                  >
                    {value}
                  </Listbox.Button>
                  {open &&
                    ReactDOM.createPortal(
                      <Listbox.Options
                        className="absolute w-48 bg-white border border-emerald-200 rounded-lg shadow-lg z-[9999] max-h-60 overflow-y-auto"
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

  // --- Use Dropdowns ---
  return (
    <div className={`overflow-hidden transition-all duration-500 ease-in-out w-full justify-center mt-0 gap-3
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
      <div className="w-full sm:w-auto flex justify-center sm:items-end mt-2 sm:mt-0 mb-3">
        <div className="flex flex-row sm:flex-row items-center justify-center">
          <input type="checkbox" id="penalty-filter" checked={showPenaltyOnly} onChange={e => setShowPenaltyOnly(e.target.checked)} className="accent-red-600" />
          <label htmlFor="penalty-filter" className="text-xs font-semibold text-red-700 ml-1">Penalty Ices</label>
        </div>
      </div>
      <div className="sm:w-auto flex justify-center sm:items-end mt-2 mb-1.5 sm:mt-0">
        <div className="sm:flex-row items-center justify-center">
          <button
            onClick={handleResetFilters}
            className="bg-slate-400 text-black px-3 py-2.5 rounded text-xs hover:bg-slate-600 whitespace-nowrap"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---
export default function Ices({ latestOnly = false }: IcesProps) {
  const [videos, setVideos] = useState<IceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedManager, setSelectedManager] = useState<string>("All");
  const [selectedSeason, setSelectedSeason] = useState<string>("All");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("All");
  const [selectedWeek, setSelectedWeek] = useState<string>("All");
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [collapsedSeasons, setCollapsedSeasons] = useState<Record<string, boolean>>({});
  const [showPenaltyOnly, setShowPenaltyOnly] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const videosSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('../data/Videos/ices.json')
      .then((data) => {
        const allVideos: IceVideo[] = [];
        Object.entries(data).forEach(([season, arr]) => {
          if (Array.isArray(arr)) arr.forEach((video: IceVideo) => {
            if (video.date) {
              allVideos.push({ ...video, season });
            }
          });
        });
        setVideos(allVideos);
      })
      .catch(() => setError("Failed to load videos."))
      .finally(() => setLoading(false));
  }, []);

  const filters = useFilters(videos);
  const stats = useStats(videos);

  // Filtering
  const filterVideo = (video: IceVideo) => {
    const managerMatch = selectedManager === "All" || video.manager?.trim() === selectedManager;
    const seasonMatch = selectedSeason === "All" || (video.season ?? getYear(video.date)) === selectedSeason;
    const playerNames = splitPlayers(video.player);
    const playerMatch = selectedPlayer === "All" || playerNames.includes(selectedPlayer);
    const weekMatch = selectedWeek === "All" || video.week?.trim() === selectedWeek;
    const penaltyMatch = !showPenaltyOnly || !!video["24_hr_penalty"];
    return managerMatch && seasonMatch && playerMatch && weekMatch && penaltyMatch;
  };

  let filteredVideos = videos.filter(filterVideo);
  if (latestOnly && filteredVideos.length > 0) {
    filteredVideos = filteredVideos.sort((a, b) => {
      const dateA = new Date(a.date.replace(/-/g, '/')).getTime();
      const dateB = new Date(b.date.replace(/-/g, '/')).getTime();
      return dateB - dateA;
    }).slice(0, 1);
  }

  // Ensure consistent rendering for mobile and desktop
  const renderVideos = latestOnly ? filteredVideos : videos.filter(filterVideo);

  // Group videos by season
  const videosBySeason: Record<string, IceVideo[]> = {};
  videos.forEach(video => {
    const season = video.season ?? getYear(video.date);
    if (!season) return;
    if (!videosBySeason[season]) videosBySeason[season] = [];
    videosBySeason[season].push(video);
  });
  const sortedSeasons = sortSeasons(Object.keys(videosBySeason));

  // Handlers
  const handleManagerClick = (manager: string) => {
    setSelectedManager(manager); setSelectedSeason("All"); setSelectedPlayer("All"); setSelectedWeek("All"); setShowPenaltyOnly(false);
  };
  const handlePlayerClick = (player: string) => {
    setSelectedPlayer(player); setSelectedManager("All"); setSelectedSeason("All"); setSelectedWeek("All"); setShowPenaltyOnly(false);
  };
  const handleResetFilters = () => {
    setSelectedPlayer("All"); setSelectedManager("All"); setSelectedSeason("All"); setSelectedWeek("All"); setShowPenaltyOnly(false);
  };
  const scrollToVideos = () => {
    videosSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <div className={latestOnly ? "w-full flex flex-col items-center" : "min-h-screen flex flex-col items-center"}>
        {latestOnly ? (
          <button onClick={() => window.location.href = '/ices'} className="text-2xl font-bold text-emerald-700 mt-6 mb-4 text-center">Latest Ice</button>
        ) : (
          <div className="w-full bg-white/80 border-b border-emerald-100">
            <div className="max-w-3xl mx-auto px-4 py-2 flex flex-col items-center">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mb-2 text-center">Ices</h1>
              <div className="w-full">
                {/* Mobile toggle button */}
                <button className="sm:hidden w-full flex items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-2 font-bold text-emerald-700 text-lg"
                  onClick={() => setStatsExpanded(prev => !prev)} aria-expanded={statsExpanded}>
                  <span>{statsExpanded ? "Hide Records" : "Show Records"}</span>
                  <span className="ml-2">{statsExpanded ? <ChevronUp /> : <ChevronDown />}</span>
                </button>
                {/* Animated StatsSection */}
                <div
                  className={`overflow-hidden transition-all duration-500 ease-in-out w-full
                  ${statsExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}
                  sm:max-h-none sm:opacity-100`}
                  style={{ transitionProperty: "max-height, opacity" }}
                >
                  <StatsSection
                    stats={stats}
                    handleManagerClick={(manager: string) => { handleManagerClick(manager); scrollToVideos(); }}
                    handlePlayerClick={(player: string) => { handlePlayerClick(player); scrollToVideos(); }}
                    setSelectedManager={setSelectedManager}
                    setSelectedSeason={setSelectedSeason}
                    setSelectedWeek={setSelectedWeek}
                    setSelectedPlayer={setSelectedPlayer} // <-- Add this line
                    scrollToVideos={scrollToVideos}
                  />
                </div>
              </div>
              <FiltersSection
                filters={filters}
                selectedManager={selectedManager}
                setSelectedManager={setSelectedManager}
                selectedSeason={selectedSeason}
                setSelectedSeason={setSelectedSeason}
                selectedPlayer={selectedPlayer}
                setSelectedPlayer={setSelectedPlayer}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                showPenaltyOnly={showPenaltyOnly}
                setShowPenaltyOnly={setShowPenaltyOnly}
                handleResetFilters={handleResetFilters}
                filtersExpanded={filtersExpanded}
                videos={videos} // <-- pass videos for dynamic filtering
              />
              {/* Mobile filters toggle button */}
              <button className="sm:hidden w-full flex items-center justify-center bg-white border border-emerald-200 rounded-lg px-4 py-2 mb-2 font-bold text-emerald-700 text-base transition-all duration-300"
                onClick={() => setFiltersExpanded(prev => !prev)} aria-expanded={filtersExpanded}>
                <span>{filtersExpanded ? "Hide Filters" : "Show Filters"}</span>
              </button>
            </div>
          </div>
        )}
        <main
          ref={videosSectionRef}
          className={latestOnly
            ? "w-full max-w-4xl px-2 sm:px-6 py-4 flex flex-col items-center"
            : "w-full max-w-4xl px-2 sm:px-6 py-8 flex flex-col items-center"}
        >
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
              {sortedSeasons.map(season => {
                const seasonVideos = videosBySeason[season].filter(filterVideo);
                if (seasonVideos.length === 0) return null;
                const isCollapsed = collapsedSeasons[season] ?? false;
                return (
                  <div key={season} className="mb-8">
                    <button className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-2 font-bold text-emerald-700 text-lg transition hover:bg-emerald-100"
                      onClick={() => setCollapsedSeasons(prev => ({ ...prev, [season]: !prev[season] }))}>
                      <span>{season}</span>
                      <span className="ml-2">{isCollapsed ? "▼" : "▲"}</span>
                    </button>
                    {(
                      <div
                        ref={el => {
                          if (el && !isCollapsed) {
                            el.style.maxHeight = el.scrollHeight + "px";
                          } else if (el) {
                            el.style.maxHeight = "0px";
                          }
                        }}
                        className={`overflow-hidden transition-all duration-500 ease-in-out w-full ${!isCollapsed ? "opacity-100" : "opacity-0"}`}
                        style={{ transitionProperty: "max-height, opacity" }}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                          {[...seasonVideos].reverse().map((video, idx) =>
                            <VideoCard key={video.id?.trim() + idx} video={video} expandedVideo={expandedVideo} setExpandedVideo={setExpandedVideo} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center text-yellow-800 text-sm font-medium">
        All videos are unlisted on YouTube and only viewable to those who possess the link. (i.e. us)
      </div>
    </>
  );
}