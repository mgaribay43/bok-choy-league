'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Team {
    name: string;
    manager: string;
    score: number;
    projected: number;
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
                                projected: parseFloat(stats.team_projected_points?.total) || 0,
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
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl mb-8 p-6 sm:p-8">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
                        <div className="text-center lg:text-left">
                            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                                ⚔️ Matchups
                            </h1>
                            <p className="text-emerald-100 text-lg font-medium">
                                Week {selectedWeek} • {selectedYear} Season
                            </p>
                        </div>

                        {showSelectors && (
                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-end">
                                <div className="relative">
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="appearance-none bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-xl px-4 py-3 pr-10 font-medium focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
                                    >
                                        {availableYears.map((year) => (
                                            <option key={year} value={year} className="text-gray-900">
                                                {year}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="relative">
                                    <select
                                        value={selectedWeek}
                                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                                        className="appearance-none bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-xl px-4 py-3 pr-10 font-medium focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
                                    >
                                        {availableWeeks.map((week) => (
                                            <option key={week} value={week} className="text-gray-900">
                                                Week {week}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="text-slate-600 text-lg mt-6 font-medium">Loading matchups...</p>
                    </div>
                ) : matchups.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🏈</div>
                        <h3 className="text-2xl font-semibold text-slate-700 mb-2">No Matchups Found</h3>
                        <p className="text-slate-500">Try selecting a different week or season.</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {matchups.map((match, idx) => (
                            <Link
                                key={idx}
                                href={`/matchupView?team1Id=${match.team1.id}&team2Id=${match.team2.id}&year=${selectedYear}&week=${selectedWeek}`}
                                className="group block"
                            >
                                <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-200/50 overflow-hidden">
                                    {/* Desktop Layout */}
                                    <div className="hidden sm:flex items-center p-6 lg:p-8">
                                        {/* Team 1 */}
                                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                                            <div className="relative group-hover:scale-110 transition-transform duration-200">
                                                <Image
                                                    src={match.team1.logo}
                                                    alt={`${match.team1.name} logo`}
                                                    width={56}
                                                    height={56}
                                                    className="rounded-full border-3 border-slate-200 shadow-md"
                                                />
                                                {match.winner === "team1" && (
                                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">👑</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div
                                                    onClick={e => e.preventDefault()}
                                                    className="block text-slate-800 hover:text-emerald-600 transition-colors duration-200"
                                                >
                                                    <h3 className="text-xl font-bold truncate">{match.team1.name}</h3>
                                                    <p className="text-slate-500 font-medium">{match.team1.manager}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score Section */}
                                        <div className="flex items-center justify-center space-x-8 px-8">
                                            <div className="text-center">
                                                <div className={`text-4xl font-black ${match.winner === "team1" ? "text-emerald-600" : "text-slate-600"}`}>
                                                    {match.team1.score.toFixed(2)}
                                                </div>
                                                <div className="text-sm text-slate-400 font-medium mt-1">
                                                    Proj: {match.team1.projected.toFixed(1)}
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-full px-4 py-2">
                                                <span className="text-slate-600 font-bold text-lg">VS</span>
                                            </div>

                                            <div className="text-center">
                                                <div className={`text-4xl font-black ${match.winner === "team2" ? "text-emerald-600" : "text-slate-600"}`}>
                                                    {match.team2.score.toFixed(2)}
                                                </div>
                                                <div className="text-sm text-slate-400 font-medium mt-1">
                                                    Proj: {match.team2.projected.toFixed(1)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Team 2 */}
                                        <div className="flex items-center space-x-4 flex-1 min-w-0 justify-end">
                                            <div className="min-w-0 flex-1 text-right">
                                                <div
                                                    onClick={e => e.preventDefault()}
                                                    className="block text-slate-800 hover:text-emerald-600 transition-colors duration-200"
                                                >
                                                    <h3 className="text-xl font-bold truncate">{match.team2.name}</h3>
                                                    <p className="text-slate-500 font-medium">{match.team2.manager}</p>
                                                </div>
                                            </div>
                                            <div className="relative group-hover:scale-110 transition-transform duration-200">
                                                <Image
                                                    src={match.team2.logo}
                                                    alt={`${match.team2.name} logo`}
                                                    width={56}
                                                    height={56}
                                                    className="rounded-full border-3 border-slate-200 shadow-md"
                                                />
                                                {match.winner === "team2" && (
                                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">👑</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile Layout */}
                                    <div className="flex sm:hidden flex-col p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center space-x-3">
                                                <div className="relative">
                                                    <Image
                                                        src={match.team1.logo}
                                                        alt={`${match.team1.name} logo`}
                                                        width={48}
                                                        height={48}
                                                        className="rounded-full border-2 border-slate-200"
                                                    />
                                                    {match.winner === "team1" && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs">👑</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 truncate max-w-[120px]">{match.team1.name}</h3>
                                                    <p className="text-sm text-slate-500">{match.team1.manager}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-3">
                                                <div>
                                                    <h3 className="font-bold text-slate-800 truncate max-w-[120px] text-right">{match.team2.name}</h3>
                                                    <p className="text-sm text-slate-500 text-right">{match.team2.manager}</p>
                                                </div>
                                                <div className="relative">
                                                    <Image
                                                        src={match.team2.logo}
                                                        alt={`${match.team2.name} logo`}
                                                        width={48}
                                                        height={48}
                                                        className="rounded-full border-2 border-slate-200"
                                                    />
                                                    {match.winner === "team2" && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs">👑</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center space-x-6">
                                            <div className="text-center">
                                                <div className={`text-3xl font-black ${match.winner === "team1" ? "text-emerald-600" : "text-slate-600"}`}>
                                                    {match.team1.score.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-slate-400">Proj: {match.team1.projected.toFixed(1)}</div>
                                            </div>
                                            <span className="text-slate-400 font-bold">VS</span>
                                            <div className="text-center">
                                                <div className={`text-3xl font-black ${match.winner === "team2" ? "text-emerald-600" : "text-slate-600"}`}>
                                                    {match.team2.score.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-slate-400">Proj: {match.team2.projected.toFixed(1)}</div>
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