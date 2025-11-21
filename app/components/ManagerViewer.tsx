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
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // <-- update path if needed
// NEW: needed for active no-ice streak
import { getCurrentWeek } from "./globalUtils/getCurrentWeek";

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
  draftRecapUrl?: string; // <-- added
};

type IceEntry = {
  date?: string;
  flavor?: string;
  id?: string;
  manager?: string;
  player?: string; // "A+B" or "A"
  week?: string;
  season?: string; // some entries may include it; otherwise inferred from doc id
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
  const [recordsHeld, setRecordsHeld] = useState<string[]>([]); // NEW

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
            const draftRecapUrl = draftGradeObj?.draft_recap_url ?? undefined; // <-- added
            const image_url =
              metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.image_url ?? undefined;
            const felo_tier =
              metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.felo_tier ?? undefined;
            const felo_score =
              metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.felo_score ?? undefined;

            allTeams.push({ id, name, manager, rank, logo, season, draftGrade, image_url, felo_tier, felo_score, draftRecapUrl });
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

  // NEW: Compute league records and note which ones this manager owns (ties count as owning)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!managerName) return;
      const displayName = getDisplayManagerName(managerName);

      try {
        // get current week for active streak calculation
        let curWeek = 17;
        try {
          curWeek = await getCurrentWeek(currentSeason);
        } catch {
          curWeek = 17;
        }

        const snap = await getDocs(collection(db, "Ices"));
        type Cnt = Record<string, number>;

        const totalByMgr: Cnt = {};
        const seasonMgrCnt: Record<string, Cnt> = {};
        const weekMgrCnt: Record<string, Cnt> = {}; // key: `${season}|${week}` -> { manager: count }
        const mgrFlavorSets: Record<string, Set<string>> = {};
        const mgrSeasonWeeks: Record<string, Record<string, Set<number>>> = {}; // manager -> season -> weeks set

        snap.forEach(doc => {
          const season = doc.id;
          const data = doc.data() as { entries?: IceEntry[] };
          const entries = Array.isArray(data.entries) ? data.entries : [];
          for (const ice of entries) {
            const mgr = (ice.manager || "").trim();
            if (!mgr) continue;

            const playerStr = (ice.player || "").trim();
            const playersInEntry = playerStr ? Math.max(1, playerStr.split("+").length) : 1;

            // Totals
            totalByMgr[mgr] = (totalByMgr[mgr] || 0) + playersInEntry;

            // Per-season
            seasonMgrCnt[season] ||= {};
            seasonMgrCnt[season][mgr] = (seasonMgrCnt[season][mgr] || 0) + playersInEntry;

            // Per-week
            const weekStr = (ice.week ?? "").toString().trim();
            if (weekStr) {
              const key = `${season}|${weekStr}`;
              weekMgrCnt[key] ||= {};
              weekMgrCnt[key][mgr] = (weekMgrCnt[key][mgr] || 0) + playersInEntry;

              // FIX: parse "Week X" correctly
              const wNum = parseInt(weekStr.replace(/[^\d]/g, ""), 10);
              if (!isNaN(wNum)) {
                mgrSeasonWeeks[mgr] ||= {};
                mgrSeasonWeeks[mgr][season] ||= new Set<number>();
                mgrSeasonWeeks[mgr][season]!.add(wNum);
              }
            }

            // Flavors
            const flavor = (ice.flavor || "").trim();
            if (flavor) { // include "Standard" now
              mgrFlavorSets[mgr] ||= new Set<string>();
              mgrFlavorSets[mgr].add(flavor);
            }
          }
        });

        // Helpers
        const maxInMap = (m: Cnt) => {
          const entries = Object.entries(m);
          if (!entries.length) return { max: 0, owners: [] as string[] };
          const max = Math.max(...entries.map(([, v]) => v));
          const owners = entries.filter(([, v]) => v === max).map(([k]) => k);
          return { max, owners };
        };

        // 1) Most Iced Managers (total)
        const mostIced = maxInMap(totalByMgr);

        // 2) Least Iced Managers (min > 0)
        const totalsPos = Object.fromEntries(
          Object.entries(totalByMgr).filter(([, v]) => v > 0)
        ) as Cnt;
        const min = (() => {
          const vals = Object.values(totalsPos);
          return vals.length ? Math.min(...vals) : 0;
        })();
        const leastOwners = Object.entries(totalsPos)
          .filter(([, v]) => v === min)
          .map(([k]) => k);

        // 3) Most Ices in a Single Season
        let bestSeasonCount = 0;
        let bestSeasonOwners: { mgr: string; season: string }[] = [];
        for (const [season, m] of Object.entries(seasonMgrCnt)) {
          const { max, owners } = maxInMap(m);
          if (max > bestSeasonCount) {
            bestSeasonCount = max;
            bestSeasonOwners = owners.map(mgr => ({ mgr, season }));
          } else if (max === bestSeasonCount) {
            bestSeasonOwners.push(...owners.map(mgr => ({ mgr, season })));
          }
        }

        // 4) Most Ices in a Single Week (per manager)
        let bestWeekCount = 0;
        let bestWeekOwners: { mgr: string; season: string; week: string }[] = [];
        for (const [key, m] of Object.entries(weekMgrCnt)) {
          const [season, week] = key.split("|");
          const { max, owners } = maxInMap(m);
          if (max > bestWeekCount) {
            bestWeekCount = max;
            bestWeekOwners = owners.map(mgr => ({ mgr, season, week }));
          } else if (max === bestWeekCount) {
            bestWeekOwners.push(...owners.map(mgr => ({ mgr, season, week })));
          }
        }

        // 5) Most Unique Flavors Consumed
        const mgrFlavorCounts: Cnt = {};
        Object.entries(mgrFlavorSets).forEach(([mgr, set]) => {
          mgrFlavorCounts[mgr] = set.size;
        });
        const mostFlavors = maxInMap(mgrFlavorCounts);

        // 6) Most Consecutive Weeks (within a season)
        function longestRun(nums: number[]) {
          nums.sort((a, b) => a - b);
          let best = 0, cur = 0, start = nums[0], bestStart = nums[0], bestEnd = nums[0];
          for (let i = 0; i < nums.length; i++) {
            if (i === 0 || nums[i] === nums[i - 1] + 1) {
              cur = (i === 0 ? 1 : cur + 1);
            } else {
              if (cur > best) { best = cur; bestStart = start; bestEnd = nums[i - 1]; }
              cur = 1; start = nums[i];
            }
          }
          if (cur > best) { best = cur; bestStart = start; bestEnd = nums[nums.length - 1]; }
          return { len: best, start: bestStart, end: bestEnd };
        }

        let bestStreak = 0;
        let bestStreakOwners: { mgr: string; season: string; start: number; end: number }[] = [];
        for (const [mgr, seasons] of Object.entries(mgrSeasonWeeks)) {
          for (const [season, set] of Object.entries(seasons)) {
            const weeks = Array.from(set);
            if (weeks.length === 0) continue;
            const { len, start, end } = longestRun(weeks);
            if (len > bestStreak) {
              bestStreak = len;
              bestStreakOwners = [{ mgr, season, start, end }];
            } else if (len === bestStreak) {
              bestStreakOwners.push({ mgr, season, start, end });
            }
          }
        }

        // 7) Longest Active No Ice Streak (ends at last included week)
        // Build season/weeks timeline up to last included week
        const seasonsAsc = Object.keys(seasonMgrCnt).sort();
        let lastSeason = currentSeason;
        let lastWeekNum = curWeek > 1 ? curWeek - 1 : 17;
        if (curWeek === 1) {
          const idx = seasonsAsc.indexOf(currentSeason);
          if (idx > 0) lastSeason = seasonsAsc[idx - 1];
          else lastSeason = seasonsAsc[seasonsAsc.length - 1] || currentSeason;
          lastWeekNum = 17;
        }
        const allSeasonWeeks: { season: string; weekNum: number }[] = [];
        seasonsAsc.forEach(season => {
          if (season < lastSeason) {
            for (let w = 1; w <= 17; w++) allSeasonWeeks.push({ season, weekNum: w });
          } else if (season === lastSeason) {
            for (let w = 1; w <= lastWeekNum; w++) allSeasonWeeks.push({ season, weekNum: w });
          }
        });

        // Build iced weeks set per manager from weekMgrCnt
        const icedWeeksByManager: Record<string, Set<string>> = {};
        const allMgrs = new Set<string>(Object.keys(totalByMgr));
        for (const [key, m] of Object.entries(weekMgrCnt)) {
          const [season, weekStr] = key.split("|");
          const wNum = parseInt(weekStr.replace(/[^\d]/g, ""), 10);
          if (!wNum || wNum < 1 || wNum > 17) continue;
          for (const [mgr, cnt] of Object.entries(m)) {
            if (cnt > 0) {
              allMgrs.add(mgr);
              icedWeeksByManager[mgr] ||= new Set();
              icedWeeksByManager[mgr].add(`${season}|${wNum}`);
            }
          }
        }

        let bestActive = 0;
        let bestActiveOwners: { mgr: string; start: { season: string; weekNum: number }, end: { season: string; weekNum: number } }[] = [];
        for (const mgr of allMgrs) {
          let cur = 0;
          let s: { season: string; weekNum: number } | null = null;
          let e: { season: string; weekNum: number } | null = null;
          for (const sw of allSeasonWeeks) {
            const key = `${sw.season}|${sw.weekNum}`;
            const iced = icedWeeksByManager[mgr]?.has(key);
            if (!iced) {
              if (cur === 0) s = sw;
              cur++;
              e = sw;
            } else {
              cur = 0; s = null; e = null;
            }
          }
          // active streak must end at the last included week
          if (
            cur > 0 &&
            e &&
            ((e.season === lastSeason && e.weekNum === lastWeekNum))
          ) {
            if (cur > bestActive) {
              bestActive = cur;
              bestActiveOwners = [{ mgr, start: s!, end: e }];
            } else if (cur === bestActive) {
              bestActiveOwners.push({ mgr, start: s!, end: e });
            }
          }
        }

        // NEW: Longest No Ice Streak (All-Time)
        // Build timeline through all seasons up to current week for the latest season
        const allTimeSeasonsAsc = Object.keys(seasonMgrCnt).sort();
        const latestSeason = allTimeSeasonsAsc[allTimeSeasonsAsc.length - 1] || currentSeason;
        const allTimeSeasonWeeks: { season: string; weekNum: number }[] = [];
        allTimeSeasonsAsc.forEach(season => {
          const maxWeek = season === latestSeason ? curWeek : 17;
          for (let w = 1; w <= maxWeek; w++) allTimeSeasonWeeks.push({ season, weekNum: w });
        });

        // icedWeeksByManager already built above for active; reuse it. If not present, build minimal default.
        // Compute longest all-time per manager
        let bestAllTime = 0;
        let bestAllTimeOwners: { mgr: string; start: { season: string; weekNum: number }, end: { season: string; weekNum: number } }[] = [];
        const allManagersSet = new Set<string>(Object.keys(totalByMgr));
        for (const mgr of allManagersSet) {
          let maxStreak = 0, cur = 0;
          let s: { season: string; weekNum: number } | null = null;
          let e: { season: string; weekNum: number } | null = null;
          let bestS: { season: string; weekNum: number } | null = null;
          let bestE: { season: string; weekNum: number } | null = null;

          for (const sw of allTimeSeasonWeeks) {
            const key = `${sw.season}|${sw.weekNum}`;
            const iced = icedWeeksByManager[mgr]?.has(key);
            if (!iced) {
              if (cur === 0) s = sw;
              cur++; e = sw;
              if (cur > maxStreak) {
                maxStreak = cur; bestS = s; bestE = e;
              }
            } else {
              cur = 0; s = null; e = null;
            }
          }

          if (maxStreak > 0 && bestS && bestE) {
            if (maxStreak > bestAllTime) {
              bestAllTime = maxStreak;
              bestAllTimeOwners = [{ mgr, start: bestS, end: bestE }];
            } else if (maxStreak === bestAllTime) {
              bestAllTimeOwners.push({ mgr, start: bestS, end: bestE });
            }
          }
        }

        // Collect records owned by this manager (ties included)
        const owned: string[] = [];

        if (mostIced.owners.includes(displayName) && mostIced.max > 0) {
          owned.push(`Most Iced Manager • ${mostIced.max}`);
        }
        if (leastOwners.includes(displayName) && min > 0) {
          owned.push(`Least Iced Manager • ${min}`);
        }
        bestSeasonOwners
          .filter(o => o.mgr === displayName)
          .forEach(o => owned.push(`Most Ices in a Single Season • ${bestSeasonCount} (${o.season})`));
        bestWeekOwners
          .filter(o => o.mgr === displayName)
          .forEach(o => owned.push(`Most Ices in a Single Week • ${bestWeekCount} (Week ${o.week}, ${o.season})`));
        if (mostFlavors.owners.includes(displayName) && mostFlavors.max > 0) {
          owned.push(`Most Unique Flavors Consumed • ${mostFlavors.max}`);
        }
        bestStreakOwners
          .filter(o => o.mgr === displayName && bestStreak > 1)
          .forEach(o => owned.push(`Most Consecutive Weeks • ${bestStreak} (Week ${o.start}–${o.end}, ${o.season})`));

        // NEW: Longest Active No Ice Streak
        bestActiveOwners
          .filter(o => o.mgr === displayName && bestActive > 0)
          .forEach(o => {
            const startLabel = `Week ${o.start.weekNum} ${o.start.season}`;
            const endLabel = `Week ${o.end.weekNum}, ${o.end.season}`;
            owned.push(`Longest Active No Ice Streak • ${bestActive} (${startLabel}–${endLabel})`);
          });

        // NEW: Longest No Ice Streak (All-Time)
        bestAllTimeOwners
          .filter(o => o.mgr === displayName && bestAllTime > 0)
          .forEach(o => {
            const startLabel = `Week ${o.start.weekNum} ${o.start.season}`;
            const endLabel = `Week ${o.end.weekNum}, ${o.end.season}`;
            owned.push(`Longest No Ice Streak (All-Time) • ${bestAllTime} (${startLabel}–${endLabel})`);
          });

        if (alive) setRecordsHeld(Array.from(new Set(owned)));
      } catch {
        if (alive) setRecordsHeld([]);
      }
    })();
    return () => { alive = false; };
  }, [managerName, currentSeason]);

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

        {/* NEW: League Records Held */}
        {recordsHeld.length > 0 && (
          <div className="mb-6 bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
            <h3 className="text-emerald-400 font-semibold text-center mb-2">League Records Held</h3>
            <ul className="flex flex-col gap-1">
              {recordsHeld.map((txt, i) => (
                <li key={i} className="text-sm text-emerald-200 text-center">{txt}</li>
              ))}
            </ul>
          </div>
        )}

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

                        {/* Draft Recap Button */}
                        <div className="w-full mt-3">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (team.draftRecapUrl) window.open(team.draftRecapUrl, "_blank", "noopener,noreferrer");
                            }}
                            disabled={!team.draftRecapUrl}
                            title={team.draftRecapUrl ? "Open draft recap" : "Draft recap not available"}
                            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${team.draftRecapUrl ? "bg-[#0f1117] border border-[#3a3d45] text-emerald-200 hover:bg-gray-800" : "bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed opacity-60"}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-90">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 8h8M8 12h8M8 16h5" />
                            </svg>
                            <span>Draft Recap</span>
                          </button>
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

                        {/* Draft Recap Button (disabled if not available) */}
                        <div className="w-full mt-3">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (team.draftRecapUrl) window.open(team.draftRecapUrl, "_blank", "noopener,noreferrer");
                            }}
                            disabled={!team.draftRecapUrl}
                            title={team.draftRecapUrl ? "Open draft recap" : "Draft recap not available"}
                            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${team.draftRecapUrl ? "bg-[#0f1117] border border-[#3a3d45] text-emerald-200 hover:bg-gray-800" : "bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed opacity-60"}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-90">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 8h8M8 12h8M8 16h5" />
                            </svg>
                            <span>Draft Recap</span>
                          </button>
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

                        {/* Draft Recap Button for previous teams */}
                        <div className="w-full mt-3">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (team.draftRecapUrl) window.open(team.draftRecapUrl, "_blank", "noopener,noreferrer");
                            }}
                            disabled={!team.draftRecapUrl}
                            title={team.draftRecapUrl ? "Open draft recap" : "Draft recap not available"}
                            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${team.draftRecapUrl ? "bg-[#0f1117] border border-[#3a3d45] text-emerald-200 hover:bg-gray-800" : "bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed opacity-60"}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-90">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 8h8M8 12h8M8 16h5" />
                            </svg>
                            <span>Draft Recap</span>
                          </button>
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

                        {/* Draft Recap Button (disabled if not available) */}
                        <div className="w-full mt-3">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (team.draftRecapUrl) window.open(team.draftRecapUrl, "_blank", "noopener,noreferrer");
                            }}
                            disabled={!team.draftRecapUrl}
                            title={team.draftRecapUrl ? "Open draft recap" : "Draft recap not available"}
                            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${team.draftRecapUrl ? "bg-[#0f1117] border border-[#3a3d45] text-emerald-200 hover:bg-gray-800" : "bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed opacity-60"}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-90">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 8h8M8 12h8M8 16h5" />
                            </svg>
                            <span>Draft Recap</span>
                          </button>
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
