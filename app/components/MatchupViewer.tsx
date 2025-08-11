"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface PlayerStats {
    byeWeek?: number | null;
    fanPts?: number | null;
    projPts?: number | null;
    [key: string]: any;
}

interface Player {
    playerKey: string;
    id: string;
    name: string;
    position: string;
    team: string;
    headshotUrl?: string;
    selectedPosition?: string;
    stats?: PlayerStats;
}

interface TeamData {
    teamId: string;
    teamName: string;
    teamLogo: string;
    managerName: string;
    managerImg: string;
    players: Player[];
}

export default function MatchupViewer() {
    const searchParams = useSearchParams();

    const team1Id = searchParams.get("team1Id") || "";
    const team2Id = searchParams.get("team2Id") || "";
    const year = searchParams.get("year") || "2024";
    const week = Number(searchParams.get("week")) || 1;

    const [team1Data, setTeam1Data] = useState<TeamData | null>(null);
    const [team2Data, setTeam2Data] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!team1Id || !team2Id) {
            setError("Missing team IDs in URL parameters.");
            setLoading(false);
            return;
        }

        async function fetchTeamData(teamId: string): Promise<TeamData> {
            const rosterRes = await fetch(
                `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${year}&teamId=${teamId}&week=${week}`
            );
            if (!rosterRes.ok) throw new Error("Failed to fetch roster");

            const rosterJson = await rosterRes.json();
            const team = rosterJson.fantasy_content.team[0];
            const roster = rosterJson.fantasy_content.team[1].roster;

            const teamName = team.find((item: any) => item.name)?.name || "";
            const teamLogo = team.find((item: any) => item.team_logos)?.team_logos[0].team_logo.url || "";
            const managerObj = team.find((item: any) => item.managers)?.managers[0].manager;
            const managerName = managerObj?.nickname || "";
            const managerImg = managerObj?.image_url || "";

            const playersObj = roster["0"]?.players || {};
            const parsedPlayers: Player[] = [];

            Object.keys(playersObj).forEach((key) => {
                const playerData = playersObj[key].player;
                if (!playerData) return;

                const metaArray = playerData[0];
                const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";

                parsedPlayers.push({
                    playerKey: getVal("player_key"),
                    id: getVal("player_id"),
                    name: getVal("name")?.full || "",
                    position: getVal("display_position"),
                    team: getVal("editorial_team_abbr"),
                    headshotUrl: getVal("headshot")?.url || "",
                    selectedPosition: playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "",
                });
            });

            if (parsedPlayers.length === 0) return { teamId, teamName, teamLogo, managerName, managerImg, players: [] };

            const playerKeys = parsedPlayers.map((p) => p.playerKey).join(",");
            const statsRes = await fetch(
                `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${year}&week=${week}&playerKeys=${playerKeys}`
            );
            if (!statsRes.ok) throw new Error("Failed to fetch player stats");

            const statsJson = await statsRes.json();
            const playersArray = statsJson.fantasy_content.players || {};
            const statsMap: Record<string, PlayerStats> = {};

            Object.values(playersArray).forEach((playerWrapper: any) => {
                const playerData = playerWrapper.player;
                if (!playerData) return;
                const metaArray = playerData[0];
                const playerKeyObj = metaArray.find((obj: any) => obj.player_key);
                const pKey = playerKeyObj?.player_key;
                if (!pKey) return;

                const byeObj = metaArray.find((obj: any) => "bye_weeks" in obj);
                const byeWeek = byeObj?.bye_weeks?.week ? Number(byeObj.bye_weeks.week) : null;

                let fanPts = null;
                let projPts = null;
                if (playerData[1]?.player_points) {
                    fanPts = Number(playerData[1].player_points.total_points) || null;
                    projPts = Number(playerData[1].player_points.projected_points) || null;
                }

                statsMap[pKey] = { byeWeek, fanPts, projPts };
            });

            const playersWithStats = parsedPlayers.map((p) => ({
                ...p,
                stats: statsMap[p.playerKey] || {},
            }));

            return { teamId, teamName, teamLogo, managerName, managerImg, players: playersWithStats };
        }

        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const [t1, t2] = await Promise.all([fetchTeamData(team1Id), fetchTeamData(team2Id)]);
                setTeam1Data(t1);
                setTeam2Data(t2);
            } catch {
                setError("Failed to load matchup data.");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [team1Id, team2Id, year, week]);

    const normalizeSlot = (s?: string) => {
        if (!s) return "";
        const up = s.toUpperCase();
        if (up === "BN") return "BN";
        if (up === "IR") return "IR";
        if (up.includes("QB")) return "QB";
        if (up.includes("WR")) return "WR";
        if (up.includes("RB")) return "RB";
        if (up.includes("TE")) return "TE";
        if (up.includes("W/R") || up.includes("W/R/T") || up.includes("FLEX") || up === "WRT")
            return "W/R";
        if (up.includes("K")) return "K";
        if (up.includes("DEF") || up.includes("DST")) return "DEF";
        return up;
    };

    const positionOrder = ["QB", "WR", "RB", "TE", "W/R", "K", "DEF", "BN", "IR"];

    function orderPlayers(players: Player[]): Player[] {
        const posMap = new Map<string, Player[]>();
        players.forEach((p) => {
            const norm = normalizeSlot(p.selectedPosition || p.position);
            const arr = posMap.get(norm) ?? [];
            arr.push(p);
            posMap.set(norm, arr);
        });

        const ordered: Player[] = [];
        for (const pos of positionOrder) {
            const list = posMap.get(pos);
            if (list) ordered.push(...list);
        }
        const includedKeys = new Set(ordered.map((p) => p.playerKey));
        players.forEach((p) => {
            if (!includedKeys.has(p.playerKey)) ordered.push(p);
        });
        return ordered;
    }

    const getPositionColor = (pos: string) => {
        switch (pos) {
            case "QB": return "bg-purple-100 text-purple-800 border-purple-200";
            case "WR": return "bg-blue-100 text-blue-800 border-blue-200";
            case "RB": return "bg-green-100 text-green-800 border-green-200";
            case "TE": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "W/R": return "bg-orange-100 text-orange-800 border-orange-200";
            case "K": return "bg-pink-100 text-pink-800 border-pink-200";
            case "DEF": return "bg-red-100 text-red-800 border-red-200";
            case "BN": return "bg-gray-100 text-gray-600 border-gray-200";
            case "IR": return "bg-slate-100 text-slate-600 border-slate-200";
            default: return "bg-gray-100 text-gray-600 border-gray-200";
        }
    };

    const calculateTeamTotals = (players: Player[]) => {
        const activePlayers = players.filter(p => {
            const pos = normalizeSlot(p.selectedPosition || p.position);
            return pos !== "BN" && pos !== "IR";
        });

        const totalPoints = activePlayers.reduce((sum, p) => sum + (p.stats?.fanPts || 0), 0);
        const totalProjected = activePlayers.reduce((sum, p) => sum + (p.stats?.projPts || 0), 0);

        return { totalPoints, totalProjected };
    };

    if (loading) {
        return (
            <div className="min-h-screen">
                <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="text-slate-600 text-lg mt-6 font-medium">Loading matchup details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen">
                <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-2xl font-semibold text-red-600 mb-2">Error Loading Matchup</h3>
                        <p className="text-slate-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!team1Data || !team2Data) {
        return (
            <div className="min-h-screen">
                <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">📊</div>
                        <h3 className="text-2xl font-semibold text-slate-700 mb-2">No Data Available</h3>
                        <p className="text-slate-500">Unable to load matchup information.</p>
                    </div>
                </div>
            </div>
        );
    }

    const team1Players = orderPlayers(team1Data.players);
    const team2Players = orderPlayers(team2Data.players);
    const team1Totals = calculateTeamTotals(team1Players);
    const team2Totals = calculateTeamTotals(team2Players);
    const winner = team1Totals.totalPoints > team2Totals.totalPoints ? "team1" : "team2";

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl mb-8 p-4 sm:p-6">
                    <div className="text-center mb-6">
                        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                            ⚔️ Head-to-Head Matchup
                        </h1>
                        <p className="text-emerald-100 font-medium text-sm sm:text-base">
                            Week {week} • {year} Season
                        </p>
                    </div>

                    {/* Team Matchup Display */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
                        {/* Team 1 */}
                        <div className="flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
                            <div className="relative">
                                {team1Data.teamLogo && (
                                    <img
                                        src={team1Data.teamLogo}
                                        alt={`${team1Data.teamName} Logo`}
                                        className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-full border-4 border-white/20 shadow-lg"
                                    />
                                )}
                                {winner === "team1" && (
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                                        <span className="text-white text-xs font-bold">👑</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white truncate max-w-[150px] sm:max-w-full">
                                    {team1Data.teamName}
                                </h2>
                                <p className="text-emerald-100 font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-full">
                                    {team1Data.managerName}
                                </p>
                                <div className="mt-1 sm:mt-2">
                                    <p
                                        className={`text-xl sm:text-2xl font-black ${winner === "team1" ? "text-yellow-300" : "text-white/90"
                                            }`}
                                    >
                                        {team1Totals.totalPoints.toFixed(2)}
                                    </p>
                                    <p className="text-emerald-200 text-xs sm:text-sm">
                                        Proj: {team1Totals.totalProjected.toFixed(1)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* VS */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-2 border border-white/30 select-none text-center flex-shrink-0">
                            <span className="text-white font-bold text-lg sm:text-xl">VS</span>
                        </div>

                        {/* Team 2 */}
                        <div className="flex flex-col items-center text-center sm:text-right sm:flex-row-reverse sm:items-center gap-3 sm:gap-4 flex-1">
                            <div className="relative">
                                {team2Data.teamLogo && (
                                    <img
                                        src={team2Data.teamLogo}
                                        alt={`${team2Data.teamName} Logo`}
                                        className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-full border-4 border-white/20 shadow-lg"
                                    />
                                )}
                                {winner === "team2" && (
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                                        <span className="text-white text-xs font-bold">👑</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white truncate max-w-[150px] sm:max-w-full">
                                    {team2Data.teamName}
                                </h2>
                                <p className="text-emerald-100 font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-full">
                                    {team2Data.managerName}
                                </p>
                                <div className="mt-1 sm:mt-2">
                                    <p
                                        className={`text-xl sm:text-2xl font-black ${winner === "team2" ? "text-yellow-300" : "text-white/90"
                                            }`}
                                    >
                                        {team2Totals.totalPoints.toFixed(2)}
                                    </p>
                                    <p className="text-emerald-200 text-xs sm:text-sm">
                                        Proj: {team2Totals.totalProjected.toFixed(1)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Roster Comparison Table */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200/50">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] sm:min-w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-slate-100 to-slate-200">
                                    {/* Team 1 Headers */}
                                    <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b border-slate-300 text-xs sm:text-sm">
                                        <div className="flex items-center gap-2">
                                            <span>{team1Data.teamName}</span>
                                        </div>
                                    </th>
                                    <th className="px-2 py-3 text-center font-semibold text-slate-700 border-b border-slate-300 text-xs sm:text-sm min-w-[60px]">
                                        Projected
                                    </th>
                                    <th className="px-2 py-3 text-center font-semibold text-slate-700 border-b border-slate-300 text-xs sm:text-sm min-w-[60px]">
                                        Points
                                    </th>

                                    {/* Center Position Column */}
                                    <th className="px-2 py-3 text-center font-bold text-slate-800 border-b-2 border-slate-400 bg-slate-300 text-xs sm:text-sm min-w-[60px]">
                                        Position
                                    </th>

                                    {/* Team 2 Headers */}
                                    <th className="px-2 py-3 text-center font-semibold text-slate-700 border-b border-slate-300 text-xs sm:text-sm min-w-[60px]">
                                        Points
                                    </th>
                                    <th className="px-2 py-3 text-center font-semibold text-slate-700 border-b border-slate-300 text-xs sm:text-sm min-w-[60px]">
                                        Projected
                                    </th>
                                    <th className="px-3 py-3 text-right font-semibold text-slate-700 border-b border-slate-300 text-xs sm:text-sm">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>{team2Data.teamName}</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from(
                                    { length: Math.max(team1Players.length, team2Players.length) },
                                    (_, i) => {
                                        const player1 = team1Players[i];
                                        const player2 = team2Players[i];

                                        const centerPos =
                                            normalizeSlot(player1?.selectedPosition || player1?.position) ||
                                            normalizeSlot(player2?.selectedPosition || player2?.position) ||
                                            "";

                                        const isStarter = centerPos !== "BN" && centerPos !== "IR";

                                        return (
                                            <tr
                                                key={i}
                                                className={`transition-colors duration-150 ${isStarter
                                                        ? "bg-white hover:bg-emerald-50 border-l-4 border-l-emerald-500"
                                                        : "bg-slate-50 hover:bg-slate-100 border-l-4 border-l-slate-300"
                                                    }`}
                                            >
                                                {/* Team 1 Player */}
                                                {player1 ? (
                                                    <>
                                                        <td className="px-3 py-3 border-b border-slate-200">
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                {player1.headshotUrl ? (
                                                                    <img
                                                                        src={player1.headshotUrl}
                                                                        alt={player1.name}
                                                                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                                                                        <span className="text-slate-600 font-semibold text-xs sm:text-sm">
                                                                            {player1.name.charAt(0)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-semibold text-slate-800 truncate text-xs sm:text-sm">
                                                                        {player1.name}
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-slate-500 truncate">
                                                                        {player1.team} • {player1.position}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-3 text-center border-b border-slate-200 text-xs sm:text-sm">
                                                            <span
                                                                className={`font-bold ${player1.stats?.fanPts && player1.stats.fanPts > 0
                                                                        ? "text-emerald-600"
                                                                        : "text-slate-500"
                                                                    }`}
                                                            >
                                                                {player1.stats?.fanPts != null
                                                                    ? player1.stats.fanPts.toFixed(1)
                                                                    : "-"}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-3 text-center border-b border-slate-200 text-xs sm:text-sm">
                                                            <span className="text-slate-600 font-medium">
                                                                {player1.stats?.projPts != null
                                                                    ? player1.stats.projPts.toFixed(1)
                                                                    : "-"}
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-3 py-3 border-b border-slate-200"></td>
                                                        <td className="px-2 py-3 border-b border-slate-200"></td>
                                                        <td className="px-2 py-3 border-b border-slate-200"></td>
                                                    </>
                                                )}

                                                {/* Center Position */}
                                                <td className="px-2 py-3 text-center border-b border-slate-300 bg-slate-50 text-xs sm:text-sm">
                                                    {centerPos && (
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getPositionColor(
                                                                centerPos
                                                            )}`}
                                                        >
                                                            {centerPos}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Team 2 Player */}
                                                {player2 ? (
                                                    <>
                                                        <td className="px-2 py-3 text-center border-b border-slate-200 text-xs sm:text-sm">
                                                            <span className="text-slate-600 font-medium">
                                                                {player2.stats?.projPts != null
                                                                    ? player2.stats.projPts.toFixed(1)
                                                                    : "-"}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-3 text-center border-b border-slate-200 text-xs sm:text-sm">
                                                            <span
                                                                className={`font-bold ${player2.stats?.fanPts && player2.stats.fanPts > 0
                                                                        ? "text-emerald-600"
                                                                        : "text-slate-500"
                                                                    }`}
                                                            >
                                                                {player2.stats?.fanPts != null
                                                                    ? player2.stats.fanPts.toFixed(1)
                                                                    : "-"}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3 border-b border-slate-200">
                                                            <div className="flex items-center justify-end gap-2 sm:gap-3">
                                                                <div className="min-w-0 flex-1 text-right">
                                                                    <p className="font-semibold text-slate-800 truncate text-xs sm:text-sm">
                                                                        {player2.name}
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-slate-500 truncate">
                                                                        {player2.team} • {player2.position}
                                                                    </p>
                                                                </div>
                                                                {player2.headshotUrl ? (
                                                                    <img
                                                                        src={player2.headshotUrl}
                                                                        alt={player2.name}
                                                                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                                                                        <span className="text-slate-600 font-semibold text-xs sm:text-sm">
                                                                            {player2.name.charAt(0)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-2 py-3 border-b border-slate-200"></td>
                                                        <td className="px-2 py-3 border-b border-slate-200"></td>
                                                        <td className="px-3 py-3 border-b border-slate-200"></td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    }
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}