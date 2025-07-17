"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface Team {
    name: string;
    manager: string;
    score: number;
    projected: number;
    logo: string;
    draftGrade: string;
    felo: string;
    tier: string;
}

interface Matchup {
    team1: Team;
    team2: Team;
    winner: "team1" | "team2";
    type: string;
}

const years = Array.from({ length: 2025 - 2017 + 1 }, (_, i) => 2017 + i);

export default function MatchupsPage() {
    const [selectedYear, setSelectedYear] = useState(2024);
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [matchups, setMatchups] = useState<Matchup[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${selectedYear}&week=${selectedWeek}`);
                const data = await res.json();

                const rawMatchups = data?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
                if (!rawMatchups) {
                    setMatchups([]);
                    return;
                }

                const parsedMatchups: Matchup[] = Object.values(rawMatchups)
                    .map((m: any) => {
                        const matchup = m.matchup?.[0];
                        const teamsData = matchup?.teams;

                        if (!teamsData || !teamsData[0]?.team || !teamsData[1]?.team) {
                            // skip this matchup if missing teams
                            return null;
                        }

                        const team1Raw = teamsData[0].team;
                        const team2Raw = teamsData[1].team;

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
                                draftGrade: info.find((item: any) => item.has_draft_grade)?.draft_grade || "N/A",
                                felo: managerInfo?.felo_score || "N/A",
                                tier: managerInfo?.felo_tier || "N/A",
                            };
                        };

                        const team1 = parseTeam(team1Raw);
                        const team2 = parseTeam(team2Raw);

                        const winner = (team1.score > team2.score ? "team1" : "team2") as "team1" | "team2";

                        return {
                            team1,
                            team2,
                            winner,
                            type: matchup?.type || "Regular",
                        };
                    })
                    .filter((m): m is Matchup => m !== null); // remove null entries

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
        <div className="p-4 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-center text-green-800">🥬 Bok Choy League Matchups</h1>
            <div className="mb-6 text-center flex justify-center items-center">
                <label htmlFor="year-select" className="mr-2 font-medium text-gray-700">Select Year:</label>
                <div className="inline-block mr-4">
                    <select
                        id="year-select"
                        value={selectedYear}
                        onChange={(e) => {
                            const newYear = Number(e.target.value);
                            setSelectedYear(newYear);
                            setSelectedWeek(1); // Reset week to 1 whenever year changes
                        }}
                        className="border rounded px-3 py-2 bg-white shadow"
                    >
                        {Array.from({ length: 2025 - 2017 + 1 }, (_, i) => (2025 - i).toString()).map((y) => (
                            <option key={y} value={y} disabled={y === "2025"}>
                                {y} {y === "2025" ? "(Coming Soon)" : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <label htmlFor="week-select" className="mr-2 font-medium text-gray-700">Select Week:</label>
                <select
                    id="week-select"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    className="border rounded px-3 py-2 bg-white shadow"
                >
                    {Array.from({ length: 17 }, (_, i) => i + 1)
                        .filter((week) => !(week === 17 && selectedYear >= 2017 && selectedYear <= 2020))
                        .map((week) => (
                            <option key={week} value={week}>
                                Week {week}
                            </option>
                        ))}
                </select>
            </div>


            {loading ? (
                <p className="text-center text-gray-500">Loading matchups...</p>
            ) : (
                <div className="space-y-6">
                    {matchups.map((match, i) => (
                        <div key={i} className="bg-white rounded-2xl shadow p-4">
                            <p className="text-center text-sm text-gray-500 mb-2">{match.type} Matchup</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[match.team1, match.team2].map((team, index) => (
                                    <div key={index} className={`p-2 rounded-xl border ${match.winner === `team${index + 1}` ? 'border-green-600' : 'border-gray-300'}`}>
                                        <div className="flex items-center space-x-3">
                                            <Image
                                                src={team.logo}
                                                alt="logo"
                                                width={48}
                                                height={48}
                                                className="rounded-full border"
                                            />
                                            <div>
                                                <h2 className="font-bold text-lg">{team.name}</h2>
                                                <p className="text-sm text-gray-500">Manager: {team.manager}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-sm">
                                            <p><strong>Score:</strong> {team.score}</p>
                                            <p><strong>Projected:</strong> {team.projected}</p>
                                            <p><strong>Draft Grade:</strong> {team.draftGrade}</p>
                                            <p><strong>Felo:</strong> {team.felo} ({team.tier})</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
