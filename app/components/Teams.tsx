"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface TeamEntry {
  id: string;
  name: string;
  manager: string;
  rank: number;
  logo: string;
}

const StandingsViewer = () => {
  const [year, setYear] = useState<string>("2024");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchStandings() {
      setError(null);
      setTeams([]);
      setLoading(true);

      try {
        const response = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=${year}`
        );
        if (!response.ok) throw new Error("Failed to fetch standings");

        const json = await response.json();

        const rawTeams = json.fantasy_content.league[1].standings[0].teams;
        const teamCount = parseInt(rawTeams.count, 10);
        const parsed: TeamEntry[] = [];

        for (let i = 0; i < teamCount; i++) {
          const teamData = rawTeams[i.toString()].team;

          const metadata = teamData[0];
          const standings = teamData[2]?.team_standings;

          const id = metadata.find((item: any) => item.team_id)?.team_id ?? `${i + 1}`;
          const name = metadata.find((item: any) => item.name)?.name ?? "Unknown Team";
          const manager =
            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.nickname ?? "Unknown";
          const rank = parseInt(standings?.rank ?? "99", 10);
          const logo =
            metadata.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ??
            "https://via.placeholder.com/100";

          parsed.push({ id, name, manager, rank, logo });
        }

        parsed.sort((a, b) => a.rank - b.rank);
        setTeams(parsed);
      } catch (err: unknown) {
        let message = "An error occurred";
        if (err instanceof Error) message = err.message;
        setError(message);
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
  }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYear(e.target.value);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl mb-8 p-6 sm:p-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              🏆 Fantasy Teams
            </h1>

            {/* Year Selector */}
            <div className="flex justify-center">
              <div className="relative">
                <select
                  value={year}
                  onChange={handleYearChange}
                  className="appearance-none bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-xl px-6 py-3 pr-12 font-medium text-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {Array.from({ length: 2024 - 2017 + 1 }, (_, i) => (2024 - i).toString()).map((y) => (
                    <option key={y} value={y} className="text-gray-900 bg-white">
                      {y} Season
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                  <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {year === "2024" && (
          <div className="text-center mb-8">
            <p className="text-slate-600 text-lg font-medium bg-white/60 backdrop-blur-sm rounded-full px-6 py-3 inline-block border border-white/50 shadow-sm">
              💫 Select a team to explore their roster
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-red-800 mb-2">Unable to Load Teams</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 text-lg mt-6 font-medium">Loading team standings...</p>
          </div>
        )}

        {/* Teams Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(year === "2024" ? teams : teams).map((team, index) => (
              <Link
                href={`/roster?year=${year}&teamId=${team.id}`}
                key={team.id}
                className="group block"
              >
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200/50 overflow-hidden">
                  {/* Rank Badge */}
                  {!isNaN(team.rank) && (
                    <div className="absolute top-4 left-4 z-10">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${team.rank === 1
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 shadow-lg"
                          : team.rank <= 3
                            ? "bg-gradient-to-r from-slate-400 to-slate-600 text-white shadow-md"
                            : "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-700"
                        }`}>
                        {team.rank}
                      </div>
                    </div>
                  )}

                  <div className="relative p-6 text-center">
                    {/* Team Logo */}
                    <div className="relative mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 p-2 shadow-lg">
                        <Image
                          src={team.logo}
                          alt={`${team.name} logo`}
                          width={80}
                          height={80}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>

                      {/* Champion Crown for Rank 1 */}
                      {team.rank === 1 && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                          <span className="text-yellow-900 text-lg font-bold">👑</span>
                        </div>
                      )}
                    </div>

                    {/* Team Info */}
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-emerald-600 transition-colors duration-200 truncate">
                        {team.name}
                      </h3>

                      <div className="space-y-1">
                        <p className="text-slate-600 font-medium">
                          <span className="text-slate-500">Manager:</span>
                          <span className="ml-1 text-slate-700">{team.manager}</span>
                        </p>

                        {!isNaN(team.rank) && (
                          <div className="flex items-center justify-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${team.rank === 1
                                ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                : team.rank <= 3
                                  ? "bg-slate-100 text-slate-800 border border-slate-200"
                                  : team.rank <= 6
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-red-100 text-red-800 border border-red-200"
                              }`}>
                              {team.rank === 1
                                ? "🥇 Champion"
                                : team.rank === 2
                                  ? "🥈 Runner-up"
                                  : team.rank === 3
                                    ? "🥉 Third Place"
                                    : team.rank <= 6
                                      ? `#${team.rank} Playoffs`
                                      : `#${team.rank} Eliminated`
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                  </div>

                  {/* Bottom Accent */}
                  <div className={`h-1 bg-gradient-to-r ${team.rank === 1
                      ? "from-yellow-400 to-yellow-600"
                      : team.rank <= 3
                        ? "from-slate-400 to-slate-600"
                        : team.rank <= 6
                          ? "from-emerald-400 to-emerald-600"
                          : "from-red-400 to-red-600"
                    }`} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && teams.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏈</div>
            <h3 className="text-2xl font-semibold text-slate-700 mb-2">No Teams Found</h3>
            <p className="text-slate-500">Unable to load teams for the {year} season.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandingsViewer;
