'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Team {
    name: string;
    manager: string;
    score: number;
    logo: string;
    id: string;
}

interface Matchup {
    team1: Team;
    team2: Team;
    winner: "team1" | "team2";
    type: string;
}

interface MatchupsPageProps {
    showSelectors?: boolean;
    defaultYear?: number;
    defaultWeek?: number;
}

const MatchupsPage = ({
    showSelectors = true,
    defaultYear,
    defaultWeek,
}: MatchupsPageProps) => {
    const CURRENT_SEASON = 2024;
    const CURRENT_WEEK = 17;

    const [selectedYear, setSelectedYear] = useState<number>(
        defaultYear || CURRENT_SEASON
    );
    const [selectedWeek, setSelectedWeek] = useState<number>(
        defaultWeek || CURRENT_WEEK
    );
    const [matchups, setMatchups] = useState<Matchup[]>([]);
    const [loading, setLoading] = useState(false);

    const availableYears = Array.from(
        { length: CURRENT_SEASON - 2017 + 1 },
        (_, i) => 2017 + i
    );
    const maxWeek = selectedYear <= 2020 ? 16 : 17;
    const availableWeeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

    useEffect(() => {
        if (selectedWeek > maxWeek) {
            setSelectedWeek(maxWeek);
        }
    }, [selectedYear, maxWeek, selectedWeek]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${selectedYear}&week=${selectedWeek}`
                );
                const data = await res.json();

                const rawMatchups =
                    data?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
                if (!rawMatchups) {
                    setMatchups([]);
                    return;
                }

                const parsedMatchups: Matchup[] = Object.values(rawMatchups)
                    .map((m: any) => {
                        const matchupObj = m.matchup;
                        if (!matchupObj || typeof matchupObj !== "object") return null;

                        const matchup = Object.values(matchupObj)[0] as any;
                        if (!matchup) return null;

                        const teamsData = matchup.teams;
                        if (!teamsData?.["0"]?.team || !teamsData?.["1"]?.team) return null;

                        const parseTeam = (teamRaw: any): Team => {
                            const info = teamRaw[0];
                            const stats = teamRaw[1];
                            const managerInfo = info.find((item: any) => item.managers)?.managers[0]?.manager;
                            return {
                                name: info.find((item: any) => item.name)?.name || "N/A",
                                manager: managerInfo?.nickname || "N/A",
                                score: parseFloat(stats.team_points?.total) || 0,
                                logo: info.find((item: any) => item.team_logos)?.team_logos[0]?.team_logo.url || "",
                                id: info.find((item: any) => item.team_id)?.team_id || "N/A",
                            };
                        };

                        const team1 = parseTeam(teamsData["0"].team);
                        const team2 = parseTeam(teamsData["1"].team);
                        const winner = team1.score > team2.score ? "team1" : "team2";

                        return { team1, team2, winner, type: "Regular" };
                    })
                    .filter((m): m is Matchup => m !== null);

                setMatchups(parsedMatchups);
            } catch (err) {
                console.error("Failed to fetch matchups:", err);
                setMatchups([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedYear, selectedWeek]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl sm:rounded-2xl shadow-xl mb-4 sm:mb-8 p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="text-center">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
                                ⚔️ Matchups
                            </h1>
                            <p className="text-emerald-100 text-base sm:text-lg font-medium">
                                Week {selectedWeek} • {selectedYear} Season
                            </p>
                        </div>

                        {showSelectors && (
                            <div className="flex flex-col xs:flex-row gap-3 sm:gap-4">
                                <div className="relative flex-1">
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="w-full appearance-none bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pr-8 sm:pr-10 font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
                                    >
                                        {availableYears.map((year) => (
                                            <option key={year} value={year} className="text-gray-900">
                                                {year}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="relative flex-1">
                                    <select
                                        value={selectedWeek}
                                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                                        className="w-full appearance-none bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pr-8 sm:pr-10 font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
                                    >
                                        {availableWeeks.map((week) => (
                                            <option key={week} value={week} className="text-gray-900">
                                                Week {week}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                        <div className="relative">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="text-slate-600 text-base sm:text-lg mt-4 sm:mt-6 font-medium">Loading matchups...</p>
                    </div>
                ) : matchups.length === 0 ? (
                    <div className="text-center py-16 sm:py-20">
                        <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🏈</div>
                        <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Matchups Found</h3>
                        <p className="text-slate-500 text-sm sm:text-base">Try selecting a different week or season.</p>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-0 sm:grid sm:gap-4 md:gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {matchups.map((match, idx) => (
                            <Link
                                key={idx}
                                href={`/matchupView?team1Id=${match.team1.id}&team2Id=${match.team2.id}&year=${selectedYear}&week=${selectedWeek}`}
                                className="group block"
                            >
                                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-200/50 overflow-hidden active:scale-[0.98] sm:active:scale-100">
                                    {/* Mobile-First Layout */}
                                    <div className="p-4 sm:p-6">
                                        {/* Team 1 */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <Image
                                                    src={match.team1.logo}
                                                    alt={`${match.team1.name} logo`}
                                                    width={40}
                                                    height={40}
                                                    className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-slate-200 flex-shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">{match.team1.name}</h3>
                                                    <p className="text-xs sm:text-sm text-slate-500 truncate">{match.team1.manager}</p>
                                                </div>
                                            </div>
                                            <div className={`text-xl sm:text-2xl font-black ml-2 ${match.winner === "team1" ? "text-emerald-600" : "text-slate-400"}`}>
                                                {match.team1.score.toFixed(2)}
                                            </div>
                                        </div>

                                        {/* VS Divider */}
                                        <div className="flex items-center justify-center my-3 sm:my-4">
                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                                            <span className="px-3 text-slate-400 font-bold text-xs sm:text-sm">VS</span>
                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                                        </div>

                                        {/* Team 2 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <Image
                                                    src={match.team2.logo}
                                                    alt={`${match.team2.name} logo`}
                                                    width={40}
                                                    height={40}
                                                    className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-slate-200 flex-shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">{match.team2.name}</h3>
                                                    <p className="text-xs sm:text-sm text-slate-500 truncate">{match.team2.manager}</p>
                                                </div>
                                            </div>
                                            <div className={`text-xl sm:text-2xl font-black ml-2 ${match.winner === "team2" ? "text-emerald-600" : "text-slate-400"}`}>
                                                {match.team2.score.toFixed(2)}
                                            </div>
                                        </div>

                                        {/* Winner indicator for mobile */}
                                        <div className="mt-4 sm:hidden">
                                            <div className="text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                    🏆 {match.winner === "team1" ? match.team1.name : match.team2.name} Wins
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MatchupsPage;