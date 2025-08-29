'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface TeamEntry {
  id: string;
  name: string;
  manager: string;
  realManager: string;
  rank: number;
  logo: string;
  record: string; // <-- Add record field
}

type StandingsProps = {
  topThree?: boolean;
};

const getCurrentSeason = async (): Promise<string> => {
  try {
    const response = await fetch(
      "https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=2025"
    );
    if (!response.ok) throw new Error("Failed to fetch league settings");
    const json = await response.json();
    const league = json.fantasy_content.league[0];
    return league.season;
  } catch {
    return String(new Date().getFullYear());
  }
};

const getDraftTime = async (season: string): Promise<number | null> => {
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

const StandingsViewer = ({ topThree = false }: StandingsProps) => {
  const [year, setYear] = useState<string>("2024");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentSeason, setCurrentSeason] = useState<string>(String(new Date().getFullYear()));
  const [draftTime2025, setDraftTime2025] = useState<number | null>(null);
  const [canShow2025, setCanShow2025] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    getCurrentSeason().then(season => {
      if (isMounted) setCurrentSeason(season);
    });
    getDraftTime("2025").then(time => {
      if (isMounted) setDraftTime2025(time);
      if (time && Date.now() >= time) {
        setCanShow2025(true);
      } else {
        setCanShow2025(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchStandings() {
      setError(null);
      setLoading(true);

      // Only allow 2025 standings if draft has happened
      if (year === "2025" && draftTime2025 && Date.now() < draftTime2025) {
        setTeams([]);
        setError("Standings will be available after the draft.");
        setLoading(false);
        return;
      }

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
          const outcome = standings?.outcome_totals || {};
          const wins = outcome.wins ?? 0;
          const losses = outcome.losses ?? 0;
          const ties = outcome.ties ?? 0;
          const record = `(${wins}-${losses}-${ties})`;

          parsed.push({
            id,
            name,
            manager: getDisplayManagerName(manager),
            realManager: manager,
            rank,
            logo,
            record // <-- Add record to parsed team
          });
        }

        parsed.sort((a, b) => a.rank - b.rank);

        if (isMounted) {
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
  }, [year, currentSeason, draftTime2025]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYear(e.target.value);
  };

  // Only show top 3 teams if topThree prop is true
  const displayTeams = topThree ? teams.slice(0, 3) : teams;

  if (topThree) {
    return (
      <div className="w-full bg-[#0f0f0f]">
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-5xl font-extrabold text-emerald-200 mb-8 text-center">
            <Link href={`/standings?year=${year}`} className="hover:underline transition">
              Leaders
            </Link>
          </h1>
          {error && (
            <div className="text-center py-12">
              <div className="bg-red-900 border border-red-700 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-red-200 mb-2">Unable to Load Standings</h3>
                <p className="text-red-300">{error}</p>
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
                <div key={team.id} className="group block">
                  <div className={`flex flex-col items-center bg-[#232323] rounded-xl shadow-md border px-4 py-6 min-w-[120px] max-w-[160px] h-auto min-h-[250px] transition-all duration-200 hover:shadow-lg hover:-translate-y-1
                    ${idx === 0 ? "border-yellow-400" : idx === 1 ? "border-slate-400" : "border-amber-700"}`}>
                    {/* Trophy Image */}
                    <div className="mb-2">
                      <Image
                        src={getTrophyUrl(idx + 1, year) ?? ""}
                        alt={`${idx + 1} Place Trophy`}
                        width={36}
                        height={36}
                        className="mx-auto"
                      />
                    </div>
                    {/* Team Logo */}
                    <div className="mb-2">
                      <Link href={`/roster?year=${year}&teamId=${team.id}`}>
                        <Image
                          src={team.logo}
                          alt={`${team.name} logo`}
                          width={56}
                          height={56}
                          className="rounded-full object-cover border border-[#333]"
                        />
                      </Link>
                    </div>
                    {/* Team Name */}
                    <h3 className={`text-sm font-semibold text-center break-words whitespace-normal
                      ${idx === 0 ? "text-yellow-300" : idx === 1 ? "text-emerald-200" : "text-amber-300"} mb-1`}
                      style={{
                        wordBreak: "break-word",
                        whiteSpace: "normal"
                      }}
                    >
                      <Link href={`/roster?year=${year}&teamId=${team.id}`}>
                        {team.name}
                      </Link>
                    </h3>
                    {/* Manager Name */}
                    <p
                      className="text-xs text-emerald-400 text-center break-words whitespace-normal w-full"
                      style={{
                        wordBreak: "break-word",
                        whiteSpace: "normal"
                      }}
                    >
                      <span
                        className="underline text-emerald-300 hover:text-emerald-400 transition cursor-pointer"
                        onClick={() => window.location.href = `/manager?name=${encodeURIComponent(team.realManager)}`}
                      >
                        {team.manager}
                      </span>
                    </p>
                    {/* Team Record BELOW manager name */}
                    <div className="text-emerald-400 text-base font-normal mt-1">{team.record}</div>
                  </div>
                </div>
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
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl shadow-xl mb-8 p-6 sm:p-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-emerald-100 mb-2">
              🏈 Bok Choy League Standings
            </h1>
            <p className="text-emerald-300 text-lg font-medium mb-6">
              {year} Season Rankings
            </p>

            {/* Year Selector */}
            <div className="flex justify-center">
              <div className="relative">
                <select
                  value={year}
                  onChange={handleYearChange}
                  className="appearance-none bg-[#232323] text-emerald-100 border border-[#333] rounded-xl px-6 py-3 pr-12 font-medium text-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {Array.from({ length: 2024 - 2017 + 1 }, (_, i) => (2024 - i).toString()).map((y) => (
                    <option key={y} value={y} className="text-emerald-100 bg-[#232323]">
                      {y} Season
                    </option>
                  ))}
                  <option
                    value="2025"
                    className="text-emerald-100 bg-[#232323]"
                    disabled={!canShow2025}
                  >
                    2025 Season {canShow2025 ? "" : "(after draft)"}
                  </option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                  <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="bg-red-900 border border-red-700 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-red-200 mb-2">Unable to Load Standings</h3>
              <p className="text-red-300">{error}</p>
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
            <div className="relative bg-gradient-to-br from-yellow-900 via-yellow-800 to-amber-900 border-2 border-yellow-700 rounded-3xl shadow-2xl p-8 max-w-lg mx-auto transform hover:scale-105 transition-all duration-300 overflow-hidden">
              {/* Trophy in top left */}
              <div className="absolute top-4 left-4 z-20">
                <Image
                  src={getTrophyUrl(1, year) ?? ""}
                  alt="Champion Trophy"
                  width={96}
                  height={96}
                  className="mx-auto"
                />
              </div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-700 to-yellow-900 p-2 shadow-2xl mb-4">
                  <Image
                    src={champion.logo}
                    alt={`${champion.name} logo`}
                    width={112}
                    height={112}
                    className="w-full h-full rounded-full object-cover border-4 border-[#232323] shadow-lg"
                  />
                </div>
                <Link
                  href={`/roster?year=${year}&teamId=${champion.id}`}
                  className="text-2xl font-bold text-yellow-300 mb-2 underline hover:text-yellow-200 transition-colors"
                >
                  {champion.name}
                </Link>
                <div className="text-yellow-200 text-lg font-normal mt-1">{champion.record}</div>
                <p className="text-yellow-200 font-medium">
                  Champion:{" "}
                  <Link
                    href={`/manager?name=${encodeURIComponent(champion.realManager)}`}
                    className="font-bold text-yellow-100 underline hover:text-emerald-300 transition"
                  >
                    {champion.manager}
                  </Link>
                </p>
              </div>
            </div>

            {/* Runner-up & Third Place Cards */}
            <div className="flex flex-col sm:flex-row justify-center gap-8 mt-8">
              {/* Runner-up (2nd place) */}
              {teams[1] && (
                <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-slate-700 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto sm:mx-0 transform hover:scale-105 transition-all duration-300 overflow-hidden">
                  {/* Trophy in top left */}
                  <div className="absolute top-4 left-4 z-20">
                    <Image
                      src={getTrophyUrl(2, year) ?? ""}
                      alt="Runner-up Trophy"
                      width={84}
                      height={84}
                      className="mx-auto"
                    />
                  </div>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 p-2 shadow-xl mb-2">
                      <Image
                        src={teams[1].logo}
                        alt={`${teams[1].name} logo`}
                        width={80}
                        height={80}
                        className="w-full h-full rounded-full object-cover border-4 border-[#232323] shadow-lg"
                      />
                    </div>
                    <Link
                      href={`/roster?year=${year}&teamId=${teams[1].id}`}
                      className="text-xl font-bold text-emerald-200 mb-1 underline hover:text-emerald-100 transition-colors"
                    >
                      {teams[1].name}
                    </Link>
                    <div className="text-emerald-400 text-base font-normal mt-1">{teams[1].record}</div>
                    <p className="text-emerald-300 font-medium">
                      Runner-up:{" "}
                      <Link
                        href={`/manager?name=${encodeURIComponent(teams[1].realManager)}`}
                        className="font-bold underline text-emerald-100 hover:text-yellow-200 transition"
                      >
                        {teams[1].manager}
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Third Place (3rd place) */}
              {teams[2] && (
                <div className="relative bg-gradient-to-br from-amber-900 via-yellow-900 to-yellow-800 border-2 border-amber-700 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto sm:mx-0 transform hover:scale-105 transition-all duration-300 overflow-hidden">
                  {/* Trophy in top left */}
                  <div className="absolute top-4 left-4 z-20">
                    <Image
                      src={getTrophyUrl(3, year) ?? ""}
                      alt="Third Place Trophy"
                      width={84}
                      height={84}
                      className="mx-auto"
                    />
                  </div>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-700 to-yellow-900 p-2 shadow-xl mb-2">
                      <Image
                        src={teams[2].logo}
                        alt={`${teams[2].name} logo`}
                        width={80}
                        height={80}
                        className="w-full h-full rounded-full object-cover border-4 border-[#232323] shadow-lg"
                      />
                    </div>
                    <Link
                      href={`/roster?year=${year}&teamId=${teams[2].id}`}
                      className="text-xl font-bold text-yellow-200 mb-1 underline hover:text-yellow-100 transition-colors"
                    >
                      {teams[2].name}
                    </Link>
                    <div className="text-yellow-200 text-base font-normal mt-1">{teams[2].record}</div>
                    <p className="text-yellow-200 font-medium">
                      Third Place:{" "}
                      <Link
                        href={`/manager?name=${encodeURIComponent(teams[2].realManager)}`}
                        className="font-bold underline text-yellow-100 hover:text-emerald-300 transition"
                      >
                        {teams[2].manager}
                      </Link>
                    </p>
                  </div>
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
                  <h2 className="text-2xl font-bold text-emerald-200 mb-4 text-center">Playoff Teams</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
                    {playoffs.map(team => (
                      <div
                        key={team.id}
                        className="relative bg-[#232323] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-emerald-700 overflow-hidden p-6 text-center"
                      >
                        {/* Rank Badge */}
                        <div className="absolute top-4 left-4 z-10">
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg
                            ${team.rank === 2
                              ? "bg-gradient-to-r from-slate-700 to-slate-900 text-emerald-100"
                              : team.rank === 3
                                ? "bg-gradient-to-r from-amber-700 to-yellow-900 text-yellow-100"
                                : "bg-gradient-to-r from-emerald-700 to-emerald-900 text-emerald-100"
                          }`}>
                            #{team.rank}
                          </span>
                        </div>
                        {/* Team Logo */}
                        <div className="mx-auto mb-4">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 p-2 shadow-lg mx-auto">
                            <Image
                              src={team.logo}
                              alt={`${team.name} logo`}
                              width={80}
                              height={80}
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                        </div>
                        {/* Team Name (clickable) */}
                        <Link
                          href={`/roster?year=${year}&teamId=${team.id}`}
                          className="block text-lg font-bold text-emerald-200 underline hover:text-emerald-100 transition mb-1"
                        >
                          {team.name}
                        </Link>
                        <div className="text-emerald-400 text-base font-normal mt-1">{team.record}</div>
                        {/* Manager Name (clickable) */}
                        <p className="text-emerald-400 font-medium mb-2">
                          <span className="text-emerald-300">Manager:</span>{" "}
                          <Link
                            href={`/manager?name=${encodeURIComponent(team.realManager)}`}
                            className="underline text-emerald-200 hover:text-emerald-100 transition"
                          >
                            {team.manager}
                          </Link>
                        </p>
                        {/* Playoff Badge */}
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                          ${team.rank === 2
                            ? "bg-slate-800 text-emerald-100 border border-slate-700"
                            : team.rank === 3
                              ? "bg-amber-900 text-yellow-100 border border-amber-700"
                              : "bg-emerald-900 text-emerald-100 border border-emerald-700"
                        }`}>
                          {team.rank === 2
                            ? "🥈 Runner-up"
                            : team.rank === 3
                              ? "🥉 Third Place"
                              : `Playoffs (#${team.rank})`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Eliminated Section */}
              {eliminated.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-red-400 mb-4 text-center">Eliminated Teams</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
                    {eliminated.map(team => (
                      <div
                        key={team.id}
                        className="relative bg-[#232323] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-red-700 overflow-hidden p-6 text-center"
                      >
                        {/* Rank Badge */}
                        <div className="absolute top-4 left-4 z-10">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r from-red-700 to-red-900 text-red-100">
                            #{team.rank}
                          </span>
                        </div>
                        {/* Team Logo */}
                        <div className="mx-auto mb-4">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 p-2 shadow-lg mx-auto">
                            <Image
                              src={team.logo}
                              alt={`${team.name} logo`}
                              width={80}
                              height={80}
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                        </div>
                        {/* Team Name (clickable) */}
                        <Link
                          href={`/roster?year=${year}&teamId=${team.id}`}
                          className="block text-lg font-bold text-red-300 underline hover:text-red-100 transition mb-1"
                        >
                          {team.name}
                        </Link>
                        <div className="text-red-400 text-base font-normal mt-1">{team.record}</div>
                        {/* Manager Name (clickable) */}
                        <p className="text-red-400 font-medium mb-2">
                          <span className="text-red-300">Manager:</span>{" "}
                          <Link
                            href={`/manager?name=${encodeURIComponent(team.realManager)}`}
                            className="underline text-red-200 hover:text-emerald-300 transition"
                          >
                            {team.manager}
                          </Link>
                        </p>
                        {/* Eliminated Badge */}
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-900 text-red-100 border border-red-700">
                          Eliminated (#{team.rank})
                        </span>
                      </div>
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
            <h3 className="text-2xl font-semibold text-emerald-200 mb-2">No Standings Available</h3>
            <p className="text-emerald-400">Unable to load standings for the {year} season.</p>
          </div>
        )}
      </div>
    </div >
  );
};

function getDisplayManagerName(name: string) {
  if (name === "Jacob") return "Harris";
  if (name === "jake.hughes275") return "Hughes";
  if (name === "johnny5david") return "Johnny";
  if (name === "Zachary") return "Zach";
  if (name === "Michael") return "Mike";
  return name;
}

function getTrophyUrl(place: number, season: string) {
  if (![1, 2, 3].includes(place)) return undefined;
  if (season === "2017") {
      return `https://s.yimg.com/cv/ae/default/170508/tr_nfl_${place}_2017.png`;
  }
  return `https://s.yimg.com/cv/apiv2/default/170508/tr_nfl_${place}_${season}.png`;
}

export default StandingsViewer;
