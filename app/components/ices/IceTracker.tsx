'use client';

import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { getDisplayManagerName } from "../globalUtils/getManagerNames";
import { getHighResPlayerImage } from "../globalUtils/getHighResPlayerImage";
import { getCurrentSeason } from "../globalUtils/getCurrentSeason";
import { getCurrentWeek } from "../globalUtils/getCurrentWeek";
import { useAuth } from "../../../context/AuthContext";
import AddIces from "../addIces";
import { FiRefreshCw } from "react-icons/fi";

// Improved lookup that mirrors server logic and handles DEF/team-name cases
function getNflGameForPlayerTeam(
    nflGames: Record<string, any> | null | undefined,
    yahooAbbr?: string | null,
    fallbackTeamName?: string | null
) {
    if (!nflGames) return null;

    const raw = (yahooAbbr || "").toString().trim();
    const cleanAbb = raw.replace(/\s+DEF$/i, "").replace(/\./g, "").toUpperCase();
    const cleanedLower = cleanAbb.toLowerCase();

    const tryKeys = new Set<string>();
    if (cleanAbb) tryKeys.add(cleanAbb);
    if (cleanedLower) tryKeys.add(cleanedLower);
    if (yahooAbbr) tryKeys.add(String(yahooAbbr));
    if (yahooAbbr) tryKeys.add(String(yahooAbbr).toLowerCase());

    const norm = (s: any) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

    if (fallbackTeamName) {
        const fb = norm(fallbackTeamName);
        if (fb) tryKeys.add(fb);
        (fallbackTeamName.match(/\w+/g) || []).slice(0, 3).forEach((tok: string) => tryKeys.add(norm(tok)));
    }

    // Try common mapping used server-side
    const YAHOO_TO_NFL_ABBR: Record<string, string> = { WAS: "WSH", JAC: "JAX" };
    if (cleanAbb) {
        const mapped = YAHOO_TO_NFL_ABBR[cleanAbb] || cleanAbb;
        tryKeys.add(mapped);
        tryKeys.add(mapped.toLowerCase());
    }

    // attempt direct lookups
    for (const k of Array.from(tryKeys)) {
        if (!k) continue;
        if ((nflGames as any)[k]) return (nflGames as any)[k];
    }

    // last-resort partial matching against home/away names/abbs
    const needle = norm(cleanAbb || fallbackTeamName || "");
    if (needle) {
        for (const key of Object.keys(nflGames)) {
            const g = (nflGames as any)[key];
            const homeAbb = norm(g?.homeTeam?.abbreviation || "");
            const awayAbb = norm(g?.awayTeam?.abbreviation || "");
            const homeName = norm(g?.homeTeam?.fullName || g?.homeTeam?.name || "");
            const awayName = norm(g?.awayTeam?.fullName || g?.awayTeam?.name || "");

            if (homeAbb === needle || awayAbb === needle) return g;
            if (homeName.includes(needle) || awayName.includes(needle)) return g;
            if (needle.includes(homeAbb) || needle.includes(awayAbb)) return g;
        }
    }

    return null;
}

