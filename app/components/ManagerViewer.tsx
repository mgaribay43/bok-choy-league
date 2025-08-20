'use client';

import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import leagueKeys from "../data/League_Keys/league_keys.json";
import Link from "next/link";
import icesData from "../data/Videos/ices.json";

type TeamEntry = {
    id: string;
    name: string;
    manager: string;
    rank: number;
    logo: string;
    season: string;
    draftGrade?: string;
    image_url?: string;
    felo_tier?: string;
    felo_score?: string; // Add felo_score field
};

const managerNames = [
    "Michael",
    "Hunter",
    "Brent",
    "jake.hughes275",
    "johnny5david",
    "Jacob",
    "Tanner",
    "Conner",
    "Jordan",
    "Zachary"
];

// Add this helper at the top (or reuse if present)
function getDisplayManagerName(name: string) {
    if (name === "Jacob") return "Harris";
    if (name === "jake.hughes275") return "Hughes";
    if (name === "johnny5david") return "Johnny";
    if (name === "Zachary") return "Zach";
    if (name === "Michael") return "Mike";
    if (name === "tanner") return "Tanner";
    return name;
}

// Helper to count ices for a manager using local JSON and display name
function getIcesCount(managerName: string): number {
    const displayName = getDisplayManagerName(managerName);
    let count = 0;
    Object.values(icesData).forEach((seasonArr: any) => {
        if (Array.isArray(seasonArr)) {
            seasonArr.forEach((ice: any) => {
                if (ice.manager === displayName && typeof ice.player === "string") {
                    // Count 1 for the first player, plus 1 for each "+"
                    count += 1 + (ice.player.split("+").length - 1);
                }
            });
        }
    });
    return count;
}

// Helper to get felo tier image URL
function getFeloTierImage(tier?: string) {
    if (!tier) return undefined;
    const t = tier.trim().toLowerCase();
    if (t === "bronze") return "https://s.yimg.com/cv/ae/fantasy/img/nfl/felo_nfl_bronze_mini@3x.png";
    if (t === "silver") return "https://s.yimg.com/cv/ae/fantasy/img/nfl/felo_nfl_silver_mini@3x.png";
    if (t === "gold") return "https://s.yimg.com/cv/ae/fantasy/img/nfl/felo_nfl_gold_mini@3x.png";
    if (t === "platinum") return "https://s.yimg.com/cv/ae/fantasy/img/nfl/felo_nfl_platinum_mini@3x.png";
    if (t === "diamond") return "https://s.yimg.com/cv/ae/fantasy/img/nfl/felo_nfl_diamond_mini@3x.png";
    return undefined;
}

// Helper to build Yahoo trophy image URL (handles 2017 differently)
function getTrophyUrl(place: number, season: string) {
    if (![1, 2, 3].includes(place)) return undefined;
    if (season === "2017") {
        return `https://s.yimg.com/cv/ae/default/170508/tr_nfl_${place}_2017.png`;
    }
    return `https://s.yimg.com/cv/apiv2/default/170508/tr_nfl_${place}_${season}.png`;
}

// Helper to get year badge image URL
function getYearBadgeUrl(year: string | null) {
    if (!year) return undefined;
    if (["2017", "2018", "2020"].includes(year)) return `/images/yearBadges/${year}.png`;
    return undefined;
}

