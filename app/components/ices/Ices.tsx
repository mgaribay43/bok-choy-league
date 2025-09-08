'use client';
// =======================
// Imports
// =======================
import React, { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronUp } from 'lucide-react';

import { getFirestore, collection, getDocs } from "firebase/firestore";

// Local splits
import VideoCard from "./components/VideoCard";
import FiltersSection from "./components/FiltersSection";
import StatsSection from "./components/StatsSection";
import SeasonCollapse from "./components/SeasonCollapse";

import { useFilters, useManagerWithMostConsecutiveWeeks, useManagerWithMostFlavors, useMostIcesInSingleSeason, useStats, useUniqueFlavors, IceVideo, useMostIcesInSingleWeekAllTeams } from "./hooks/hooks";
import { getYear, sortSeasons } from "./utils/helpers";

// =======================
// Types
// =======================
type IcesProps = { latestOnly?: boolean; };

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
  const mostIcesInSingleWeekAllTeams = useMostIcesInSingleWeekAllTeams(videos);

  // --- Filtering Logic ---
  const filterVideo = (video: IceVideo) => {
    const managerMatch = selectedManager === "All" || video.manager?.trim() === selectedManager;
    const seasonMatch = selectedSeason === "All" || (video.season ?? getYear(video.date)) === selectedSeason;
    const playerNames = (video.player?.split("+").map(p => p.trim()).filter(Boolean) ?? []);
    const playerMatch = selectedPlayer === "All" || playerNames.includes(selectedPlayer);
    const weekMatch = selectedWeek === "All" || video.week?.trim() === selectedWeek;
    const flavorMatch = selectedFlavor === "All" || video.flavor?.trim() === selectedFlavor;
    const penaltyMatch = !showPenaltyOnly || !!(video as any)["24_hr_penalty"];
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
                    mostIcesInSingleWeekAllTeams={mostIcesInSingleWeekAllTeams}
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
            ? "w-full max-w-4xl px-2 sm:px-6 py-4 pb-20 flex flex-col items-center"
            : "w-full max-w-4xl px-2 sm:px-6 py-8 pb-20 flex flex-col items-center"}
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
              <VideoCard key={(video.id?.trim() || "") + idx} video={video} expandedVideo={expandedVideo} setExpandedVideo={setExpandedVideo} />
            ))
          ) : (
            <div className="w-full">
              {/* Render videos grouped by season */}
              {sortedSeasons.map(season => {
                const seasonVideos = (videosBySeason[season] || []).filter(filterVideo);
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