export default function IceTracker() {
    const [loading, setLoading] = useState(true);
    const [icePlayers, setIcePlayers] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    const [pointsMap, setPointsMap] = useState<Record<string, number>>({});
    const [nflGames, setNflGames] = useState<Record<string, any>>({});
    const [showAddIceModal, setShowAddIceModal] = useState(false);
    const [addIcePrefill, setAddIcePrefill] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { user } = useAuth() || {};

    useEffect(() => {
        const db = getFirestore();
        const docRef = doc(db, "iceTracker", "current");

        const unsubscribe = onSnapshot(
            docRef,
            (snap) => {
                if (!snap.exists()) {
                    setIcePlayers([]);
                    setPointsMap({});
                    setNflGames({});
                    setCurrentWeek(null);
                    setLastUpdated(null);
                    setLoading(false);
                    return;
                }

                const data = snap.data() as Record<string, any>;

                setIcePlayers(Array.isArray(data.players) ? data.players : []);
                setPointsMap(data.pointsMap || {});
                setNflGames(data.nflGames || {});
                setCurrentWeek(typeof data.currentWeek === "number" ? data.currentWeek : null);

                const lu = data.lastUpdated;
                if (!lu) {
                    setLastUpdated(null);
                } else if (typeof (lu as any).toDate === "function") {
                    setLastUpdated((lu as any).toDate());
                } else {
                    setLastUpdated(new Date(lu));
                }

                setLoading(false);
            },
            (err) => {
                console.error("IceTracker snapshot error:", err);
                setLoading(false); //testing
            }
        );

        return () => unsubscribe();
    }, []);

    // Manual refresh: call cloud function with season/week from global utils
    async function handleManualRefresh() {
        setIsRefreshing(true);
        try {
            const season = await getCurrentSeason();
            const week = await getCurrentWeek(season);
            const url = `https://us-central1-bokchoyleague.cloudfunctions.net/iceTracker?season=${encodeURIComponent(
                season
            )}&week=${encodeURIComponent(String(week))}`;
            const res = await fetch(url, { method: "GET" });
            if (!res.ok) {
                console.error("IceTracker manual refresh failed", res.status);
            } else {
                try {
                    const json = await res.json();
                    console.log("IceTracker manual refresh response", json);
                } catch {
                    console.log("IceTracker manual refresh completed (no json body)");
                }
            }
        } catch (err) {
            console.error("IceTracker manual refresh error", err);
        } finally {
            setIsRefreshing(false);
        }
    }

    // Group by display manager
    const playersByManager: Record<string, typeof icePlayers> = {};
    icePlayers.forEach((p) => {
        const displayName = getDisplayManagerName(p.managerName);
        if (!playersByManager[displayName]) playersByManager[displayName] = [];
        playersByManager[displayName].push(p);
    });

    function getGameEndDateFromGame(game: any): string {
        if (!game) return "";
        if (game.endTime) {
            try {
                return new Date(game.endTime).toISOString().slice(0, 10);
            } catch { }
        }
        if (game.date) {
            try {
                return new Date(game.date).toISOString().slice(0, 10);
            } catch { }
        }
        if (game.statusDetail && /\d{1,2}\/\d{1,2}\/\d{4}/.test(game.statusDetail)) {
            const match = game.statusDetail.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (match) {
                const [, mm, dd, yyyy] = match;
                return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
            }
        }
        return new Date().toISOString().slice(0, 10);
    }

    function handleAddIce(p: any) {
        // use robust lookup with teamName fallback (handles DEF entries)
        const game = getNflGameForPlayerTeam(nflGames, p.team, p.teamName);
        const date = getGameEndDateFromGame(game);
        setAddIcePrefill({
            player: p.name,
            manager: getDisplayManagerName(p.managerName),
            week: currentWeek?.toString() || "",
            team: p.team,
            date,
            flavor: "Standard", // always prefill flavor to "standard"
        });
        setShowAddIceModal(true);
    }

    return (
        <div className="max-w-4xl mx-auto mt-4 bg-[#181818] rounded-xl shadow-lg px-2 sm:px-6">
            {/* grid ensures the header stays centered regardless of button width */}
            <div className="relative">
                <div className="grid grid-cols-3 items-center">
                    <div /> {/* left placeholder to balance grid */}

                    <h2 className="text-2xl font-bold text-emerald-300 mb-1 text-center">
                        🧊 Ice Tracker
                        {currentWeek && (
                            <span className="block text-base font-semibold text-emerald-200 mt-1">
                                Week {currentWeek}
                            </span>
                        )}
                    </h2>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            aria-label="Refresh now"
                            title="Refresh now"
                            className="inline-flex items-center justify-center w-10 h-10 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 transition"
                        >
                            <FiRefreshCw className={`${isRefreshing ? "animate-spin" : ""} h-5 w-5`} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            {lastUpdated && (
                <div className="text-xs text-gray-500 text-center mb-4">
                    Last updated: {lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : icePlayers.length === 0 ? (
                <div className="text-center text-emerald-400 font-semibold py-8">Nobody on Ice Watch</div>
            ) : (
                // make the players list vertically scrollable, prevent horizontal clipping
                <div className="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto overflow-x-hidden px-2 box-border">
                    {Object.entries(playersByManager).map(([manager, players]) => (
                        <div key={manager} className="mb-8">
                            <h3 className="text-xl font-bold text-emerald-200 mb-4 border-b border-emerald-800 pb-1 text-center">
                                {manager}
                            </h3>
                            <ul className="divide-y divide-[#232323]">
                                {players.map((p, idx) => {
                                    const game = getNflGameForPlayerTeam(nflGames, p.team, p.teamName);

                                    let gameInfo = null;
                                    let isGameActiveOrFinal = false;
                                    // track whether the game's final (only finals should get the blue "iced" background)
                                    let isGameFinal = false;
                                    if (game) {
                                        const status = (game.status || "").toLowerCase();
                                        const statusDetail = (game.statusDetail || "").toLowerCase();
                                        const isFinal = status.includes("final") || statusDetail.includes("final");
                                        const isInProgress = status.includes("in progress") || statusDetail.includes("in progress");
                                        isGameActiveOrFinal = isFinal || isInProgress;
                                        isGameFinal = isFinal;

                                        // Show teams on top line, then only show a single status line (Final or Live)
                                        gameInfo = (
                                            <div className="text-xs text-right mt-1">
                                                <div className="text-gray-300 font-semibold">
                                                    {game.awayTeam?.abbreviation} @ {game.homeTeam?.abbreviation}
                                                </div>
                                                <div className="text-gray-400">{game.statusDetail || game.status}</div>
                                                {isFinal ? (
                                                    <div className="text-red-400 font-semibold">Game Final – Iced ❄️</div>
                                                ) : isInProgress ? (
                                                    <span className="text-blue-300 font-semibold">Live: {game.statusDetail}</span>
                                                ) : null}
                                            </div>
                                        );
                                    } else {
                                        gameInfo = (
                                            <div className="text-xs text-gray-500 mt-1">No NFL game found for {p.team || p.teamName}</div>
                                        );
                                    }

                                    const pts = typeof pointsMap?.[p.playerKey] === "number" ? pointsMap[p.playerKey] : undefined;
                                    // Mark iced when the game is in-progress or final and player has 0 or fewer points
                                    const isIced = isGameActiveOrFinal && pts !== undefined && pts <= 0;

                                    return (
                                        <li
                                            key={p.playerKey + "-" + idx}
                                            className={`flex flex-row items-center gap-3 sm:gap-6 py-4 px-2 sm:px-4 ${isIced
                                                ? "border-2 border-transparent bg-[#181818] shadow-[0_0_12px_4px_#22d3ee]"
                                                : "border-transparent bg-[#181818]"
                                                } rounded-xl sm:rounded-lg transition-all mb-6`}
                                        >
                                            <div className="flex items-center justify-center flex-shrink-0">
                                                <img src={getHighResPlayerImage(p)} alt={p.name} className="h-16 w-16 sm:h-24 sm:w-24 object-contain" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-base sm:text-lg font-semibold text-emerald-300 truncate">{p.name}</div>
                                                <div className="text-xs sm:text-sm text-gray-400 truncate">
                                                    {p.position} - {p.team}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end min-w-[90px] sm:min-w-[120px] ml-2 sm:ml-6">
                                                <span className="text-base sm:text-lg font-bold text-emerald-400">
                                                    {typeof pts === "number" ? pts.toFixed(2) : "0.00"}
                                                </span>
                                                {gameInfo}
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

            {showAddIceModal && (
                <AddIces open={showAddIceModal} onClose={() => setShowAddIceModal(false)} prefill={addIcePrefill} />
            )}
        </div>
    );
}