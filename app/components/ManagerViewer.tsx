'use client';

import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import leagueKeys from "../data/League_Keys/league_keys.json";
import Link from "next/link";
import Image from "next/image";
import ReactModal from "react-modal";
import { Line } from "react-chartjs-2";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
} from "chart.js";
import { getDisplayManagerName } from "./globalUtils/getManagerNames";
import { getCurrentSeason } from "./globalUtils/getCurrentSeason";

// --- Firestore imports ---
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // <-- update path if needed

if (typeof window !== "undefined") {
  ReactModal.setAppElement(document.body);
}

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
  felo_score?: string;
};

type IceEntry = {
  date?: string;
  flavor?: string;
  id?: string;
  manager?: string;
  player?: string; // "A+B" or "A"
  week?: string;
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

// ===== Scroll lock hook (iOS-safe) =====
function useBodyScrollLock(isLocked: boolean) {
  React.useEffect(() => {
    if (!isLocked) return;

    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      htmlOverscroll: document.documentElement.style.overscrollBehavior,
      htmlTouch: document.documentElement.style.touchAction,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.documentElement.style.touchAction = "none";

    return () => {
      const topVal = document.body.style.top;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      document.documentElement.style.overscrollBehavior = prev.htmlOverscroll;
      document.documentElement.style.touchAction = prev.htmlTouch;

      const y = Math.abs(parseInt(topVal || "0", 10)) || scrollY;
      window.scrollTo(0, y);
    };
  }, [isLocked]);
}

// ===== Helpers =====
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

function getTrophyUrl(place: number, season: string) {
  if (![1, 2, 3].includes(place)) return undefined;
  if (season === "2017") {
    return `https://s.yimg.com/cv/ae/default/170508/tr_nfl_${place}_2017.png`;
  }
  return `https://s.yimg.com/cv/apiv2/default/170508/tr_nfl_${place}_${season}.png`;
}

function getYearBadgeUrl(year: string | null) {
  if (!year) return undefined;
  if (["2017", "2018", "2020"].includes(year)) return `/images/yearBadges/${year}.png`;
  return undefined;
}

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
);

