'use client';

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

type StandingsProps = {
  topThree?: boolean;
};

const StandingsViewer = ({ topThree = false }: StandingsProps) => {
  const [year, setYear] = useState<string>("2024");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Use persistent cache (localStorage)
  const getCachedStandings = (year: string): TeamEntry[] | null => {
    try {
      const cached = localStorage.getItem(`standings_${year}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  };

  const setCachedStandings = (year: string, teams: TeamEntry[]) => {
    try {
      localStorage.setItem(`standings_${year}`, JSON.stringify(teams));
    } catch {}
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchStandings() {
      setError(null);
      setLoading(true);

      // Show cached data immediately if available
      const cached = getCachedStandings(year);
      if (cached) {
        setTeams(cached);
        setLoading(false);
      }

      // Always fetch fresh data in the background
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

        // Only update if data is different
        if (isMounted && JSON.stringify(parsed) !== JSON.stringify(cached)) {
          setCachedStandings(year, parsed);
          setTeams(parsed);
        }
      } catch (err: unknown) {
        let message = "An error occurred";
        if (err instanceof Error) message = err.message;
        setError(message);
        console.error("Fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStandings();
    return () => { isMounted = false; };
  }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYear(e.target.value);
  };

  // Only show top 3 teams if topThree prop is true
  const displayTeams = topThree ? teams.slice(0, 3) : teams;

  if (topThree) {
    return (
      <div className="w-full">
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-5xl font-extrabold text-emerald-700 mb-8 text-center">
            <Link href={`/standings?year=${year}`} className="hover:underline transition">
              Leaders
            </Link>
          </h1>
          {error && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-red-800 mb-2">Unable to Load Standings</h3>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          )}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              </div>
            </div>
          )}
          {!loading && !error && (
            <div className="flex flex-row justify-center gap-4">
              {displayTeams.map((team, idx) => (
                <Link
                  href={`/roster?year=${year}&teamId=${team.id}`}
                  key={team.id}
                  className="group block"
                >
                  <div className={`flex flex-col items-center bg-white rounded-xl shadow-md border px-4 py-6 min-w-[120px] max-w-[160px] h-[210px] transition-all duration-200 hover:shadow-lg hover:-translate-y-1
                    ${idx === 0 ? "border-yellow-400" : idx === 1 ? "border-slate-400" : "border-amber-700"}`}>
                    {/* Rank Badge */}
                    <div className={`mb-2 text-lg font-bold
                      ${idx === 0 ? "text-yellow-600" : idx === 1 ? "text-slate-500" : "text-amber-700"}`}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </div>
                    {/* Team Logo */}
                    <div className="mb-2">
                      <Image
                        src={team.logo}
                        alt={`${team.name} logo`}
                        width={56}
                        height={56}
                        className="rounded-full object-cover border border-gray-200"
                      />
                    </div>
                    {/* Team Info */}
                    <h3 className={`text-sm font-semibold text-center break-words whitespace-normal
                      ${idx === 0 ? "text-yellow-700" : idx === 1 ? "text-slate-700" : "text-amber-700"}`}>
                      {team.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 text-center break-words whitespace-normal">{team.manager}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const champion = teams[0];
  const others = teams.slice(1);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl mb-8 p-6 sm:p-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              🏈 Bok Choy League Standings
            </h1>
            <p className="text-emerald-100 text-lg font-medium mb-6">
              {year} Season Rankings
            </p>

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

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-red-800 mb-2">Unable to Load Standings</h3>
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
          </div>
        )}

        {/* Champion Spotlight - only for completed seasons */}
        {!loading && !error && champion && year !== "2025" && (
          <div className="mb-12">
            {/* Champion Card */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent mb-2">
                🏆 League Champion
              </h2>
              <p className="text-slate-600 font-medium">Congratulations to this season's winner!</p>
            </div>

            <div className="relative bg-gradient-to-br from-yellow-100 via-yellow-50 to-amber-100 border-2 border-yellow-300 rounded-3xl shadow-2xl p-8 max-w-lg mx-auto transform hover:scale-105 transition-all duration-300 overflow-hidden">
              <Link href={`/roster?year=${year}&teamId=${champion.id}`} className="group block">
                <div className="relative z-10 flex flex-col items-center text-center">
                  {/* Champion Crown */}
                  <div className="relative mb-4 group-hover:scale-110 transition-transform duration-300">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="text-4xl animate-bounce">👑</div>
                    </div>
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 p-2 shadow-2xl">
                      <Image
                        src={champion.logo}
                        alt={`${champion.name} logo`}
                        width={112}
                        height={112}
                        className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
                      />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-yellow-800 mb-2 group-hover:text-yellow-900 transition-colors">
                    {champion.name}
                  </h3>
                  <p className="text-yellow-700 font-medium">
                    Champion: <span className="font-bold">{champion.manager}</span>
                  </p>
                </div>
              </Link>
            </div>

            {/* Runner-up & Third Place Cards */}
            <div className="flex flex-col sm:flex-row justify-center gap-8 mt-8">
              {/* Runner-up (2nd place) */}
              {teams[1] && (
                <div className="relative bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 border-2 border-slate-400 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto sm:mx-0 transform hover:scale-105 transition-all duration-300 overflow-hidden">
                  <Link href={`/roster?year=${year}&teamId=${teams[1].id}`} className="group block">
                    <div className="relative z-10 flex flex-col items-center text-center">
                      {/* Silver Medal */}
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="text-3xl animate-bounce">🥈</div>
                      </div>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 p-2 shadow-xl mb-2">
                        <Image
                          src={teams[1].logo}
                          alt={`${teams[1].name} logo`}
                          width={80}
                          height={80}
                          className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
                        />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 transition-colors">
                        {teams[1].name}
                      </h3>
                      <p className="text-slate-700 font-medium">
                        Runner-up: <span className="font-bold">{teams[1].manager}</span>
                      </p>
                    </div>
                  </Link>
                </div>
              )}

              {/* Third Place (3rd place) */}
              {teams[2] && (
                <div className="relative bg-gradient-to-br from-amber-100 via-amber-50 to-yellow-100 border-2 border-amber-400 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto sm:mx-0 transform hover:scale-105 transition-all duration-300 overflow-hidden">
                  <Link href={`/roster?year=${year}&teamId=${teams[2].id}`} className="group block">
                    <div className="relative z-10 flex flex-col items-center text-center">
                      {/* Bronze Medal */}
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="text-3xl animate-bounce">🥉</div>
                      </div>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-2 shadow-xl mb-2">
                        <Image
                          src={teams[2].logo}
                          alt={`${teams[2].name} logo`}
                          width={80}
                          height={80}
                          className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
                        />
                      </div>
                      <h3 className="text-xl font-bold text-amber-800 mb-1 group-hover:text-amber-900 transition-colors">
                        {teams[2].name}
                      </h3>
                      <p className="text-amber-700 font-medium">
                        Third Place: <span className="font-bold">{teams[2].manager}</span>
                      </p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teams Grid */}
        {!loading && !error && (() => {
          // Exclude top 3 for completed seasons
          const gridTeams = year === "2025" ? teams : teams.slice(3);
          const playoffs = gridTeams.filter(team => team.rank <= 6);
          const eliminated = gridTeams.filter(team => team.rank > 6);

          return (
            <>
              {/* Playoffs Section */}
              {playoffs.length > 0 && (
                <div className="mb-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
                    {playoffs.map(team => (
                      <Link
                        href={`/roster?year=${year}&teamId=${team.id}`}
                        key={team.id}
                        className="group block"
                      >
                        <div className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200/50 overflow-hidden">
                          {/* Rank Badge */}
                          {!isNaN(team.rank) && (
                            <div className="absolute top-4 left-4 z-10">
                              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg ${team.rank === 2
                                ? "bg-gradient-to-r from-slate-300 to-slate-500 text-slate-800"
                                : team.rank === 3
                                  ? "bg-gradient-to-r from-amber-400 to-amber-600 text-amber-900"
                                  : team.rank <= 6
                                    ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-emerald-900"
                                    : "bg-gradient-to-r from-red-400 to-red-600 text-red-900"
                                }`}>
                                #{team.rank}
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

                              {/* Special Badges */}
                              {team.rank === 2 && (
                                <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-r from-slate-400 to-slate-600 rounded-full flex items-center justify-center shadow-lg">
                                  <span className="text-white text-sm font-bold">🥈</span>
                                </div>
                              )}
                              {team.rank === 3 && (
                                <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                                  <span className="text-white text-sm font-bold">🥉</span>
                                </div>
                              )}
                            </div>

                            {/* Team Info */}
                            <div className="space-y-3">
                              <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-600 transition-colors duration-200 truncate">
                                {team.name}
                              </h3>

                              <p className="text-slate-600 font-medium">
                                <span className="text-slate-500">Manager:</span>
                                <span className="ml-1 text-slate-700">{team.manager}</span>
                              </p>

                              {!isNaN(team.rank) && (
                                <div className="flex justify-center">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${team.rank === 2
                                    ? "bg-slate-100 text-slate-800 border border-slate-200"
                                    : team.rank === 3
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : team.rank <= 6
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-red-100 text-red-800 border border-red-200"
                                    }`}>
                                    {team.rank === 2
                                      ? "🥈 Runner-up"
                                      : team.rank === 3
                                        ? "🥉 Third Place"
                                        : team.rank <= 6
                                          ? `Playoffs (#${team.rank})`
                                          : `Eliminated (#${team.rank})`
                                    }
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Hover Effect Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                          </div>

                          {/* Bottom Accent */}
                          <div className={`h-1 bg-gradient-to-r ${team.rank === 2
                            ? "from-slate-400 to-slate-600"
                            : team.rank === 3
                              ? "from-amber-400 to-amber-600"
                              : team.rank <= 6
                                ? "from-emerald-400 to-emerald-600"
                                : "from-red-400 to-red-600"
                            }`} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Eliminated Section */}
              {eliminated.length > 0 && (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
                    {eliminated.map(team => (
                      <Link
                        href={`/roster?year=${year}&teamId=${team.id}`}
                        key={team.id}
                        className="group block"
                      >
                        <div className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200/50 overflow-hidden">
                          {/* Rank Badge */}
                          {!isNaN(team.rank) && (
                            <div className="absolute top-4 left-4 z-10">
                              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg ${team.rank === 2
                                ? "bg-gradient-to-r from-slate-300 to-slate-500 text-slate-800"
                                : team.rank === 3
                                  ? "bg-gradient-to-r from-amber-400 to-amber-600 text-amber-900"
                                  : team.rank <= 6
                                    ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-emerald-900"
                                    : "bg-gradient-to-r from-red-400 to-red-600 text-red-900"
                                }`}>
                                #{team.rank}
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
                            </div>

                            {/* Team Info */}
                            <div className="space-y-3">
                              <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-600 transition-colors duration-200 truncate">
                                {team.name}
                              </h3>

                              <p className="text-slate-600 font-medium">
                                <span className="text-slate-500">Manager:</span>
                                <span className="ml-1 text-slate-700">{team.manager}</span>
                              </p>

                              {!isNaN(team.rank) && (
                                <div className="flex justify-center">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${team.rank === 2
                                    ? "bg-slate-100 text-slate-800 border border-slate-200"
                                    : team.rank === 3
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : team.rank <= 6
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-red-100 text-red-800 border border-red-200"
                                    }`}>
                                    {team.rank === 2
                                      ? "🥈 Runner-up"
                                      : team.rank === 3
                                        ? "🥉 Third Place"
                                        : team.rank <= 6
                                          ? `Playoffs (#${team.rank})`
                                          : `Eliminated (#${team.rank})`
                                    }
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Hover Effect Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                          </div>

                          {/* Bottom Accent */}
                          <div className={`h-1 bg-gradient-to-r ${team.rank === 2
                            ? "from-slate-400 to-slate-600"
                            : team.rank === 3
                              ? "from-amber-400 to-amber-600"
                              : team.rank <= 6
                                ? "from-emerald-400 to-emerald-600"
                                : "from-red-400 to-red-600"
                            }`} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Empty State */}
        {!loading && !error && (!teams || teams.length === 0) && (!others || others.length === 0) && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏈</div>
            <h3 className="text-2xl font-semibold text-slate-700 mb-2">No Standings Available</h3>
            <p className="text-slate-500">Unable to load standings for the {year} season.</p>
          </div>
        )}
      </div>
    </div >
  );
};

export default StandingsViewer;