export default function ManagerViewer() {
    const searchParams = useSearchParams();
    const managerName = searchParams.get("name");

    const [teams, setTeams] = useState<TeamEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(true);
    const collapseRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [icesCount, setIcesCount] = useState<number>(0);
    const [draftTimes, setDraftTimes] = useState<Record<string, number>>({});
    const [cachedManagerData, setCachedManagerData] = useState<Record<string, { tier?: string; score?: number }>>({});

    // Get current year as string
    const currentYear = String(new Date().getFullYear());

    // Always fetch all teams, regardless of managerName
    useEffect(() => {
        async function fetchAllTeams() {
            setLoading(true);
            const allTeams: TeamEntry[] = [];
            const seasons = Object.keys(leagueKeys);

            for (const season of seasons) {
                try {
                    const response = await fetch(
                        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=${season}`
                    );
                    if (!response.ok) continue;
                    const json = await response.json();
                    const rawTeams = json.fantasy_content.league[1].standings[0].teams;
                    const teamCount = parseInt(rawTeams.count, 10);

                    for (let i = 0; i < teamCount; i++) {
                        const teamData = rawTeams[i.toString()].team;
                        const metadata = teamData[0];
                        const standings = teamData[2]?.team_standings;

                        const id = metadata.find((item: any) => item.team_id)?.team_id ?? `${i + 1}`;
                        const name = metadata.find((item: any) => item.name)?.name ?? "Unknown Team";
                        const manager =
                            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.nickname ?? "Unknown";
                        const rank = parseInt(standings?.rank ?? "99", 10);
                        const logo =
                            metadata.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ??
                            "https://via.placeholder.com/100";
                        const draftGradeObj = metadata.find((item: any) => item.has_draft_grade !== undefined);
                        const draftGrade = draftGradeObj?.draft_grade ?? "N/A";
                        const image_url =
                            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.image_url ??
                            undefined;
                        const felo_tier =
                            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.felo_tier ?? undefined;
                        const felo_score =
                            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.felo_score ?? undefined;

                        allTeams.push({ id, name, manager, rank, logo, season, draftGrade, image_url, felo_tier, felo_score });
                    }
                } catch {
                    // Ignore errors for missing seasons
                }
            }
            allTeams.sort((a, b) => parseInt(b.season) - parseInt(a.season));
            setTeams(allTeams);
            setLoading(false);
        }

        fetchAllTeams();
    }, []);

    useEffect(() => {
        if (managerName) {
            setIcesCount(getIcesCount(managerName));
        }
    }, [managerName]);

    // Fetch draft times from the league settings API
    useEffect(() => {
        async function fetchDraftTimes() {
            const times: Record<string, number> = {};
            const seasons = Object.keys(leagueKeys);
            for (const season of seasons) {
                try {
                    const response = await fetch(
                        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${season}`
                    );
                    if (!response.ok) continue;
                    const json = await response.json();
                    // Yahoo API draft_time is in seconds, convert to ms
                    const draftTime =
                        json?.fantasy_content?.league?.[1]?.settings?.[0]?.draft_time;
                    if (draftTime) {
                        times[season] = Number(draftTime) * 1000;
                    }
                } catch {
                    // Ignore errors
                }
            }
            setDraftTimes(times);
        }
        fetchDraftTimes();
    }, []);

    // Load cached manager data on mount
    useEffect(() => {
        const cached = localStorage.getItem("managerRanks");
        if (cached) {
            setCachedManagerData(JSON.parse(cached));
        }
    }, []);

    // After teams are fetched, update cache if changed
    useEffect(() => {
        if (teams.length > 0) {
            const managerTiers: Record<string, string | undefined> = {};
            const managerScores: Record<string, number> = {};
            managerNames.forEach(name => {
                const teamsForManager = teams.filter(
                    team => team.manager?.toLowerCase() === name.toLowerCase()
                );
                if (teamsForManager.length > 0) {
                    const mostRecentTeam = teamsForManager.sort(
                        (a, b) => parseInt(b.season) - parseInt(a.season)
                    )[0];
                    managerTiers[name] = mostRecentTeam.felo_tier;
                    managerScores[name] = Number(mostRecentTeam.felo_score ?? 0);
                } else {
                    managerScores[name] = 0;
                }
            });

            // Compare with cached data
            const newCache: Record<string, { tier?: string; score?: number }> = {};
            managerNames.forEach(name => {
                newCache[name] = {
                    tier: managerTiers[name],
                    score: managerScores[name]
                };
            });

            localStorage.setItem("managerRanks", JSON.stringify(newCache));
            setCachedManagerData(newCache);
        }
    }, [teams.length]);

    // Animate collapsible header like Ices.tsx
    React.useEffect(() => {
        const collapseEl = collapseRef.current;
        const contentEl = contentRef.current;
        if (!collapseEl || !contentEl) return;

        const updateHeight = () => {
            if (!collapsed) {
                collapseEl.style.maxHeight = contentEl.scrollHeight + "px";
            }
        };

        if (!collapsed) {
            collapseEl.style.maxHeight = contentEl.scrollHeight + "px";
        } else {
            collapseEl.style.maxHeight = "0px";
        }

        let resizeObserver: ResizeObserver | null = null;
        if (!collapsed) {
            resizeObserver = new ResizeObserver(updateHeight);
            resizeObserver.observe(contentEl);
        }

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
        };
    }, [collapsed, teams.length]);

    // Helper to check if draft is completed for a season
    function isDraftCompleted(season: string) {
        const draftTime = draftTimes[season];
        if (!draftTime) return false;
        return Date.now() >= draftTime;
    }

    // If no managerName or managerName is not in managerNames, show default manager list
    if (!managerName || !managerNames.includes(managerName)) {
        // Use cached data if loading, otherwise use fetched data
        const managerTiers: Record<string, string | undefined> = {};
        const managerScores: Record<string, number> = {};

        managerNames.forEach(name => {
            if (loading && cachedManagerData[name]) {
                managerTiers[name] = cachedManagerData[name].tier;
                managerScores[name] = cachedManagerData[name].score ?? 0;
            } else {
                const teamsForManager = teams.filter(
                    team => team.manager?.toLowerCase() === name.toLowerCase()
                );
                if (teamsForManager.length > 0) {
                    const mostRecentTeam = teamsForManager.sort(
                        (a, b) => parseInt(b.season) - parseInt(a.season)
                    )[0];
                    managerTiers[name] = mostRecentTeam.felo_tier;
                    managerScores[name] = Number(mostRecentTeam.felo_score ?? 0);
                } else {
                    managerScores[name] = 0;
                }
            }
        });

        // Sort managers by felo_score descending
        const sortedManagers = [...managerNames].sort((a, b) => (managerScores[b] ?? 0) - (managerScores[a] ?? 0));

        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-xl w-full border border-emerald-100">
                    <h1 className="text-4xl font-extrabold text-emerald-700 mb-6 text-center tracking-tight drop-shadow">
                        League Managers
                    </h1>
                    <p className="text-center text-slate-600 mb-8 text-lg">
                        Select a manager below to view their trophy case, team history, and more!
                    </p>
                    <ul className="grid grid-cols-2 gap-6 items-center justify-center">
                        {sortedManagers.map(name => (
                            <li key={name} className="flex flex-col items-center">
                                <Link
                                    href={`/manager?name=${encodeURIComponent(name)}`}
                                    className="bg-emerald-100 hover:bg-emerald-200 transition rounded-lg px-6 py-4 text-lg font-bold text-emerald-700 hover:text-emerald-900 shadow flex flex-col items-center w-full"
                                >
                                    {managerTiers[name] ? (
                                        <img
                                            src={getFeloTierImage(managerTiers[name])}
                                            alt={managerTiers[name] + " tier"}
                                            className="w-16 h-16 mb-2"
                                            style={{ objectFit: "contain" }}
                                        />
                                    ) : (
                                        <span className="text-3xl mb-2">👤</span>
                                    )}
                                    {getDisplayManagerName(name)}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }

    // Filter teams for the selected manager (case-insensitive)
    const managerTeams = teams.filter(
        team => team.manager?.toLowerCase() === managerName?.toLowerCase()
    );

    // Calculate average finish, excluding current year
    const teamsForAverage = managerTeams.filter(team => team.season !== currentYear);
    const averageFinish =
        teamsForAverage.length > 0
            ? (
                teamsForAverage.reduce((sum, team) => sum + team.rank, 0) / teamsForAverage.length
            ).toFixed(2)
            : "N/A";

    // Calculate average draft grade, excluding current year
    const draftGradeMap: Record<string, number> = {
        "A+": 1, "A": 2, "A-": 3,
        "B+": 4, "B": 5, "B-": 6,
        "C+": 7, "C": 8, "C-": 9,
        "D+": 10, "D": 11, "D-": 12,
        "F": 13
    };
    const draftGrades = teamsForAverage
        .map(team => draftGradeMap[team.draftGrade ?? ""] ?? null)
        .filter(val => val !== null) as number[];
    const avgDraftGradeNum =
        draftGrades.length > 0
            ? (draftGrades.reduce((sum, val) => sum + val, 0) / draftGrades.length)
            : null;

    const avgDraftGrade =
        avgDraftGradeNum !== null
            ? Object.entries(draftGradeMap)
                .reduce((best, [grade, num]) =>
                    Math.abs(num - avgDraftGradeNum) < Math.abs(draftGradeMap[best] - avgDraftGradeNum)
                        ? grade
                        : best,
                    "A+"
                )
            : "N/A";

    const earliestYear =
        managerTeams.length > 0
            ? managerTeams.reduce((min, team) => (parseInt(team.season) < parseInt(min) ? team.season : min), managerTeams[0].season)
            : null;

    // Trophy counts
    const firstPlace = managerTeams.filter(team => team.rank === 1).length;
    const secondPlace = managerTeams.filter(team => team.rank === 2).length;
    const thirdPlace = managerTeams.filter(team => team.rank === 3).length;

    // Only one spinner for the whole page
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
                    <h1 className="text-3xl font-bold text-emerald-700 mb-4 text-center">
                        {getDisplayManagerName(managerName)}
                    </h1>
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Get manager felo_tier and felo_score from the most recent team for this manager
    const managerFeloTier =
        managerTeams.length > 0
            ? managerTeams[0].felo_tier
            : undefined;

    const managerFeloTierImg = getFeloTierImage(managerFeloTier);

    const managerFeloScore =
        managerTeams.length > 0
            ? managerTeams[0].felo_score
            : undefined;

    // Check if manager has any trophies
    const hasTrophies = managerTeams.some(team => [1, 2, 3].includes(team.rank));

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-4 relative">
                {/* Member Since Badge - top left */}
                {earliestYear && getYearBadgeUrl(earliestYear) && (
                    <img
                        src={getYearBadgeUrl(earliestYear)}
                        alt={`Member since ${earliestYear}`}
                        className="absolute top-4 left-4 w-20 h-20 z-10"
                        style={{ objectFit: "contain" }}
                    />
                )}
                <div className="flex flex-col items-center mb-4">
                    {managerFeloTierImg && (
                        <>
                            <img
                                src={managerFeloTierImg}
                                alt={managerFeloTier + " tier"}
                                className="w-16 h-16"
                                style={{ objectFit: "contain" }}
                            />
                            {managerFeloScore && (
                                <span className="text-xs text-slate-500 mb-2">
                                    Rating: {managerFeloScore}
                                </span>
                            )}
                        </>
                    )}
                    <h1 className="text-3xl font-bold text-emerald-700 text-center">
                        {getDisplayManagerName(managerName)}
                    </h1>
                </div>
                {/* Trophy Case Section */}
                {hasTrophies && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-amber-700 text-center mb-2">Trophy Case</h2>
                        <div className="flex flex-col items-center gap-8 overflow-x-auto w-full">
                            {[1, 2, 3].map(place => {
                                const trophies = managerTeams.filter(team => team.rank === place);
                                if (trophies.length === 0) return null;
                                return (
                                    <div key={place} className="flex flex-col items-center w-full">
                                        <div className="flex flex-row flex-wrap justify-center gap-x-2 gap-y-2 w-full max-w-full">
                                            {trophies.map(team => (
                                                <img
                                                    key={team.season}
                                                    src={getTrophyUrl(place, team.season)}
                                                    alt={`${place} Place Trophy ${team.season}`}
                                                    className="w-24 h-24 max-w-[96px] object-contain"
                                                    style={{ flex: "0 0 auto" }}
                                                />
                                            ))}
                                        </div>
                                        <span className={`text-lg font-bold mt-2 ${place === 1 ? "text-yellow-700" : place === 2 ? "text-slate-500" : "text-amber-700"}`}>
                                        </span>
                                        <span className="text-xs text-slate-500 mt-1">
                                            {place === 1 ? "1st Place" : place === 2 ? "2nd Place" : "3rd Place"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {/* Average Finish & Draft Grade Cards */}
                <div className="flex flex-col sm:flex-row justify-center gap-6 mb-6">
                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg shadow px-6 py-4 flex flex-col items-center w-full sm:w-48 min-w-[12rem]">
                        <div className="text-lg font-semibold text-emerald-700 mb-1">Avg. Finish</div>
                        <div className="text-3xl font-bold text-emerald-900">{averageFinish}</div>
                    </div>
                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg shadow px-6 py-4 flex flex-col items-center w-full sm:w-48 min-w-[12rem]">
                        <div className="text-lg font-semibold text-emerald-700 mb-1">Avg. Draft Grade</div>
                        <div className="text-3xl font-bold text-emerald-900">{avgDraftGrade}</div>
                    </div>
                    <div className="bg-blue-100 border border-blue-300 rounded-lg shadow px-6 py-4 flex flex-col items-center w-full sm:w-48 min-w-[12rem]">
                        <div className="text-lg font-semibold text-blue-700 mb-1">Ices</div>
                        <div className="text-3xl font-bold text-blue-900">{icesCount}</div>
                    </div>
                </div>
                {managerTeams.length === 0 ? (
                    <p className="text-center text-slate-500">No teams found for this manager.</p>
                ) : (
                    <div className="mt-4"> {/* Removed pb-12 */}
                        {/* Show 2025 team (current year) above collapsible if present */}
                        {managerTeams.some(team => team.season === "2025") && (
                            <div className="mb-4">
                                {managerTeams
                                    .filter(team => team.season === "2025")
                                    .map(team => {
                                        const drafted = isDraftCompleted(team.season);
                                        return drafted ? (
                                            <Link
                                                key={team.season + team.id}
                                                href={`/roster?year=${team.season}&teamId=${team.id}`}
                                                className="bg-emerald-50 rounded-lg shadow p-4 flex flex-col items-center hover:bg-emerald-100 transition cursor-pointer"
                                            >
                                                <img src={team.logo} alt={team.name} className="w-16 h-16 rounded-full mb-2" />
                                                <div className="text-lg font-bold text-emerald-700 text-center">{team.name}</div>
                                                <div className="text-xs text-slate-500 text-center mb-1">Season: {team.season}</div>
                                                <div className="text-xs text-slate-700 text-center">Final Rank: {team.rank}</div>
                                                <div className="text-xs text-emerald-700 text-center mt-1">
                                                    Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div
                                                key={team.season + team.id}
                                                className="bg-emerald-50 rounded-lg shadow p-4 flex flex-col items-center opacity-60 cursor-not-allowed"
                                                title="Team will be viewable after the draft."
                                            >
                                                <img src={team.logo} alt={team.name} className="w-16 h-16 rounded-full mb-2" />
                                                <div className="text-lg font-bold text-emerald-700 text-center">{team.name}</div>
                                                <div className="text-xs text-slate-500 text-center mb-1">Season: {team.season}</div>
                                                <div className="text-xs text-slate-700 text-center">Final Rank: {team.rank}</div>
                                                <div className="text-xs text-emerald-700 text-center mt-1">
                                                    Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                                                </div>
                                                <div className="text-xs text-red-500 mt-2">Draft not completed</div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-emerald-200 rounded-lg shadow font-semibold text-emerald-800 mb-6 focus:outline-none"
                            onClick={() => setCollapsed(!collapsed)}
                            aria-expanded={!collapsed}
                        >
                            <span>Previous Teams</span>
                            <span className={`transform transition-transform ${collapsed ? "rotate-0" : "rotate-180"}`}>
                                ▼
                            </span>
                        </button>
                        <div
                            ref={collapseRef}
                            className={`overflow-hidden transition-all duration-500 ease-in-out w-full ${!collapsed ? "opacity-100" : "opacity-0"}`}
                            style={{
                                transitionProperty: "max-height, opacity",
                                marginBottom: "16px", // Reduced from 48px
                                minHeight: "1px",
                                maxHeight: collapsed ? "0px" : undefined,
                                paddingBottom: !collapsed ? "16px" : "0px" // Reduced from 24px
                            }}
                        >
                            <div ref={contentRef} className="flex flex-col gap-6 mt-2">
                                {managerTeams
                                    .filter(team => team.season !== "2025")
                                    .map(team => {
                                        const drafted = isDraftCompleted(team.season);
                                        return drafted ? (
                                            <Link
                                                key={team.season + team.id}
                                                href={`/roster?year=${team.season}&teamId=${team.id}`}
                                                className="bg-emerald-50 rounded-lg shadow p-4 flex flex-col items-center hover:bg-emerald-100 transition cursor-pointer"
                                            >
                                                <img src={team.logo} alt={team.name} className="w-16 h-16 rounded-full mb-2" />
                                                <div className="text-lg font-bold text-emerald-700 text-center">{team.name}</div>
                                                <div className="text-xs text-slate-500 text-center mb-1">Season: {team.season}</div>
                                                <div className="text-xs text-slate-700 text-center">Final Rank: {team.rank}</div>
                                                <div className="text-xs text-emerald-700 text-center mt-1">
                                                    Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div
                                                key={team.season + team.id}
                                                className="bg-emerald-50 rounded-lg shadow p-4 flex flex-col items-center opacity-60 cursor-not-allowed"
                                                title="Team will be viewable after the draft."
                                            >
                                                <img src={team.logo} alt={team.name} className="w-16 h-16 rounded-full mb-2" />
                                                <div className="text-lg font-bold text-emerald-700 text-center">{team.name}</div>
                                                <div className="text-xs text-slate-500 text-center mb-1">Season: {team.season}</div>
                                                <div className="text-xs text-slate-700 text-center">Final Rank: {team.rank}</div>
                                                <div className="text-xs text-emerald-700 text-center mt-1">
                                                    Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                                                </div>
                                                <div className="text-xs text-red-500 mt-2">Draft not completed</div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}