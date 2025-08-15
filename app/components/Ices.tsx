'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";

type IceVideo = {
  id: string;
  player: string;
  manager: string;
  date: string;
  week?: string;
};

type IcesProps = {
  latestOnly?: boolean;
};

function getYear(date: string) {
  // Assumes date is YYYY-MM-DD
  return date.slice(0, 4);
}

// Helper to get top N from a count map
function getTopN<T>(map: Record<string, number>, n: number): [string, number][] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export default function Ices({ latestOnly = false }: IcesProps) {
  const [videos, setVideos] = useState<IceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedManager, setSelectedManager] = useState<string>("All");
  const [selectedSeason, setSelectedSeason] = useState<string>("All");

  // Track which video is expanded (by index or id)
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  useEffect(() => {
    import('../data/Videos/ices.json')
      .then((data) => setVideos(data.Videos))
      .catch(() => setError("Failed to load videos."))
      .finally(() => setLoading(false));
  }, []);

  // Get unique managers and seasons
  const managers = Array.from(new Set(videos.map(v => v.manager.trim()))).sort();
  const seasons = Array.from(new Set(videos.map(v => getYear(v.date)))).sort((a, b) => b.localeCompare(a));

  // Filter videos
  let filteredVideos = videos.filter(video => {
    const managerMatch = selectedManager === "All" || video.manager.trim() === selectedManager;
    const seasonMatch = selectedSeason === "All" || getYear(video.date) === selectedSeason;
    return managerMatch && seasonMatch;
  });

  // If latestOnly, show only the most recent video
  if (latestOnly && videos.length > 0) {
    filteredVideos = [...videos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1);
  }

  // Calculate stats
  const managerIcedCount: Record<string, number> = {};
  const playerIcedCount: Record<string, number> = {};

  videos.forEach(video => {
    // Count iced managers
    const manager = video.manager.trim();
    managerIcedCount[manager] = (managerIcedCount[manager] || 0) + 1;

    // Count total ices per player
    const player = video.player.trim();
    playerIcedCount[player] = (playerIcedCount[player] || 0) + 1;
  });

  const topManagers = getTopN(managerIcedCount, 3);
  const topPlayers = getTopN(playerIcedCount, 3);

  return (
    <div className={latestOnly ? "w-full flex flex-col items-center" : "min-h-screen flex flex-col items-center"}>
      {latestOnly ? (
        <h2 className="text-2xl font-bold text-emerald-700 mt-6 mb-4 text-center">Latest Ice</h2>
      ) : (
        <div className="w-full bg-white/80 border-b border-emerald-100">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mb-2 text-center">
              Ices
            </h1>
            <p className="text-slate-700 text-center mb-4 text-sm sm:text-base px-2">
              Shame - The result of starting a player who scores 0 points. (or less)
            </p>
            {/* Top stats */}
            <div className="w-full flex flex-col sm:flex-row gap-6 justify-center mb-6">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex-1">
                <h2 className="text-emerald-700 font-bold mb-2 text-center text-lg">Most Iced Managers</h2>
                <ul className="list-decimal list-inside text-slate-700 text-center">
                  {topManagers.map(([manager, count]) => (
                    <li key={manager}>
                      <button
                        className="font-semibold text-emerald-700 hover:underline focus:outline-none"
                        onClick={() => setSelectedManager(manager)}
                      >
                        {manager}
                      </button> ({count} times)
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex-1">
                <h2 className="text-emerald-700 font-bold mb-2 text-center text-lg">Players With the Most Ices</h2>
                <ul className="list-decimal list-inside text-slate-700 text-center">
                  {topPlayers.map(([player, count]) => (
                    <li key={player}>
                      <span className="font-semibold">{player}</span> ({count} times)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2">
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Manager</label>
                <select
                  className="w-full sm:w-auto px-3 py-2 rounded-lg border border-emerald-200 bg-white text-emerald-700"
                  value={selectedManager}
                  onChange={e => setSelectedManager(e.target.value)}
                >
                  <option value="All">All</option>
                  {managers.map(manager => (
                    <option key={manager} value={manager}>{manager}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Season</label>
                <select
                  className="w-full sm:w-auto px-3 py-2 rounded-lg border border-emerald-200 bg-white text-emerald-700"
                  value={selectedSeason}
                  onChange={e => setSelectedSeason(e.target.value)}
                >
                  <option value="All">All</option>
                  {seasons.map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
      <main className={latestOnly ? "w-full max-w-xl px-2 sm:px-6 py-4 flex flex-col items-center" : "w-full max-w-4xl px-2 sm:px-6 py-8 flex flex-col items-center"}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          </div>
        ) : error ? (
          <p className="text-center text-red-500 text-lg mt-10">{error}</p>
        ) : filteredVideos.length === 0 ? (
          <p className="text-center text-slate-500 text-lg mt-10">No videos found for this filter.</p>
        ) : (
          <div className={latestOnly ? "grid grid-cols-1 gap-6 w-full" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full"}>
            {filteredVideos.map((video, idx) => {
              const videoId = video.id.trim();
              const isExpanded = expandedVideo === videoId;
              return (
                <div
                  key={videoId}
                  className="bg-white rounded-xl shadow-lg border border-emerald-100 flex flex-col items-center p-4 transition-transform hover:-translate-y-1 hover:shadow-emerald-300"
                >
                  <div className="w-full mb-3">
                    {!isExpanded ? (
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
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg w-full"
                      ></iframe>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-emerald-700 text-center mb-1 w-full">
                    {video.player}
                  </h2>
                  <div className="text-sm text-slate-600 text-center mb-1">
                    <span className="font-semibold text-emerald-600">Manager:</span> {video.manager}
                  </div>
                  <div className="flex justify-center gap-2 text-xs text-slate-500 mb-2">
                    {video.week && (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                        {video.week}
                      </span>
                    )}
                    <span>{video.date}</span>
                  </div>
                </div>
              );
            })}
            
          </div>
        )}
      </main>
      {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center text-yellow-800 text-sm font-medium">
            All videos are unlisted on YouTube and only viewable to those who possess the link.
            </div>
    </div>
  );
};