// --- Firestore-backed Ices counter for your exact shape ---
// /Ices (collection) -> docs "2023", "2024", "2025", ... each with { entries: IceEntry[] }
async function getIcesCountFromFirestore(managerName: string): Promise<number> {
  const displayName = getDisplayManagerName(managerName);
  const snap = await getDocs(collection(db, "Ices"));

  let count = 0;
  snap.forEach((doc) => {
    const data = doc.data() as { entries?: IceEntry[] };
    const entries = Array.isArray(data.entries) ? data.entries : [];
    for (const ice of entries) {
      if ((ice.manager || "").trim() === displayName) {
        const playerStr = (ice.player || "").trim();
        count += playerStr ? 1 + (playerStr.split("+").length - 1) : 1;
      }
    }
  });

  return count;
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
  const [showFeloModal, setShowFeloModal] = useState(false);
  const [currentSeason, setCurrentSeason] = useState<string>(String(new Date().getFullYear()));

  // Lock background scroll when modal is open
  useBodyScrollLock(showFeloModal);

  useEffect(() => {
    (async () => {
      try {
        const season = await getCurrentSeason();
        if (season) setCurrentSeason(String(season));
      } catch {
        // keep fallback Year
      }
    })();
  }, []);

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
              metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.image_url ?? undefined;
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

  // Firestore Ices count
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!managerName) return;
      try {
        const n = await getIcesCountFromFirestore(managerName);
        if (alive) setIcesCount(n);
      } catch {
        if (alive) setIcesCount(0);
      }
    })();
    return () => { alive = false; };
  }, [managerName]);

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

  useEffect(() => {
    const cached = localStorage.getItem("managerRanks");
    if (cached) {
      setCachedManagerData(JSON.parse(cached));
    }
  }, []);

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

  function isDraftCompleted(season: string) {
    const draftTime = draftTimes[season];
    if (!draftTime) return false;
    return Date.now() >= draftTime;
  }

  if (!managerName || !managerNames.includes(managerName)) {
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

    const sortedManagers = [...managerNames].sort((a, b) => (managerScores[b] ?? 0) - (managerScores[a] ?? 0));

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f]">
        <div className="bg-[#232323] rounded-2xl shadow-2xl p-10 max-w-xl w-full border border-[#333]">
          <h1 className="text-4xl font-extrabold text-emerald-200 mb-6 text-center tracking-tight drop-shadow">
            League Managers
          </h1>
          <p className="text-center text-emerald-400 mb-8 text-lg">
            Select a manager below to view their trophy case, team history, and more!
          </p>
          <ul className="grid grid-cols-2 gap-6 items-center justify-center">
            {sortedManagers.map(name => (
              <li key={name} className="flex flex-col items-center">
                <Link
                  href={`/manager?name=${encodeURIComponent(name)}`}
                  className="bg-[#0f0f0f] hover:bg-emerald-900 transition rounded-lg px-6 py-4 text-lg font-bold text-emerald-200 hover:text-emerald-100 shadow flex flex-col items-center w-full border border-[#333]"
                >
                  {managerTiers[name] ? (
                    <Image
                      src={getFeloTierImage(managerTiers[name]) ?? "/images/defaultFeloTier.png"}
                      alt={(managerTiers[name] ?? "Unknown") + " tier"}
                      width={64}
                      height={64}
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

  const managerTeams = teams.filter(
    team => team.manager?.toLowerCase() === managerName?.toLowerCase()
  );

  const teamsForAverage = managerTeams.filter(team => team.season !== currentSeason);
  const averageFinish =
    teamsForAverage.length > 0
      ? (
        teamsForAverage.reduce((sum, team) => sum + team.rank, 0) / teamsForAverage.length
      ).toFixed(2)
      : "N/A";

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

  const firstPlace = managerTeams.filter(team => team.rank === 1).length;
  const secondPlace = managerTeams.filter(team => team.rank === 2).length;
  const thirdPlace = managerTeams.filter(team => team.rank === 3).length;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f]">
        <div className="bg-[#232323] rounded-xl shadow-lg p-8 max-w-2xl w-full border border-[#333]">
          <h1 className="text-3xl font-bold text-emerald-200 mb-4 text-center">
            {getDisplayManagerName(managerName!)}
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

  const managerFeloTier =
    managerTeams.length > 0
      ? managerTeams[0].felo_tier
      : undefined;

  const managerFeloTierImg = getFeloTierImage(managerFeloTier);

  const managerFeloScore =
    managerTeams.length > 0
      ? managerTeams[0].felo_score
      : undefined;

  const hasTrophies = managerTeams.some(
    team => team.season !== currentSeason && [1, 2, 3].includes(team.rank)
  );

  const feloHistory = managerTeams
    .filter(team => team.felo_score)
    .sort((a, b) => parseInt(a.season) - parseInt(b.season))
    .map(team => ({
      year: team.season,
      score: Number(team.felo_score)
    }));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f]">
      <div className="bg-[#232323] rounded-xl shadow-lg max-w-2xl w-full p-4 relative border border-[#333]">
        {/* Member Since Badge - top left */}
        {earliestYear && getYearBadgeUrl(earliestYear) && (
          <Image
            src={getYearBadgeUrl(earliestYear) ?? "/images/defaultYearBadge.png"}
            alt={`Member since ${earliestYear}`}
            width={144}
            height={144}
            className="absolute top-4 left-4 w-24 h-24 sm:w-36 sm:h-36 z-10"
            style={{ objectFit: "contain" }}
          />
        )}
        <div className="flex flex-col items-center mb-4">
          {managerFeloTierImg && (
            <>
              <button
                onClick={() => setShowFeloModal(true)}
                className="focus:outline-none"
                title="View rating history"
                style={{ background: "none", border: "none", padding: 0, margin: 0 }}
              >
                <img
                  src={managerFeloTierImg}
                  alt={managerFeloTier + " tier"}
                  className="w-16 h-16 cursor-pointer"
                  style={{ objectFit: "contain" }}
                />
              </button>
              {managerFeloScore && (
                <span className="text-xs text-emerald-400 mb-2">
                  Rating: {managerFeloScore}
                </span>
              )}
            </>
          )}
          <h1 className="text-3xl font-bold text-emerald-200 text-center">
            {getDisplayManagerName(managerName!)}
          </h1>
        </div>

        {/* Trophy Case Section */}
        {hasTrophies && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-yellow-600 text-center mb-2">Trophy Case</h2>
            <div className="flex flex-col items-center gap-8 overflow-x-auto w-full">
              {[1, 2, 3].map(place => {
                // Exclude current season from trophies until it's over
                const trophies = managerTeams.filter(
                  team => team.season !== currentSeason && team.rank === place
                );
                if (trophies.length === 0) return null;
                return (
                  <div key={place} className="flex flex-col items-center w-full">
                    <div className="flex flex-row flex-wrap justify-center gap-x-2 gap-y-2 w-full max-w-full">
                      {trophies.map(team => (
                        <Image
                          key={team.season}
                          src={getTrophyUrl(place, team.season) ?? "/images/defaultTrophy.png"}
                          alt={`${place} Place Trophy ${team.season}`}
                          width={96}
                          height={96}
                          className="w-24 h-24 max-w-[96px] object-contain"
                          style={{ flex: "0 0 auto" }}
                        />
                      ))}
                    </div>
                    <span className={`text-lg font-bold mt-2 ${place === 1 ? "text-yellow-600" : place === 2 ? "text-emerald-400" : "text-amber-700"}`}>
                    </span>
                    <span className="text-xs text-emerald-400 mt-1">
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
          <div className="bg-[#0f0f0f] border border-[#333] rounded-lg shadow px-6 py-4 flex flex-col items-center w-full sm:w-48 min-w-[12rem]">
            <div className="text-lg font-semibold text-emerald-200 mb-1">Avg. Finish</div>
            <div className="text-3xl font-bold text-emerald-100">{averageFinish}</div>
          </div>
          <div className="bg-[#0f0f0f] border border-[#333] rounded-lg shadow px-6 py-4 flex flex-col items-center w-full sm:w-48 min-w-[12rem]">
            <div className="text-lg font-semibold text-emerald-200 mb-1">Avg. Draft Grade</div>
            <div className="text-3xl font-bold text-emerald-100">{avgDraftGrade}</div>
          </div>
          <div className="bg-[#232323] border border-blue-900 rounded-lg shadow px-6 py-4 flex flex-col items-center w-full sm:w-48 min-w-[12rem]">
            <div className="text-lg font-semibold text-blue-300 mb-1">Ices</div>
            <div className="text-3xl font-bold text-blue-100">{icesCount}</div>
          </div>
        </div>

        {managerTeams.length === 0 ? (
          <p className="text-center text-emerald-400">No teams found for this manager.</p>
        ) : (
          <div className="mt-4">
            {/* Show current season team(s) dynamically instead of hardcoded "2025" */}
            {managerTeams.some(team => team.season === currentSeason) && (
              <div className="mb-4">
                {managerTeams
                  .filter(team => team.season === currentSeason)
                  .map(team => {
                    const drafted = isDraftCompleted(team.season);
                    const isCurrentSeason = team.season === currentSeason;
                    return drafted ? (
                      <Link
                        key={team.season + team.id}
                        href={`/roster?year=${team.season}&teamId=${team.id}`}
                        className="bg-[#0f0f0f] rounded-lg shadow p-4 flex flex-col items-center hover:bg-emerald-900 transition cursor-pointer border border-[#333]"
                      >
                        <Image src={team.logo} alt={team.name} width={64} height={64} className="w-16 h-16 rounded-full mb-2" />
                        <div className="text-lg font-bold text-emerald-200 text-center">{team.name}</div>
                        <div className="text-xs text-emerald-400 text-center mb-1">Season: {team.season}</div>
                        <div className="text-xs text-emerald-400 text-center">
                          {isCurrentSeason ? "Current Rank" : "Final Rank"}: {isNaN(team.rank) ? "-" : team.rank}
                        </div>
                        <div className="text-xs text-emerald-200 text-center mt-1">
                          Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                        </div>
                      </Link>
                    ) : (
                      <div
                        key={team.season + team.id}
                        className="bg-[#0f0f0f] rounded-lg shadow p-4 flex flex-col items-center opacity-60 cursor-not-allowed border border-[#333]"
                        title="Team will be viewable after the draft."
                      >
                        <Image src={team.logo} alt={team.name} width={64} height={64} className="w-16 h-16 rounded-full mb-2" />
                        <div className="text-lg font-bold text-emerald-200 text-center">{team.name}</div>
                        <div className="text-xs text-emerald-400 text-center mb-1">Season: {team.season}</div>
                        <div className="text-xs text-emerald-400 text-center">
                          {isCurrentSeason ? "Current Rank" : "Final Rank"}: {isNaN(team.rank) ? "-" : team.rank}
                        </div>
                        <div className="text-xs text-emerald-200 text-center mt-1">
                          Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                        </div>
                        <div className="text-xs text-red-400 mt-2">Draft not completed</div>
                      </div>
                    );
                  })}
              </div>
            )}

            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-[#232323] border border-[#333] rounded-lg shadow font-semibold text-emerald-200 mb-6 focus:outline-none"
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
              className={`transition-all duration-500 ease-in-out w-full ${!collapsed ? "overflow-visible opacity-100" : "overflow-hidden opacity-0"}`}
              style={{
                transitionProperty: "max-height, opacity",
                marginBottom: !collapsed ? "32px" : "0px",
                minHeight: "1px",
                maxHeight: collapsed ? "0px" : contentRef.current ? contentRef.current.scrollHeight + 128 + "px" : undefined,
                paddingBottom: !collapsed ? "64px" : "0px"
              }}
            >
              <div ref={contentRef} className="flex flex-col gap-6 mt-2">
                {managerTeams
                  .filter(team => team.season !== currentSeason)
                  .map(team => {
                    const drafted = isDraftCompleted(team.season);
                    const isCurrentSeason = team.season === currentSeason;
                    return drafted ? (
                      <Link
                        key={team.season + team.id}
                        href={`/roster?year=${team.season}&teamId=${team.id}`}
                        className="bg-[#0f0f0f] rounded-lg shadow p-4 flex flex-col items-center hover:bg-emerald-900 transition cursor-pointer border border-[#333]"
                      >
                        <Image src={team.logo} alt={team.name} width={64} height={64} className="w-16 h-16 rounded-full mb-2" />
                        <div className="text-lg font-bold text-emerald-200 text-center">{team.name}</div>
                        <div className="text-xs text-emerald-400 text-center mb-1">Season: {team.season}</div>
                        <div className="text-xs text-emerald-400 text-center">
                          {isCurrentSeason ? "Current Rank" : "Final Rank"}: {isNaN(team.rank) ? "-" : team.rank}
                        </div>
                        <div className="text-xs text-emerald-200 text-center mt-1">
                          Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                        </div>
                      </Link>
                    ) : (
                      <div
                        key={team.season + team.id}
                        className="bg-[#0f0f0f] rounded-lg shadow p-4 flex flex-col items-center opacity-60 cursor-not-allowed border border-[#333]"
                        title="Team will be viewable after the draft."
                      >
                        <Image src={team.logo} alt={team.name} width={64} height={64} className="w-16 h-16 rounded-full mb-2" />
                        <div className="text-lg font-bold text-emerald-200 text-center">{team.name}</div>
                        <div className="text-xs text-emerald-400 text-center mb-1">Season: {team.season}</div>
                        <div className="text-xs text-emerald-400 text-center">
                          {isCurrentSeason ? "Current Rank" : "Final Rank"}: {isNaN(team.rank) ? "-" : team.rank}
                        </div>
                        <div className="text-xs text-emerald-200 text-center mt-1">
                          Draft Grade: <span className="font-semibold">{team.draftGrade}</span>
                        </div>
                        <div className="text-xs text-red-400 mt-2">Draft not completed</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal ===== */}
      <ReactModal
        isOpen={showFeloModal}
        onRequestClose={() => setShowFeloModal(false)}
        className="bg-[#232323] rounded-2xl shadow-2xl p-8 max-w-lg mx-auto mt-24 outline-none border border-[#333]"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 overflow-hidden"
        ariaHideApp={false}
        shouldCloseOnOverlayClick={true}
      >
        <h2 className="text-2xl font-bold text-emerald-200 mb-4 text-center">Felo Rating History</h2>
        <div
          style={{
            width: "100%",
            minHeight: "350px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          className="felo-chart-container"
        >
          <Line
            data={{
              labels: managerTeams
                .filter(t => t.felo_score)
                .sort((a, b) => parseInt(a.season) - parseInt(b.season))
                .map(t => t.season),
              datasets: [
                {
                  label: "",
                  data: managerTeams
                    .filter(t => t.felo_score)
                    .sort((a, b) => parseInt(a.season) - parseInt(b.season))
                    .map(t => Number(t.felo_score)),
                  borderColor: managerFeloTier === "diamond"
                    ? "#f3e743"
                    : managerFeloTier === "platinum"
                      ? "#aee6f9"
                      : managerFeloTier === "gold"
                        ? "#ffd700"
                        : managerFeloTier === "silver"
                          ? "#e5e7eb"
                          : managerFeloTier === "bronze"
                            ? "#c68642"
                            : "#34d399",
                  backgroundColor: "rgba(200,200,200,0.2)",
                  pointBackgroundColor: managerFeloTier === "diamond"
                    ? "#f3e743"
                    : managerFeloTier === "platinum"
                      ? "#aee6f9"
                      : managerFeloTier === "gold"
                        ? "#ffd700"
                        : managerFeloTier === "silver"
                          ? "#e5e7eb"
                          : managerFeloTier === "bronze"
                            ? "#c68642"
                            : "#34d399",
                  pointBorderColor: "#232323",
                  pointRadius: 8,
                  pointHoverRadius: 12,
                  tension: 0,
                  fill: true,
                }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                title: { display: false },
                tooltip: {
                  enabled: true,
                  mode: 'nearest',
                  intersect: false,
                  callbacks: {
                    label: function (context: any) {
                      return `Year: ${context.label}, Rating: ${context.parsed.y}`;
                    }
                  }
                }
              },
              interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
              },
              layout: {
                padding: { top: 0, bottom: 0, left: 0, right: 0 }
              },
              scales: {
                x: {
                  ticks: { color: "#cccccc", font: { size: 14 } },
                  grid: { color: "#444" }
                },
                y: {
                  min: Math.min(...managerTeams.filter(t => t.felo_score).map(t => Number(t.felo_score))) - 20,
                  max: Math.max(...managerTeams.filter(t => t.felo_score).map(t => Number(t.felo_score))) + 20,
                  ticks: {
                    color: "#cccccc",
                    font: { size: 14 },
                    stepSize: 25,
                    callback: function (value: any) {
                      let label = value;
                      if (value === 500) label = "Bronze";
                      if (value === 600) label = "Silver";
                      if (value === 700) label = "Gold";
                      if (value === 800) label = "Platinum";
                      if (value === 900) label = "Diamond";
                      return label;
                    },
                    autoSkip: false,
                    maxTicksLimit: 0
                  },
                  grid: { color: "#444" }
                }
              }
            }}
            height={350}
            width={400}
          />
        </div>
        <button
          onClick={() => setShowFeloModal(false)}
          className="mt-6 px-6 py-2 rounded-xl bg-emerald-700 text-emerald-100 font-bold hover:bg-emerald-800 transition w-full"
        >
          Close
        </button>
      </ReactModal>
    </div>
  );
}
