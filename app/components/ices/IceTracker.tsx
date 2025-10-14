'use client';

import { useEffect, useState } from "react";
import { getCurrentWeek } from "../globalUtils/getCurrentWeek";
import { getCurrentSeason } from "../globalUtils/getCurrentSeason";
import { getDisplayManagerName } from "../globalUtils/getManagerNames";
import { getHighResPlayerImage } from "../globalUtils/getHighResPlayerImage";
import { isCurrentWeekOver } from "../globalUtils/isCurrentWeekOver";
import { useAuth } from "../../../context/AuthContext";
import AddIces from "../addIces"; // Import the AddIces modal directly

// Helper to get all teams and their starters for the current week
async function fetchAllStarters(season: string, week: number) {
    const settingsRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
    );
    const settingsJson = await settingsRes.json();
    const league = settingsJson?.fantasy_content?.league;
    const teamCount = Number(league?.[0]?.num_teams || 12);

    const allStarters: {
        teamId: string;
        teamName: string;
        managerName: string;
        teamLogo: string;
        starters: any[];
    }[] = [];

    for (let teamId = 1; teamId <= teamCount; teamId++) {
        const rosterRes = await fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${season}&teamId=${teamId}&week=${week}`
        );
        const json = await rosterRes.json();
        const team = json.fantasy_content.team[0];
        const roster = json.fantasy_content.team[1].roster;

        const teamName = team.find((item: any) => item.name)?.name || `Team ${teamId}`;
        const teamLogo = team.find((item: any) => item.team_logos)?.team_logos[0].team_logo.url || "";
        const managerObj = team.find((item: any) => item.managers)?.managers[0].manager;
        const managerName = managerObj?.nickname || "";

        const playersObj = roster?.["0"]?.players || {};
        const starters = Object.values(playersObj)
            .map((obj: any) => {
                const playerData = obj?.player;
                if (!playerData) return null;
                const metaArray = playerData[0];
                const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";
                return {
                    playerKey: getVal("player_key"),
                    id: getVal("player_id"),
                    name: getVal("name")?.full || "",
                    position: getVal("display_position"),
                    team: getVal("editorial_team_abbr"),
                    headshotUrl: getVal("headshot")?.url || "",
                    selectedPosition: playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "",
                };
            })
            .filter(
                (p: any) =>
                    p &&
                    p.selectedPosition !== "BN" &&
                    p.selectedPosition !== "IR"
            );

        allStarters.push({
            teamId: String(teamId),
            teamName,
            managerName,
            teamLogo,
            starters,
        });
    }
    return allStarters;
}

// Helper to build scoring map from Yahoo settings
function buildScoringMap(settingsJson: any) {
    const league = settingsJson?.fantasy_content?.league;
    const settings = league?.[1]?.settings?.[0] || {};
    const modifiers = settings?.stat_modifiers?.stats || [];
    const categories = settings?.stat_categories?.stats || [];
    const map: Record<string, number> = {};
    modifiers.forEach((s: any) => {
        const id = String(s?.stat?.stat_id ?? "");
        const val = parseFloat(s?.stat?.value ?? "0");
        if (id) map[id] = val;
    });
    categories.forEach((s: any) => {
        const id = String(s?.stat?.stat_id ?? "");
        const val = parseFloat(s?.stat?.points ?? "0");
        if (id && !(id in map) && Number.isFinite(val)) map[id] = val;
    });
    return map;
}

// Helper to calculate fantasy points using scoring map
function calcFanPts(statsArray: any[], scoringMap: Record<string, number>) {
    return Array.isArray(statsArray)
        ? statsArray.reduce((total, s) => {
            const id = String(s?.stat?.stat_id ?? "");
            if (!(id in scoringMap)) return total;
            const val = parseFloat(s?.stat?.value ?? "0");
            const mult = scoringMap[id];
            return Number.isFinite(val) && Number.isFinite(mult) ? total + val * mult : total;
        }, 0)
        : 0;
}

// Helper to get fantasy points for a batch of player keys using scoring map, batching by 25
async function fetchPlayerPoints(
    season: string,
    week: number,
    playerKeys: string[],
    scoringMap: Record<string, number>
) {
    if (!playerKeys.length) return {};
    const statsMap: Record<string, number> = {};

    // Yahoo API limit: 25 player keys per call
    const batchSize = 25;
    for (let i = 0; i < playerKeys.length; i += batchSize) {
        const batchKeys = playerKeys.slice(i, i + batchSize);
        const keysParam = batchKeys.join(",");
        const statsRes = await fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${season}&week=${week}&playerKeys=${keysParam}`
        );
        const statsJson = await statsRes.json();

        // Set all batch keys to 0 by default
        batchKeys.forEach((key) => {
            statsMap[key] = 0;
        });

        // Fill in actual points for those returned by the API
        Object.values(statsJson?.fantasy_content?.players || {}).forEach((playerWrapper: any) => {
            const pArr = playerWrapper?.player;
            if (!pArr) return;
            const metaArray = pArr[0];
            const playerKeyObj = metaArray.find((obj: any) => obj.player_key);
            const pKey = playerKeyObj?.player_key;
            if (!pKey) return;
            const rawStats = pArr?.[1]?.player_stats?.stats ?? [];
            statsMap[pKey] = calcFanPts(rawStats, scoringMap);
        });
    }

    return statsMap;
}

