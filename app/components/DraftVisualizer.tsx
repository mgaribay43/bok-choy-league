'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import leagueKeysByYearJson from "../data/League_Keys/league_keys.json";

interface DraftPick {
    pick: number;
    round: number;
    player_key: string;
    team_key: string;
}

interface Player {
    player_key: string;
    name: string;
    team: string;
    position: string;
    image_url: string;
}

const positionColors: Record<string, string> = {
    QB: "bg-red-200",
    RB: "bg-green-200",
    WR: "bg-blue-200",
    TE: "bg-yellow-200",
    K: "bg-purple-200",
    DEF: "bg-gray-300",
};

export default function DraftBoardPage() {
    const [selectedYear, setSelectedYear] = useState("");
    const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
    const [players, setPlayers] = useState<Record<string, Player>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [teamManagers, setTeamManagers] = useState<Record<string, string>>({});
    const leagueKeysByYear = leagueKeysByYearJson as Record<string, string>;

    useEffect(() => {
        if (!selectedYear) {
            setDraftPicks([]);
            setPlayers({});
            setError(null);
            setLoading(false);
            return;
        }

        async function fetchData() {
            if (!leagueKeysByYear[selectedYear]) {
                setError(`No league key for year ${selectedYear}`);
                setDraftPicks([]);
                setPlayers({});
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const teamsRes = await fetch(
                    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=teams&year=${selectedYear}`
                );
                const teamsText = await teamsRes.text();
                const teamsJson = JSON.parse(teamsText.replace(/^callback\((.*)\)$/, "$1"));
                setTeamManagers(extractTeamManagerMap(teamsJson));

                const draftRes = await fetch(
                    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=draftresults&year=${selectedYear}`
                );
                const draftText = await draftRes.text();
                const draftJson = JSON.parse(draftText.replace(/^callback\((.*)\)$/, "$1"));
                const picks = extractDraftPicks(draftJson);
                setDraftPicks(picks);

                const uniquePlayerKeys = [...new Set(picks.map((p) => p.player_key))];
                const batchSize = 25;
                const allPlayers: Record<string, Player> = {};
                for (let i = 0; i < uniquePlayerKeys.length; i += batchSize) {
                    const batchKeys = uniquePlayerKeys.slice(i, i + batchSize).join(",");
                    const pRes = await fetch(
                        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=players&year=${selectedYear}&playerKeys=${batchKeys}`
                    );
                    const pText = await pRes.text();
                    const pJson = JSON.parse(pText.replace(/^callback\((.*)\)$/, "$1"));
                    Object.assign(allPlayers, extractPlayerMap(pJson));
                }
                setPlayers(allPlayers);
            } catch (err: any) {
                setError(err?.message || "Failed to load draft data");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [selectedYear]);

    const groupedByRoundAndTeam: Record<number, Record<string, DraftPick>> = {};
    draftPicks.forEach((pick) => {
        if (!groupedByRoundAndTeam[pick.round]) groupedByRoundAndTeam[pick.round] = {};
        groupedByRoundAndTeam[pick.round][pick.team_key] = pick;
    });

    const rounds = [...new Set(draftPicks.map((p) => p.round))].sort((a, b) => a - b);
    const teamOrder = draftPicks
        .filter((p) => p.round === 1)
        .sort((a, b) => a.pick - b.pick)
        .map((p) => p.team_key);

    const teamKeyToName: Record<string, string> = {};
    for (const key of teamOrder) {
        teamKeyToName[key] = teamManagers[key] || key;
    }

    const pickMap: Record<number, DraftPick> = {};
    draftPicks.forEach((p) => {
        pickMap[p.pick] = p;
    });

    return (
        <div className="w-full overflow-x-auto px-2 py-0">
            <h1 className="text-4xl font-extrabold text-center mb-8 text-green-800">Draft Board</h1>

            <div className="mb-6 flex justify-center gap-4 flex-wrap">
                <label htmlFor="year-select" className="font-semibold self-center">
                    Select Year:
                </label>
                <select
                    id="year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 bg-white text-black"
                >
                    <option value="">Select Year</option>
                    {Object.keys(leagueKeysByYear)
                        .sort((a, b) => Number(b) - Number(a))
                        .map((year) => (
                            <option
                                key={year}
                                value={year}
                                disabled={year === "2025"}
                                className={year === "2025" ? "text-gray-400" : ""}
                            >
                                {year === "2025" ? "2025 (coming soon)" : year}
                            </option>
                        ))}
                </select>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    </div>
                    <p className="text-slate-600 text-lg mt-6 font-medium">Loading draft data...</p>
                </div>
            ) : error ? (
                <p className="text-center text-red-500">{error}</p>
            ) : !selectedYear ? (
                <p className="text-center italic text-gray-600">Please select a year to view the draft board.</p>
            ) : (
                <div className="overflow-x-auto max-h-[80vh] rounded shadow-md">
                    <table className="min-w-[900px] w-full border-separate border-spacing-0 text-sm md:text-base">
                        <thead className="bg-white sticky top-0 z-30 shadow-sm">
                            <tr>
                                {teamOrder.map((teamKey) => (
                                    <th
                                        key={teamKey}
                                        className="px-3 py-2 text-center w-28 whitespace-normal break-words font-semibold text-gray-700 border-b border-gray-300"
                                        title={teamKeyToName[teamKey]}
                                    >
                                        {teamKeyToName[teamKey] || teamKey}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rounds.map((round) => (
                                <tr key={round} className="hover:bg-gray-50 transition-colors duration-150">
                                    {teamOrder.map((teamKey, colIndex) => {
                                        const pick = groupedByRoundAndTeam[round]?.[teamKey];
                                        const player = pick ? players[pick.player_key] : null;
                                        const positionColorClass =
                                            player?.position && positionColors[player.position]
                                                ? positionColors[player.position]
                                                : "bg-white";

                                        const nextPick = pick ? pickMap[pick.pick + 1] : undefined;

                                        type ArrowDirection = "right" | "down" | "left" | null;
                                        let arrowDirection: ArrowDirection = null;

                                        if (nextPick) {
                                            const nextRound = nextPick.round;
                                            const nextTeamKey = nextPick.team_key;
                                            const nextColIndex = teamOrder.indexOf(nextTeamKey);

                                            if (nextRound === round) {
                                                if (nextColIndex === colIndex + 1) arrowDirection = "right";
                                                else if (nextColIndex === colIndex - 1) arrowDirection = "left";
                                            } else if (nextRound === round + 1) {
                                                if (nextColIndex === colIndex) {
                                                    arrowDirection = "down";
                                                } else if (nextColIndex < colIndex) {
                                                    arrowDirection = "left";
                                                }
                                            }
                                        }

                                        const rotationDegrees: Record<Exclude<ArrowDirection, null>, number> = {
                                            right: 0,
                                            down: 90,
                                            left: 180,
                                        };

                                        return (
                                            <td
                                                key={teamKey}
                                                className={`align-top p-1 rounded-md max-w-[9rem] min-w-[8rem] relative cursor-default ${positionColorClass}`}
                                                title={
                                                    player
                                                        ? `${player.name} (${player.team} - ${player.position})\nPick ${pick.pick}`
                                                        : undefined
                                                }
                                            >
                                                {player ? (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <Image
                                                                src={player.image_url}
                                                                alt={player.name}
                                                                width={28}
                                                                height={28}
                                                                className="rounded-full object-cover flex-shrink-0"
                                                            />
                                                            <div className="flex flex-col flex-shrink min-w-0 text-left">
                                                                {(() => {
                                                                    const [firstName, ...rest] = player.name.split(" ");
                                                                    const lastName = rest.join(" ");
                                                                    return (
                                                                        <>
                                                                            <p
                                                                                className="font-semibold text-gray-800 leading-tight"
                                                                                style={{
                                                                                    fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)",
                                                                                    lineHeight: 1.1,
                                                                                }}
                                                                                title={player.name}
                                                                            >
                                                                                {firstName}
                                                                            </p>
                                                                            <p
                                                                                className="font-semibold text-gray-700 leading-tight"
                                                                                style={{
                                                                                    fontSize: "clamp(0.65rem, 1.3vw, 0.85rem)",
                                                                                    lineHeight: 1.1,
                                                                                }}
                                                                            >
                                                                                {lastName}
                                                                            </p>
                                                                        </>
                                                                    );
                                                                })()}
                                                                <p
                                                                    className="text-xs text-gray-600"
                                                                    style={{ fontSize: "clamp(0.55rem, 1vw, 0.65rem)" }}
                                                                >
                                                                    {player.team} – {player.position}
                                                                </p>
                                                                <p
                                                                    className="text-xs text-gray-500"
                                                                    style={{ fontSize: "clamp(0.5rem, 0.9vw, 0.6rem)" }}
                                                                >
                                                                    Pick {pick.pick}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {arrowDirection && (
                                                            <div
                                                                className="absolute bottom-1 right-1"
                                                                style={{
                                                                    width: "1rem",
                                                                    height: "1rem",
                                                                    transform: `rotate(${rotationDegrees[arrowDirection]}deg)`,
                                                                    transition: "transform 0.3s ease",
                                                                }}
                                                                aria-label={`Next pick: ${nextPick!.pick}`}
                                                                title={`Next pick: ${nextPick!.pick}`}
                                                            >
                                                                <svg
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="black"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    className="w-full h-full"
                                                                >
                                                                    <line x1="3" y1="12" x2="21" y2="12" />
                                                                    <polyline points="15 6 21 12 15 18" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="italic text-gray-400">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

}

function extractTeamManagerMap(teamsData: any): Record<string, string> {
    const teams = teamsData?.fantasy_content?.league?.[1]?.teams;
    if (!teams) return {};

    const result: Record<string, string> = {};

    Object.entries(teams).forEach(([key, value]) => {
        if (key === "count") return;

        const teamArray = (value as any).team;
        if (!Array.isArray(teamArray) || teamArray.length === 0) return;

        const teamInfoArray = teamArray[0];

        const teamKeyObj = teamInfoArray.find((item: any) => "team_key" in item);
        const teamKey = teamKeyObj?.team_key;

        const nameObj = teamInfoArray.find((item: any) => "name" in item);
        const teamName = nameObj?.name;

        const managersObj = teamInfoArray.find((item: any) => "managers" in item);
        const nickname = managersObj?.managers?.[0]?.manager?.nickname;

        if (teamKey) {
            result[teamKey] = teamName || nickname || teamKey;
        }
    });

    return result;
}

function extractDraftPicks(draftData: any): DraftPick[] {
    const draftResultsObj = draftData.fantasy_content?.league?.[1]?.draft_results;
    if (!draftResultsObj) return [];

    const draftEntries = Object.values(draftResultsObj) as any[];
    const picks: DraftPick[] = [];

    for (const entry of draftEntries) {
        const result = entry?.draft_result;
        if (!result) continue;

        const resultArray = Array.isArray(result) ? result : [result];

        for (const pick of resultArray) {
            if (!pick || !pick.pick || !pick.player_key) continue;

            picks.push({
                pick: Number(pick.pick),
                round: Number(pick.round),
                player_key: pick.player_key,
                team_key: pick.team_key,
            });
        }
    }

    return picks;
}

function extractPlayerMap(playersData: any): Record<string, Player> {
    const playerList = playersData.fantasy_content?.players || {};
    const playerEntries = Object.entries(playerList).filter(([key]) => key !== "count");

    const playerMap: Record<string, Player> = {};

    for (const [, playerEntry] of playerEntries) {
        const playerArr = (playerEntry as any).player?.[0];
        if (!Array.isArray(playerArr)) continue;

        const playerKey = playerArr.find((item: any) => item.player_key)?.player_key || "";
        const fullName = playerArr.find((item: any) => item.name)?.name?.full || "Unknown Player";
        const team = playerArr.find((item: any) => item.editorial_team_abbr)?.editorial_team_abbr || "FA";
        const position = playerArr.find((item: any) => item.display_position)?.display_position || "";
        const image_url = playerArr.find((item: any) => item.image_url)?.image_url || "/fallback-avatar.png";

        if (playerKey) {
            playerMap[playerKey] = {
                player_key: playerKey,
                name: fullName,
                team,
                position,
                image_url,
            };
        }
    }

    return playerMap;
}