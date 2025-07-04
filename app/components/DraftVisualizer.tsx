'use client';

import React, { useEffect, useState } from "react";

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

const leagueKeysByYear: Record<string, string> = {
    "2017": "371.l.912608",
    "2018": "380.l.727261",
    "2019": "390.l.701331",
    "2020": "399.l.635829",
    "2021": "406.l.11184",
    "2022": "414.l.548584",
    "2023": "423.l.397633",
    "2024": "449.l.111890",
    "2025": "461.l.128797",
};

const positionColors: Record<string, string> = {
    QB: "bg-red-200",
    RB: "bg-green-200",
    WR: "bg-blue-200",
    TE: "bg-yellow-200",
    K: "bg-purple-200",
    DEF: "bg-gray-300",
    // fallback: bg-white (no class)
};

export default function DraftBoardPage() {
    const [selectedYear, setSelectedYear] = useState("2024");
    const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
    const [players, setPlayers] = useState<Record<string, Player>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [teamManagers, setTeamManagers] = useState<Record<string, string>>({});

    useEffect(() => {
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
                // Fetch teams + managers
                const teamsRes = await fetch(
                    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=teams&year=${selectedYear}`
                );
                const teamsText = await teamsRes.text();
                const teamsJson = JSON.parse(teamsText.replace(/^callback\((.*)\)$/, "$1"));
                setTeamManagers(extractTeamManagerMap(teamsJson));

                // Fetch draft picks
                const draftRes = await fetch(
                    `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=draftresults&year=${selectedYear}`
                );
                const draftText = await draftRes.text();
                const draftJson = JSON.parse(draftText.replace(/^callback\((.*)\)$/, "$1"));
                const picks = extractDraftPicks(draftJson);
                setDraftPicks(picks);

                // Fetch player details in batches
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

    // Group data for easy lookup
    const groupedByRoundAndTeam: Record<number, Record<string, DraftPick>> = {};
    draftPicks.forEach((pick) => {
        if (!groupedByRoundAndTeam[pick.round]) groupedByRoundAndTeam[pick.round] = {};
        groupedByRoundAndTeam[pick.round][pick.team_key] = pick;
    });

    // Sort rounds & teams
    const rounds = [...new Set(draftPicks.map((p) => p.round))].sort((a, b) => a - b);
    const teamOrder = draftPicks
        .filter((p) => p.round === 1)
        .sort((a, b) => a.pick - b.pick)
        .map((p) => p.team_key);

    // Map team_key to name
    const teamKeyToName: Record<string, string> = {};
    for (const key of teamOrder) {
        teamKeyToName[key] = teamManagers[key] || key;
    }

    // Calculate column width (subtract left sticky col)
    // On desktop: evenly divide width by teams
    // On mobile: not used because stacked cards

    const colWidthPercent = teamOrder.length
        ? Math.floor(100 / teamOrder.length)
        : 100;

    // Responsive view: table on md+ screens, stacked cards on smaller

    return (
        <div className="w-full overflow-x-auto px-2 py-10">
            <h1 className="text-4xl font-extrabold text-center mb-8 text-green-800">Draft Board</h1>

            <div className="mb-6 flex justify-center gap-4 flex-wrap">
                <label htmlFor="year-select" className="font-semibold self-center">
                    Select Year:
                </label>
                <select
                    id="year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2"
                >
                    {Object.keys(leagueKeysByYear).map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>

            {loading && <p className="text-center">Loading draft data...</p>}
            {error && <p className="text-center text-red-500">{error}</p>}

            {!loading && !error && (
                <div className="overflow-x-auto">
                    <table className="table-fixed border-collapse w-full text-sm sm:text-xs md:text-sm min-w-[900px]">
                        <thead>
                            <tr>
                                <th className="border p-2 bg-gray-100 text-left w-24 sticky left-0 bg-white z-10">
                                    Round
                                </th>
                                {teamOrder.map((teamKey) => (
                                    <th
                                        key={teamKey}
                                        className="border p-2 bg-gray-100 text-center w-40 whitespace-nowrap"
                                    >
                                        {teamKeyToName[teamKey] || teamKey}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rounds.map((round) => (
                                <tr key={round}>
                                    <td className="border p-2 font-bold text-center bg-gray-50 w-24 sticky left-0 bg-white z-0">
                                        {round}
                                    </td>
                                    {teamOrder.map((teamKey) => {
                                        const pick = groupedByRoundAndTeam[round]?.[teamKey];
                                        const player = pick ? players[pick.player_key] : null;
                                        const positionColorClass =
                                            player?.position && positionColors[player.position]
                                                ? positionColors[player.position]
                                                : "bg-white";

                                        return (
                                            <td
                                                key={teamKey}
                                                className={`border p-2 text-center align-top truncate ${positionColorClass} w-40`}
                                                title={
                                                    player
                                                        ? `${player.name} (${player.team} - ${player.position})`
                                                        : undefined
                                                }
                                            >
                                                {player ? (
                                                    <>
                                                        <p className="font-semibold truncate">{player.name}</p>
                                                        <p className="text-xs truncate">
                                                            {player.team} – {player.position}
                                                        </p>
                                                        <p className="text-xs text-gray-700">Pick {pick.pick}</p>
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

/** Helper: Extract Team Names from Yahoo JSON */
function extractTeamManagerMap(teamsData: any): Record<string, string> {
    const teams = teamsData?.fantasy_content?.league?.[1]?.teams;
    if (!teams) return {};

    const result: Record<string, string> = {};

    Object.entries(teams).forEach(([key, value]) => {
        if (key === "count") return;

        const teamArray = (value as any).team;
        if (!Array.isArray(teamArray) || teamArray.length === 0) return;

        const teamInfoArray = teamArray[0]; // Array of key-value objects

        // Extract team_key
        const teamKeyObj = teamInfoArray.find((item: any) => "team_key" in item);
        const teamKey = teamKeyObj?.team_key;

        // Extract team name
        const nameObj = teamInfoArray.find((item: any) => "name" in item);
        const teamName = nameObj?.name;

        // Extract manager nickname
        const managersObj = teamInfoArray.find((item: any) => "managers" in item);
        const nickname = managersObj?.managers?.[0]?.manager?.nickname;

        if (teamKey) {
            // Prefer team name, fallback to manager nickname, then team key
            result[teamKey] = teamName || nickname || teamKey;
        }
    });

    return result;
}


/** Helper: Extract draft picks from Yahoo draftresults JSON */
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

/** Helper: Extract player info from Yahoo players API */
function extractPlayerMap(playersData: any): Record<string, Player> {
    const playerList = playersData.fantasy_content?.players || {};
    const playerEntries = Object.entries(playerList).filter(([key]) => key !== 'count');

    const playerMap: Record<string, Player> = {};

    for (const [, playerEntry] of playerEntries) {
        const playerArr = (playerEntry as any).player?.[0];
        if (!Array.isArray(playerArr)) continue;

        const playerKey = playerArr.find((item: any) => item.player_key)?.player_key || '';
        const fullName = playerArr.find((item: any) => item.name)?.name?.full || 'Unknown Player';
        const team = playerArr.find((item: any) => item.editorial_team_abbr)?.editorial_team_abbr || 'FA';
        const position = playerArr.find((item: any) => item.display_position)?.display_position || '';
        const image_url = playerArr.find((item: any) => item.image_url)?.image_url || '/fallback-avatar.png';

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
