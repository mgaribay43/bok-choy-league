import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import leagueSettings from "../data/league_settings.json"; // Adjust path as needed

// Helper to build statId -> statName map from league settings
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

// Helper to abbreviate stat names for table headers
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
        .replace(/Recovery/gi, "Rec");
}

// Helper to total stats across all weeks
function getTotalStats(weekStats: any[], statColumns: { id: string; label: string }[]) {
    const totals: Record<string, number | string> = {};
    statColumns.forEach(col => {
        let sum = 0;
        let hasValue = false;
        weekStats.forEach(week => {
            const val = week[col.id];
            if (val !== undefined && val !== null && val !== "-" && !isNaN(Number(val))) {
                sum += Number(val);
                hasValue = true;
            }
        });
        totals[col.id] = hasValue ? sum.toFixed(2) : "-";
    });
    return totals;
}

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
    const touchStartY = useRef<number | null>(null);
    const [translateY, setTranslateY] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    // New state for expanded row
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // Use local league settings JSON instead of API
    useEffect(() => {
        setStatIdMap(buildStatIdMap(leagueSettings));
    }, []);

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
    const statModifiers = getStatModifiers(leagueSettings);

    // Transform stats prop to a map of stat_id -> value for each week and calculate fantasy points
    const weekStats = stats?.map((week: any) => {
        const statMap: Record<string, any> = {};
        let fantasyPoints: number = 0;
        if (Array.isArray(week.stats)) {
            week.stats.forEach((s: any) => {
                if (s?.stat?.stat_id) {
                    statMap[s.stat.stat_id] = s.stat.value;
                    // Calculate fantasy points for this stat
                    const modifier = statModifiers[s.stat.stat_id] ?? 0;
                    const value = parseFloat(s.stat.value ?? "0");
                    fantasyPoints += modifier * value;
                }
            });
        }
        // If it's a bye week, set all stat values to "-" and fantasy points to "-"
        let fantasyPointsDisplay: number | string;
        if (week.bye === 1) {
            Object.keys(statMap).forEach(key => {
                statMap[key] = "-";
            });
            fantasyPointsDisplay = "-";
        } else {
            fantasyPointsDisplay = fantasyPoints.toFixed(2);
            return {
                week: week.week,
                bye: week.bye,
                fantasyPoints: fantasyPointsDisplay,
                ...statMap,
            };
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
            // Only allow swipe if scrollable section is at the top
            const scrollable = scrollableRef.current;
            if (scrollable && scrollable.scrollTop > 0) {
                touchStartY.current = null;
                return;
            }
            touchStartY.current = e.touches[0].clientY;
        }

        function handleTouchMove(e: TouchEvent) {
            if (touchStartY.current === null || isAnimating) return;
            const deltaY = e.touches[0].clientY - touchStartY.current;
            if (deltaY > 0) setTranslateY(deltaY);
        }

        function handleTouchEnd() {
            if (isAnimating) return;
            if (translateY > 80) {
                setIsAnimating(true);
                setTranslateY(1000); // Animate off screen
                setTimeout(() => {
                    onClose();
                }, 250);
            } else {
                setTranslateY(0);
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div
                ref={cardRef}
                className="bg-[#181A20] rounded-2xl shadow-2xl p-0 w-[400px] h-[600px] flex flex-col relative overflow-hidden"
                style={{
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
                <div className="px-6 pt-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{player.name}</h2>
                            <div className="text-slate-300 text-sm">
                                {player.position} - {player.team}
                            </div>
                            <div className="text-slate-400 text-xs mt-1">
                                Bye Week: {player.stats?.byeWeek ?? "-"}
                            </div>
                        </div>
                        {player.headshotUrl && (
                            <Image
                                src={player.headshotUrl}
                                alt={player.name}
                                width={64}
                                height={64}
                                className="rounded-full"
                            />
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
                <div className="border-b border-slate-700 px-6">
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
                <div
                    ref={scrollableRef}
                    className="flex-1 py-4 overflow-y-auto"
                >
                    {tab === "gamelog" && (
                        gameLogLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin"></div>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto w-full px-0">
                                <table className="w-full text-xs text-left text-slate-200">
                                    <thead>
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
                                                    <td className="py-2 whitespace-nowrap text-center font-bold">{g.fantasyPoints}</td>
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
                                                {expandedRow === idx && (
                                                    <tr>
                                                        <td colSpan={2 + statColumns.length} className="bg-slate-800 px-4 py-2 animate-slide-down">
                                                            <div className="flex flex-wrap gap-4">
                                                                {getSummaryStats(g, statColumns).length === 0 ? (
                                                                    <span className="text-slate-400">No stats to show.</span>
                                                                ) : (
                                                                    getSummaryStats(g, statColumns).map((stat, i) => (
                                                                        <div key={i} className="flex gap-2 items-center">
                                                                            <span className="font-semibold text-blue-300">{stat.label}:</span>
                                                                            <span className="text-white">{stat.value}</span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                    {tab === "stats" && (
                        gameLogLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin"></div>
                                </div>
                            </div>
                        ) :
                            <div className="overflow-x-auto w-full px-0">
                                <table className="w-full text-xs text-left text-slate-200">
                                    <thead>
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
                                                    // Total fantasy points
                                                    weekStats.reduce((sum, g) =>
                                                        g && typeof g.fantasyPoints === "string" && g.fantasyPoints !== "-"
                                                            ? sum + Number(g.fantasyPoints)
                                                            : sum
                                                        , 0).toFixed(2)
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