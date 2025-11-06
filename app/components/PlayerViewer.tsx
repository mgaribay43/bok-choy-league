import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import Image from "next/image";
import yahooDefImagesJson from "../data/yahooDefImages.json";
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";

// Helper to build statId -> statName map from league settings
async function fetchLeagueSettings(year: string) {
    try {
        const response = await fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${year}`
        );
        if (!response.ok) throw new Error("Failed to fetch league settings");
        return await response.json();
    } catch {
        return null;
    }
}

function buildStatIdMap(settingsJson: any) {
    const statCategories = settingsJson?.fantasy_content?.league?.[1]?.settings?.[0]?.stat_categories?.stats || [];
    const statIdMap: Record<string, string> = {};
    statCategories.forEach((cat: any) => {
        const id = cat?.stat?.stat_id;
        const name = cat?.stat?.name;
        if (id && name) statIdMap[id] = name;
    });
    return statIdMap;
}

function abbreviateStatName(name: string) {
    return name
        .replace(/Passing/gi, "Pass")
        .replace(/Rushing/gi, "Rush")
        .replace(/Yards/gi, "Yds")
        .replace(/Touchdowns/gi, "TD")
        .replace(/Touchdown/gi, "TD")
        .replace(/Interceptions/gi, "Int")
        .replace(/Interception/gi, "Int")
        .replace(/Attempts/gi, "Att")
        .replace(/Receptions/gi, "Rec")
        .replace(/Receiving/gi, "Rec")
        .replace(/Offensive/gi, "")
        .replace(/Fumble/gi, "Fum")
        .replace(/Fumbles/gi, "Fum")
        .replace(/Point Conversions/gi, "PT")
        .replace(/Return/gi, "Ret")
        .replace(/Point After Attempt Made/gi, "PAT")
        .replace(/Field Goals/gi, "FG")
        .replace(/Points Allowed/gi, "Pts Allow")
        .replace(/Extra Point Reted/gi, "XPR")
        .replace(/Block/gi, "Blk")
        .replace(/Safety/gi, "Safe")
        .replace(/Kickoff and/gi, "Kick +")
        .replace(/points/gi, "")
        .replace(/Recovery/gi, "Rec");
}

function getTotalStats(weekStats: any[], statColumns: { id: string; label: string }[]) {
    const totals: Record<string, number | string> = {};
    statColumns.forEach(col => {
        let sum = 0;
        let hasValue = false;
        weekStats.forEach(week => {
            const val = week[col.id];
            // treat "-" or zero as no-value for display/total purposes
            if (val !== undefined && val !== null && val !== "-" && !isNaN(Number(val))) {
                const num = Number(val);
                if (num !== 0) {
                    sum += num;
                    hasValue = true;
                }
            }
        });
        // If the computed total is zero, show "-" (per rule: stats with value 0 display as dash).
        totals[col.id] = hasValue && Number(sum) !== 0 ? sum.toFixed(2) : "-";
    });
    return totals;
}

const yahooDefImages: Record<string, { hash: string; img: string; folder?: string; pxFolder?: string }> = yahooDefImagesJson;

export default function PlayerViewer({
    player,
    onClose,
    stats,
}: {
    player: any;
    onClose: () => void;
    stats: any[];
}) {
    // Set gamelog as the default tab
    const [tab, setTab] = useState<"gamelog" | "stats">("gamelog");
    const [statIdMap, setStatIdMap] = useState<Record<string, string>>({});
    const cardRef = useRef<HTMLDivElement>(null);
    const scrollableRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const tabBarRef = useRef<HTMLDivElement>(null); // NEW
    const touchStartY = useRef<number | null>(null);
    const [translateY, setTranslateY] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [swipeAllowed, setSwipeAllowed] = useState(true);

    // Collapsible logic for expanded row (per-row refs + measured heights to avoid midway jump)
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const contentRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const [rowHeights, setRowHeights] = useState<Record<number, number>>({});

    // Measure expanded row content height synchronously so CSS transition has an exact target
    // (moved below so it can safely depend on computed weekStats)

    // Fetch league settings from API instead of local JSON
    useEffect(() => {
        async function fetchSettings() {
            const year = player?.season ?? new Date().getFullYear().toString();
            const settings = await fetchLeagueSettings(year);
            setStatIdMap(buildStatIdMap(settings));
        }
        fetchSettings();
    }, [player?.season]);

    // Build stat columns from league settings
    const statColumns = Object.entries(statIdMap).map(([id, name]) => ({
        id,
        label: abbreviateStatName(name),
    }));

    // Helper: Get stat modifiers from league settings
    function getStatModifiers(settingsJson: any) {
        const modifiers = settingsJson?.fantasy_content?.league?.[1]?.settings?.[0]?.stat_modifiers?.stats || [];
        const modMap: Record<string, number> = {};
        modifiers.forEach((mod: any) => {
            const id = mod?.stat?.stat_id;
            const value = parseFloat(mod?.stat?.value ?? "0");
            if (id) modMap[id] = value;
        });
        return modMap;
    }

    const [statModifiers, setStatModifiers] = useState<Record<string, number>>({});
    useEffect(() => {
        async function fetchModifiers() {
            const year = player?.season ?? new Date().getFullYear().toString();
            const settings = await fetchLeagueSettings(year);
            setStatModifiers(getStatModifiers(settings));
        }
        fetchModifiers();
    }, [player?.season]);

    // Current week for the player's season (used to mark future weeks)
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    useEffect(() => {
        let mounted = true;
        async function fetchCW() {
            try {
                const year = player?.season ?? new Date().getFullYear().toString();
                const cw = await getCurrentWeek(year);
                if (mounted) setCurrentWeek(Number(cw) || null);
            } catch {
                if (mounted) setCurrentWeek(null);
            }
        }
        fetchCW();
        return () => { mounted = false; };
    }, [player?.season]);

    // Transform stats prop to a map of stat_id -> value for each week and calculate fantasy points.
    // Weeks that are the current week or in the future will display "-" for stat columns and fan points.
    // Per requirement: individual stat zeros show "-" but per-week Fan Pts should be numeric for completed weeks (including 0.00).
    const weekStats = stats?.map((week: any) => {
        const statMap: Record<string, any> = {};
        let fantasyPoints: number = 0;
        const hasStatsArray = Array.isArray(week.stats) && week.stats.length > 0;
        // Treat current week and future weeks as not-yet-played
        const isFutureOrCurrent = currentWeek !== null && Number(week.week) >= currentWeek;

        // Derive bye flag: either provided in week (week.bye === 1) OR matches player.byeWeek
        const playerBye = player?.byeWeek ?? player?.stats?.byeWeek;
        const byeFlag = (Number(week.bye) === 1) || (playerBye != null && String(playerBye) !== "" && Number(playerBye) === Number(week.week));

        if (hasStatsArray && !isFutureOrCurrent && !byeFlag) {
            week.stats.forEach((s: any) => {
                if (s?.stat?.stat_id) {
                    const id = s.stat.stat_id;
                    const raw = s.stat.value ?? "0";
                    const numVal = parseFloat(raw);
                    // Always accumulate numeric value for fantasy point calcs (treat NaN as 0)
                    const addVal = isNaN(numVal) ? 0 : numVal;
                    const modifier = statModifiers[id] ?? 0;
                    fantasyPoints += modifier * addVal;

                    // For display: individual stat zeros become "-", non-zero keep original raw value
                    statMap[id] = !isNaN(numVal) && numVal === 0 ? "-" : raw;
                }
            });
        }

        // Determine display value for per-week fantasy points:
        // - Bye weeks, current, or future weeks -> "-"
        // - Completed weeks -> numeric string (including "0.00")
        let fantasyPointsDisplay: number | string;
        if (byeFlag || isFutureOrCurrent) {
            // mark all stat fields as "-" for bye, current, or future weeks
            Object.keys(statMap).forEach(key => {
                statMap[key] = "-";
            });
            fantasyPointsDisplay = "-";
        } else {
            // Completed week: always numeric (including 0.00)
            fantasyPointsDisplay = (Number.isNaN(Number(fantasyPoints)) ? 0 : fantasyPoints).toFixed(2);
        }

        return {
            week: week.week,
            bye: byeFlag ? 1 : 0,
            fantasyPoints: fantasyPointsDisplay,
            ...statMap,
        };
    }) || [];

    // Prevent background scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    // Swipe-to-close logic with scroll check
    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;

        function handleTouchStart(e: TouchEvent) {
            if (isAnimating) return;
            const touchY = e.touches[0].clientY;
            const header = headerRef.current;
            const tabBar = tabBarRef.current;
            const scrollable = scrollableRef.current;

            // If touch starts in header or tab bar section, always allow swipe
            let inHeader = false;
            if (header) {
                const rect = header.getBoundingClientRect();
                if (touchY >= rect.top && touchY <= rect.bottom) {
                    inHeader = true;
                }
            }
            let inTabBar = false;
            if (tabBar) {
                const rect = tabBar.getBoundingClientRect();
                if (touchY >= rect.top && touchY <= rect.bottom) {
                    inTabBar = true;
                }
            }
            if (inHeader || inTabBar) {
                setSwipeAllowed(true);
                touchStartY.current = touchY;
                return;
            }

            // Otherwise, only allow swipe if scrollable is at top
            if (scrollable && scrollable.scrollTop > 0) {
                setSwipeAllowed(false);
                touchStartY.current = null;
                return;
            }
            setSwipeAllowed(true);
            touchStartY.current = touchY;
        }

        function handleTouchMove(e: TouchEvent) {
            if (touchStartY.current === null || isAnimating || !swipeAllowed) return;
            const deltaY = e.touches[0].clientY - touchStartY.current;
            if (deltaY > 0) setTranslateY(deltaY);
        }

        function handleTouchEnd() {
            if (isAnimating || !swipeAllowed) {
                setSwipeAllowed(false);
                return;
            }
            if (translateY > 80) {
                setIsAnimating(true);
                setTranslateY(1000); // Animate off screen
                setTimeout(() => {
                    onClose();
                }, 250);
            } else {
                setTranslateY(0);
                setSwipeAllowed(true); // Reset swipe state to allow new gestures
            }
            touchStartY.current = null;
        }

        card.addEventListener("touchstart", handleTouchStart);
        card.addEventListener("touchmove", handleTouchMove);
        card.addEventListener("touchend", handleTouchEnd);

        return () => {
            card.removeEventListener("touchstart", handleTouchStart);
            card.removeEventListener("touchmove", handleTouchMove);
            card.removeEventListener("touchend", handleTouchEnd);
        };
    }, [translateY, isAnimating, onClose]);

    // Reset scroll and animation when switching tabs
    useEffect(() => {
        setTranslateY(0);
        setIsAnimating(false);
        if (scrollableRef.current) {
            scrollableRef.current.scrollLeft = 0;
        }
    }, [tab]);

    // Helper for summary stats
    function getSummaryStats(row: any, statColumns: { id: string; label: string }[]) {
        return statColumns
            .filter(col => {
                const val = row[col.id];
                return val !== undefined && val !== null && val !== "-" && Number(val) !== 0;
            })
            .map(col => ({
                label: col.label,
                value: row[col.id],
            }));
    }

    // Determine if game log data is ready
    const gameLogLoading = !stats || !Array.isArray(stats) || stats.length === 0;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            style={{ pointerEvents: "none" }}
        >
            <div
                ref={cardRef}
                className="bg-[#181A20] rounded-2xl shadow-2xl p-0 w-[400px] h-[600px] flex flex-col relative overflow-hidden"
                style={{
                    pointerEvents: "auto",
                    transform: `translateY(${translateY}px)`,
                    transition: isAnimating
                        ? "transform 1s cubic-bezier(.4,2,.6,1)"
                        : translateY === 0
                            ? "transform 0.15s"
                            : "none",
                    touchAction: "pan-y",
                }}
            >
                <button
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-400 text-2xl font-bold z-10"
                    onClick={onClose}
                >
                    &times;
                </button>
                <div ref={headerRef} className="px-6 pt-6 pb-2">
                    <div className="flex items-bottom justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{player.name}</h2>
                            <div className="text-slate-300 text-sm">
                                {player.position} - {player.team}
                            </div>
                            <div className="text-slate-400 text-xs mt-1">
                                Bye Week: {player.byeWeek ?? player.stats?.byeWeek ?? "-"}
                            </div>
                        </div>
                        {(
                            (() => {
                                const fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png";
                                let imgUrl = fallbackUrl;
                                if (player.position === "DEF") {
                                    let rawAbbr = player.team?.toUpperCase() || "FA";
                                    if (rawAbbr === "WAS") rawAbbr = "WSH";
                                    const defInfo = yahooDefImages[rawAbbr];
                                    if (defInfo) {
                                        if (defInfo.pxFolder) {
                                            imgUrl = `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/${defInfo.folder}/${defInfo.pxFolder}/${defInfo.img}`;
                                        } else {
                                            const folder = defInfo.folder || "20190724";
                                            imgUrl = `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/nfl/${folder}/500x500/${defInfo.img}`;
                                        }
                                    }
                                } else if (
                                    player.headshotUrl &&
                                    !player.headshotUrl.includes("dh/ap/default/140828/silhouette@2x.png")
                                ) {
                                    const match = player.headshotUrl.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
                                    if (match) imgUrl = match[1];
                                    else imgUrl = player.headshotUrl.replace(/(\.png).*$/, '$1');
                                }
                                return (
                                    <Image
                                        src={imgUrl}
                                        alt={player.name}
                                        width={150}
                                        height={150}
                                        style={player.position === "DEF" ? { background: "#181a20" } : undefined}
                                    />
                                );
                            })()
                        )}
                    </div>
                    <div className="flex justify-between items-center mt-4 mb-2">
                        <div className="flex flex-col items-center">
                            <span className="text-white text-lg font-bold">{player.stats?.fanPts ? player.stats.fanPts.toFixed(2) : "0.00"}</span>
                            <span className="text-slate-400 text-xs">Fan Points</span>
                        </div>
                        <div className="flex flex-col items-center"></div>
                        <div className="flex flex-col items-center"></div>
                    </div>
                </div>
                <div ref={tabBarRef} className="border-b border-slate-700">
                    <div>
                        <div className="flex gap-8 justify-center">
                            <button
                                className={`py-3 font-bold text-white ${tab === "gamelog" ? "border-b-2 border-blue-400" : "text-slate-400"}`}
                                onClick={() => setTab("gamelog")}
                            >
                                Game Log
                            </button>
                            <button
                                className={`py-3 font-bold text-white ${tab === "stats" ? "border-b-2 border-blue-400" : "text-slate-400"}`}
                                onClick={() => setTab("stats")}
                            >
                                Stats
                            </button>
                        </div>
                    </div>
                </div>
                <div
                    ref={scrollableRef}
                    className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#181A20] pt-0 mt-0 flex flex-col"
                >
                    {tab === "gamelog" && (
                        gameLogLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin"></div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full px-0 py-0 m-0">
                                <table className="w-full text-xs text-left text-slate-200">
                                    <thead className="sticky top-0 bg-[#181A20] z-10">
                                        <tr className="border-b border-slate-700">
                                            <th className="py-2 whitespace-nowrap px-4">Wk</th>
                                            <th className="py-2 whitespace-nowrap px-4 text-center">Fan Pts</th>
                                            {statColumns
                                                .filter(field =>
                                                    weekStats.some((g: any) =>
                                                        g[field.id] !== "-" &&
                                                        g[field.id] !== undefined &&
                                                        g[field.id] !== "" &&
                                                        g[field.id] !== null
                                                    )
                                                )
                                                .map(field => (
                                                    <th key={field.id} className="whitespace-nowrap px-4 text-center">{field.label}</th>
                                                ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekStats.map((g: any, idx: number) => (
                                            <React.Fragment key={idx}>
                                                <tr
                                                    className="border-b border-slate-800 cursor-pointer"
                                                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                                >
                                                    <td className="py-2 whitespace-nowrap text-center">{g.week}</td>
                                                    <td className="py-2 whitespace-nowrap text-center font-bold">
                                                        {(() => {
                                                            const fp = g.fantasyPoints;
                                                            // Future/current/bye weeks use "-" as set above
                                                            if (fp === "-" || fp === undefined || fp === null) return "-";
                                                            const n = Number(fp);
                                                            return isNaN(n) ? "0.00" : n.toFixed(2);
                                                        })()}
                                                    </td>
                                                    {statColumns
                                                        .filter(field =>
                                                            weekStats.some((row: any) =>
                                                                row[field.id] !== "-" &&
                                                                row[field.id] !== undefined &&
                                                                row[field.id] !== "" &&
                                                                row[field.id] !== null
                                                            )
                                                        )
                                                        .map(field => (
                                                            <td
                                                                key={field.id}
                                                                className="whitespace-nowrap px-4 text-center"
                                                            >
                                                                {g.bye === 1
                                                                    ? "-"
                                                                    : (g[field.id] !== undefined && g[field.id] !== null ? g[field.id] : "-")}
                                                            </td>
                                                        ))}
                                                </tr>
                                                {/* Animated collapsible expanded row */}
                                                <tr className="border-0">
                                                    <td colSpan={2 + statColumns.length} className="p-0 border-0">
                                                        {/* Collapsible content: when collapsed this wrapper has maxHeight 0 and no padding so rows sit flush */}
                                                        <div
                                                            className="overflow-hidden w-full"
                                                            style={{
                                                                transition: "max-height 300ms ease, opacity 200ms ease",
                                                                maxHeight: expandedRow === idx ? `${rowHeights[idx] ?? (contentRefs.current[idx]?.scrollHeight ?? 0)}px` : "0px",
                                                                opacity: expandedRow === idx ? 1 : 0,
                                                            }}
                                                            aria-hidden={expandedRow !== idx}
                                                        >
                                                            <div
                                                                ref={(el) => { contentRefs.current[idx] = el; }}
                                                                className="px-4 py-2 bg-slate-800 flex flex-wrap gap-4"
                                                            >
                                                                {getSummaryStats(g, statColumns).length === 0 ? (
                                                                    <span className="text-slate-400">-</span>
                                                                ) : (
                                                                    getSummaryStats(g, statColumns).map((stat, i) => (
                                                                        <div key={i} className="flex gap-2 items-center">
                                                                            <span className="font-semibold text-blue-300">{stat.label}:</span>
                                                                            <span className="text-white">{stat.value}</span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                    {tab === "stats" && (
                        gameLogLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin"></div>
                                </div>
                            </div>
                        ) :
                            <div className="overflow-x-auto w-full px-0">
                                <table className="w-full text-xs text-left text-slate-200">
                                    <thead className="sticky top-0 bg-[#181A20] z-10">
                                        <tr className="border-b border-slate-700">
                                            <th className="py-2 whitespace-nowrap px-4">Total</th>
                                            <th className="py-2 whitespace-nowrap px-8 text-center">Pts</th>
                                            {statColumns
                                                .filter(field =>
                                                    weekStats.some((g: any) =>
                                                        g[field.id] !== "-" &&
                                                        g[field.id] !== undefined &&
                                                        g[field.id] !== "" &&
                                                        g[field.id] !== null
                                                    )
                                                )
                                                .map(field => (
                                                    <th key={field.id} className="whitespace-nowrap px-4 text-center">{field.label}</th>
                                                ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-800">
                                            <td className="py-2 whitespace-nowrap text-center font-bold">Season</td>
                                            <td className="py-2 whitespace-nowrap text-center font-bold">
                                                {
                                                    // Total fantasy points (display "-" if total is zero)
                                                    (() => {
                                                        const sum = weekStats.reduce((sumAcc, g) => {
                                                            if (!g || g.fantasyPoints === "-" || g.fantasyPoints === undefined || g.fantasyPoints === null) return sumAcc;
                                                            const n = Number(g.fantasyPoints);
                                                            return sumAcc + (isNaN(n) ? 0 : n);
                                                        }, 0);
                                                        // Exception: total fantasy points should always display a numeric value (including 0.00)
                                                        return sum.toFixed(2);
                                                    })()
                                                }
                                            </td>
                                            {(() => {
                                                const totals = getTotalStats(weekStats, statColumns);
                                                return statColumns
                                                    .filter(field =>
                                                        weekStats.some((g: any) =>
                                                            g[field.id] !== "-" &&
                                                            g[field.id] !== undefined &&
                                                            g[field.id] !== "" &&
                                                            g[field.id] !== null
                                                        )
                                                    )
                                                    .map(field => (
                                                        <td key={field.id} className="whitespace-nowrap px-4 text-center font-bold">
                                                            {totals[field.id]}
                                                        </td>
                                                    ));
                                            })()}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                    )}
                </div>
            </div>
        </div>
    );
}