// Helper to fetch NFL games for a given week/year from your cloud function
async function fetchNFLGamesForWeek(week: number, year: number) {
    const res = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/nflMatchups?week=${week}&year=${year}`
    );
    if (!res.ok) {
        console.error("NFL Matchups fetch failed", res.status, await res.text());
        return {};
    }
    const data = await res.json();
    // Map by team abbreviation for quick lookup
    const games: Record<string, any> = {};
    (data?.data?.games || []).forEach((game: any) => {
        if (game.homeTeam?.abbreviation)
            games[game.homeTeam.abbreviation] = game;
        if (game.awayTeam?.abbreviation)
            games[game.awayTeam.abbreviation] = game;
    });
    return games;
}

// Map Yahoo abbreviations to NFL API abbreviations where needed
const YAHOO_TO_NFL_ABBR: Record<string, string> = {
    WAS: "WSH",
    JAC: "JAX",
    // Add more if you find other mismatches
};

function getNflGameForPlayerTeam(nflGames: Record<string, any>, yahooAbbr: string) {
    const nflAbbr = YAHOO_TO_NFL_ABBR[yahooAbbr?.toUpperCase()] || yahooAbbr?.toUpperCase();
    return nflGames[nflAbbr];
}

export default function IceTracker() {
    const [loading, setLoading] = useState(true);
    const [icePlayers, setIcePlayers] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    const [pointsMap, setPointsMap] = useState<Record<string, number>>({});
    const [nflGames, setNflGames] = useState<Record<string, any>>({});
    const [shouldPoll, setShouldPoll] = useState<boolean>(false);

    // Add Ice modal state
    const [showAddIceModal, setShowAddIceModal] = useState(false);
    const [addIcePrefill, setAddIcePrefill] = useState<any>(null);

    const { user } = useAuth() || {};

    useEffect(() => {
        let isMounted = true;
        let interval: NodeJS.Timeout | null = null;

        async function loadIcePlayers() {
            setLoading(true);
            const season = await getCurrentSeason();
            const week = await getCurrentWeek(season);
            if (isMounted) setCurrentWeek(week);

            // Check if week is over before any other API calls
            const weekOver = await isCurrentWeekOver(season, week);
            if (weekOver) {
                if (isMounted) {
                    setShouldPoll(false);
                    setLoading(false);
                }
                return;
            }

            // Fetch NFL games for the week first
            const year = new Date().getFullYear();
            const nflGamesMap = await fetchNFLGamesForWeek(week, year);
            setNflGames(nflGamesMap);

            // Check if any games are in progress or final
            let gamesActive = false;
            for (const abbr in nflGamesMap) {
                const game = nflGamesMap[abbr];
                const status = (game.status || "").toLowerCase();
                const statusDetail = (game.statusDetail || "").toLowerCase();
                if (
                    status.includes("final") ||
                    statusDetail.includes("final") ||
                    status.includes("in progress") ||
                    statusDetail.includes("in progress")
                ) {
                    gamesActive = true;
                    break;
                }
            }
            if (isMounted) setShouldPoll(gamesActive);

            // If no games are happening, don't fetch further or poll
            if (!gamesActive) {
                if (isMounted) setLoading(false);
                return;
            }

            // Get scoring map from settings
            const settingsRes = await fetch(
                `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
            );
            const settingsJson = await settingsRes.json();
            const scoringMap = buildScoringMap(settingsJson);

            const allStarters = await fetchAllStarters(season, week);

            // Gather all starter player keys
            const allPlayers = allStarters.flatMap((t) =>
                t.starters.map((p) => ({
                    ...p,
                    teamName: t.teamName,
                    managerName: t.managerName,
                    teamLogo: t.teamLogo,
                }))
            );
            const playerKeys = allPlayers.map((p) => p.playerKey);

            const pointsMapResult = await fetchPlayerPoints(season, week, playerKeys, scoringMap);

            // Filter to only players whose NFL game is in progress or over (final)
            const zeroPlayers = allPlayers.filter((p) => {
                const pts = pointsMapResult[p.playerKey];
                const game = getNflGameForPlayerTeam(nflGamesMap, p.team);

                if (!game) return false;
                const status = (game.status || "").toLowerCase();
                const statusDetail = (game.statusDetail || "").toLowerCase();
                const isFinal =
                    status.includes("final") ||
                    statusDetail.includes("final");
                const isInProgress =
                    status.includes("in progress") ||
                    statusDetail.includes("in progress");

                // Only show if game is in progress or final, and player is iced
                return (isFinal || isInProgress) && (pts <= 0 || pts === undefined);
            });

            if (isMounted) {
                setIcePlayers(zeroPlayers);
                setPointsMap(pointsMapResult);
                setLastUpdated(new Date());
                setLoading(false);
            }
        }

        loadIcePlayers();

        // Only poll if there are NFL games happening
        if (shouldPoll) {
            interval = setInterval(loadIcePlayers, 300000); // 5 minutes
        }

        return () => {
            isMounted = false;
            if (interval) clearInterval(interval);
        };
    }, [shouldPoll]);

    // Group icePlayers by display manager name
    const playersByManager: Record<string, typeof icePlayers> = {};
    icePlayers.forEach((p) => {
        const displayName = getDisplayManagerName(p.managerName);
        if (!playersByManager[displayName]) playersByManager[displayName] = [];
        playersByManager[displayName].push(p);
    });

    // Helper to get the game end date in YYYY-MM-DD format
    function getGameEndDate(game: any): string {
        if (!game) return "";
        // Prefer game.endTime if available, else fallback to game.date or statusDetail
        let dateStr = "";
        if (game.endTime) {
            // endTime is likely an ISO string or timestamp
            const d = new Date(game.endTime);
            dateStr = d.toISOString().slice(0, 10);
        } else if (game.date) {
            // Sometimes just a date string
            const d = new Date(game.date);
            dateStr = d.toISOString().slice(0, 10);
        } else if (game.statusDetail && /\d{1,2}\/\d{1,2}\/\d{4}/.test(game.statusDetail)) {
            // e.g. "Final - 10/14/2025"
            const match = game.statusDetail.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (match) {
                const [_, mm, dd, yyyy] = match;
                dateStr = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
            }
        }
        // Fallback to today if nothing found
        if (!dateStr) {
            const d = new Date();
            dateStr = d.toISOString().slice(0, 10);
        }
        return dateStr;
    }

    // Handler for Add Ice button
    function handleAddIce(p: any) {
        const game = nflGames && p.team ? getNflGameForPlayerTeam(nflGames, p.team) : null;
        const date = getGameEndDate(game);
        setAddIcePrefill({
            player: p.name,
            manager: p.managerName,
            week: currentWeek?.toString() || "",
            team: p.team,
            date,
        });
        setShowAddIceModal(true);
    }

    return (
        <div className="max-w-3xl mx-auto mt-4 bg-[#181818] rounded-xl shadow-lg px-2 sm:px-6">
            <h2 className="text-2xl font-bold text-emerald-300 mb-1 text-center">
                🧊 Ice Tracker
                {currentWeek && (
                    <span className="block text-base font-semibold text-emerald-200 mt-1">
                        Week {currentWeek}
                    </span>
                )}
            </h2>
            <p className="text-center text-gray-400 mb-2">
                Players in starting lineups with <span className="font-semibold text-emerald-200">0 points</span> this week.
            </p>
            {lastUpdated && (
                <div className="text-xs text-gray-500 text-center mb-10">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
            )}
            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : icePlayers.length === 0 ? (
                <div className="text-center text-emerald-400 font-semibold py-8">
                    No starters are currently on ice! 🥶
                </div>
            ) : (
                <div>
                    {Object.entries(playersByManager).map(([manager, players]) => (
                        <div key={manager} className="mb-8">
                            <h3 className="text-xl font-bold text-emerald-200 mb-4 border-b border-emerald-800 pb-1 text-center">
                                {manager}
                            </h3>
                            <ul className="divide-y divide-[#232323]">
                                {players.map((p, idx) => {
                                    const game = getNflGameForPlayerTeam(nflGames, p.team);

                                    let gameInfo = null;
                                    let isGameActiveOrFinal = false;
                                    if (game) {
                                        const status = (game.status || "").toLowerCase();
                                        const statusDetail = (game.statusDetail || "").toLowerCase();
                                        const isFinal =
                                            status.includes("final") ||
                                            statusDetail.includes("final");
                                        const isInProgress =
                                            status.includes("in progress") ||
                                            statusDetail.includes("in progress");
                                        isGameActiveOrFinal = isFinal || isInProgress;

                                        gameInfo = (
                                            <div className="text-xs text-right mt-1">
                                                <div className="text-gray-300 font-semibold">
                                                    {game.awayTeam?.abbreviation} @ {game.homeTeam?.abbreviation}
                                                </div>
                                                <div className="text-gray-400">
                                                    {game.statusDetail || game.status}
                                                </div>
                                                {isFinal ? (
                                                    <span className="text-red-400 font-semibold">Game Final – Iced ❄️</span>
                                                ) : isInProgress ? (
                                                    <span className="text-blue-300 font-semibold">
                                                        Live: {game.statusDetail}
                                                    </span>
                                                ) : null}
                                            </div>
                                        );
                                    } else {
                                        gameInfo = (
                                            <div className="text-xs text-gray-500 mt-1">
                                                No NFL game found for {p.team}
                                            </div>
                                        );
                                    }

                                    // Only iced if points <= 0 AND game is in progress or final
                                    const isIced =
                                        isGameActiveOrFinal &&
                                        (pointsMap[p.playerKey] !== undefined && pointsMap[p.playerKey] <= 0);

                                    return (
                                        <li
                                            key={p.playerKey + "-" + idx}
                                            className={`flex flex-row items-center gap-3 sm:gap-6 py-4 px-2 sm:px-4 ${
                                                isIced
                                                    ? "border-2 border-transparent bg-[#181818] shadow-[0_0_12px_4px_#22d3ee]"
                                                    : "border-transparent bg-[#181818]"
                                            } rounded-xl sm:rounded-lg transition-all mb-6`}
                                        >
                                            <div className="flex items-center justify-center flex-shrink-0">
                                                <img
                                                    src={getHighResPlayerImage(p)}
                                                    alt={p.name}
                                                    className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-base sm:text-lg font-semibold text-emerald-300 truncate">
                                                    {p.name}
                                                </div>
                                                <div className="text-xs sm:text-sm text-gray-400 truncate">
                                                    {p.position} - {p.team}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end min-w-[90px] sm:min-w-[120px] ml-2 sm:ml-6">
                                                <span className="text-base sm:text-lg font-bold text-emerald-400">
                                                    {typeof pointsMap[p.playerKey] === "number"
                                                        ? pointsMap[p.playerKey].toFixed(2)
                                                        : "0.00"}
                                                </span>
                                                {gameInfo}
                                                {/* Add Ice button for mikeyjordan43@gmail.com */}
                                                {isIced && user?.email === "mikeyjordan43@gmail.com" && (
                                                    <button
                                                        className="mt-2 px-3 py-1 rounded bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition"
                                                        onClick={() => handleAddIce(p)}
                                                        type="button"
                                                    >
                                                        Add Ice
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
            {/* Add Ice Modal */}
            {showAddIceModal && (
                <AddIces
                    open={showAddIceModal}
                    onClose={() => setShowAddIceModal(false)}
                    prefill={addIcePrefill}
                />
            )}
        </div>
    );
}