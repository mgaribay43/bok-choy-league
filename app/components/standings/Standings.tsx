'use client';

import React, { useEffect, useMemo, useState } from "react";
import { getCurrentSeason } from "../globalUtils/getCurrentSeason";
import { getCurrentWeek } from "../globalUtils/getCurrentWeek";
import { getDisplayManagerName, getInternalManagerName } from "../globalUtils/getManagerNames";
import Link from "next/link";
import { db } from "../../../firebase"; // Use the shared Firestore instance
import { doc, getDoc, setDoc } from "firebase/firestore";

type TeamEntry = {
  id: string;
  name: string;
  manager: string;
  rank: number;
  logo: string;
  record: string;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winPct: string;
  avgPoints: number;
  pointsOverProjected: number;
};

const START_YEAR = 2017;

interface NewStandingsProps {
  topThree?: boolean;
}

interface CachedStandings {
  teams: TeamEntry[];
  lastUpdatedWeek: number;
}

const NewStandings: React.FC<NewStandingsProps> = ({ topThree = false }) => {
  const [year, setYear] = useState<string>("");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedWeek, setLastUpdatedWeek] = useState<number>(0);

  // Get current season on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchSeason() {
      try {
        const season = await getCurrentSeason();
        if (isMounted) setYear(season);
      } catch {
        if (isMounted) setYear(new Date().getFullYear().toString());
      }
    }
    fetchSeason();
    return () => { isMounted = false; };
  }, []);

  // Fetch standings (with Firestore caching)
  useEffect(() => {
    if (!year) return;
    let isMounted = true;

    async function fetchAndCacheStandings() {
      setLoading(true);
      setError(null);

      try {
        // 1. Try Firestore first
        const standingsRef = doc(db, "standings", year);
        const standingsSnap = await getDoc(standingsRef);

        let cached: CachedStandings | null = null;
        if (standingsSnap.exists()) {
          cached = standingsSnap.data() as CachedStandings;
        }

        // 2. For current season, check if update needed
        let shouldUpdate = false;
        let currentWeek = 0;
        const currentSeason = await getCurrentSeason();
        if (year === currentSeason) {
          currentWeek = await getCurrentWeek(year);
          if (!cached || !cached.lastUpdatedWeek || cached.lastUpdatedWeek < currentWeek) {
            shouldUpdate = true;
          }
        } else if (!cached) {
          // 3. For past seasons, only update if not cached
          shouldUpdate = true;
        }

        if (cached && !shouldUpdate) {
          // Use cached data
          if (isMounted) {
            setTeams(cached.teams);
            setLastUpdatedWeek(cached.lastUpdatedWeek);
            setLoading(false);
          }
          return;
        }

        // 4. Fetch from Yahoo API, process, and cache
        // --- Fetch standings from Yahoo ---
        const response = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=${year}`
        );
        if (!response.ok) throw new Error("Failed to fetch standings");

        const json = await response.json();
        const rawTeams = json.fantasy_content.league[1].standings[0].teams;
        const teamCount = parseInt(rawTeams.count, 10);
        const parsed: TeamEntry[] = [];

        // --- Get current week ---
        const yahooCurrentWeek = Number(json.fantasy_content.league[0]?.current_week ?? 1);

        // --- Aggregate POP for all weeks ---
        const popMap: Record<string, { actual: number[]; projected: number[] }> = {};
        for (let week = 1; week < yahooCurrentWeek; week++) {
          try {
            const scoreboardRes = await fetch(
              `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${year}&week=${week}`
            );
            if (scoreboardRes.ok) {
              const scoreboardJson = await scoreboardRes.json();
              const matchups =
                scoreboardJson.fantasy_content.league[1].scoreboard["0"].matchups;
              for (const matchupIdx in matchups) {
                const matchup = matchups[matchupIdx].matchup;
                if (!matchup) continue;
                const teamsObj = matchup["0"].teams;
                for (const teamIdx in teamsObj) {
                  if (teamIdx === "count") continue;
                  const teamArr = teamsObj[teamIdx].team;
                  const meta = teamArr[0];
                  const stats = teamArr[1];
                  const teamId = meta.find((item: any) => item.team_id)?.team_id;
                  const actual = Number(stats.team_points?.total ?? 0);
                  const projected = Number(stats.team_projected_points?.total ?? 0);
                  if (teamId) {
                    if (!popMap[teamId]) {
                      popMap[teamId] = { actual: [], projected: [] };
                    }
                    popMap[teamId].actual.push(actual);
                    popMap[teamId].projected.push(projected);
                  }
                }
              }
            }
          } catch {
            // skip week if error
          }
        }

        for (let i = 0; i < teamCount; i++) {
          const teamData = rawTeams[i.toString()].team;
          const metadata = teamData[0];
          const standings = teamData[2]?.team_standings;

          const id = metadata.find((item: any) => item.team_id)?.team_id ?? `${i + 1}`;
          const name = metadata.find((item: any) => item.name)?.name ?? "Unknown Team";
          const managerRaw =
            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.nickname ?? "Unknown";
          const manager = getDisplayManagerName(managerRaw);
          const rank = parseInt(standings?.rank ?? "99", 10);
          const logo =
            metadata.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ??
            "https://via.placeholder.com/100";
          const outcome = standings?.outcome_totals || {};
          const wins = Number(outcome.wins ?? 0);
          const losses = Number(outcome.losses ?? 0);
          const ties = Number(outcome.ties ?? 0);
          const record = `${wins}-${losses}-${ties}`;

          // Points for/against
          const pointsFor = Number(standings?.points_for ?? 0);
          const pointsAgainst = Number(standings?.points_against ?? 0);
          const pointDiff = pointsFor - pointsAgainst;

          // Win %
          const gamesPlayed = wins + losses + ties;
          let winPct = "0.000";
          if (gamesPlayed > 0) {
            winPct = ((wins + 0.5 * ties) / gamesPlayed).toFixed(3);
          }

          // Average points per week
          const avgPoints = gamesPlayed > 0 ? pointsFor / gamesPlayed : 0;

          // --- Points Over Projected (POP) ---
          const actualArr = popMap[id]?.actual ?? [];
          const projectedArr = popMap[id]?.projected ?? [];
          const pointsOverProjected =
            actualArr.reduce((sum, val) => sum + val, 0) -
            projectedArr.reduce((sum, val) => sum + val, 0);

          parsed.push({
            id,
            name,
            manager,
            rank,
            logo,
            record,
            pointsFor,
            pointsAgainst,
            pointDiff,
            winPct,
            avgPoints,
            pointsOverProjected,
          });
        }

        parsed.sort((a, b) => a.rank - b.rank);

        // 5. Store in Firestore
        await setDoc(standingsRef, {
          teams: parsed,
          lastUpdatedWeek: yahooCurrentWeek,
        });

        if (isMounted) {
          setTeams(parsed);
          setLastUpdatedWeek(yahooCurrentWeek);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "An error occurred");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // For topThree, only pull from Firestore and do not update
    if (topThree) {
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const standingsRef = doc(db, "standings", year);
          const standingsSnap = await getDoc(standingsRef);
          if (standingsSnap.exists()) {
            const cached = standingsSnap.data() as CachedStandings;
            setTeams(cached.teams);
            setLastUpdatedWeek(cached.lastUpdatedWeek);
          } else {
            setError("No standings data found for this season.");
          }
        } catch (err: any) {
          setError(err.message || "An error occurred");
        } finally {
          setLoading(false);
        }
      })();
    } else {
      fetchAndCacheStandings();
    }
    return () => { isMounted = false; };
  }, [year, topThree]);

  // --- Sorting state ---
  type SortKey =
    | "rank"
    | "record"
    | "pointsFor"
    | "pointsAgainst"
    | "pointDiff"
    | "winPct"
    | "avgPoints"
    | "pointsOverProjected"; // <-- Rename to pointsOverProjected
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const changeSort = (key: SortKey) => {
    setSortDir((prev) => (key === sortKey ? (prev === "asc" ? "desc" : "asc") : key === "rank" ? "asc" : "desc"));
    setSortKey(key);
  };

  const parseRecordPct = (record: string) => {
    const [w = "0", l = "0", t = "0"] = record.split("-");
    const wins = Number(w) || 0;
    const losses = Number(l) || 0;
    const ties = Number(t) || 0;
    const gp = wins + losses + ties;
    return gp > 0 ? (wins + 0.5 * ties) / gp : 0;
  };

  const sortedTeams = useMemo(() => {
    const arr = [...teams];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "record":
          cmp = parseRecordPct(a.record) - parseRecordPct(b.record);
          break;
        case "pointsFor":
          cmp = a.pointsFor - b.pointsFor;
          break;
        case "pointsAgainst":
          cmp = a.pointsAgainst - b.pointsAgainst;
          break;
        case "pointDiff":
          cmp = a.pointDiff - b.pointDiff;
          break;
        case "winPct":
          cmp = parseFloat(a.winPct) - parseFloat(b.winPct);
          break;
        case "avgPoints":
          cmp = a.avgPoints - b.avgPoints;
          break;
        case "pointsOverProjected":
          cmp = a.pointsOverProjected - b.pointsOverProjected;
          break;
        case "rank":
        default:
          cmp = a.rank - b.rank;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [teams, sortKey, sortDir]);

  // Reset sort when year changes (optional)
  useEffect(() => {
    setSortKey("rank");
    setSortDir("asc");
  }, [year]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-900 border border-red-700 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-red-200 mb-2">Unable to Load Standings</h3>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // Top 3 teams (podium)
  if (topThree) {
    const podium = teams.slice(0, 3);
    const colors = [
      "border-yellow-400", // 1st
      "border-gray-400",   // 2nd
      "border-orange-400", // 3rd
    ];
    return (
      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <Link href="/standings" className="block w-fit mx-auto">
          <h2 className="text-5xl font-extrabold mb-8 text-center text-[#a7f3d0] hover:underline">
            Leaders
          </h2>
        </Link>
        <div className="flex flex-row justify-center gap-6 sm:gap-6">
          {podium.map((team, idx) => (
            <div
              key={team.id}
              className={`flex flex-col items-center bg-[#181818] rounded-xl border-2 ${colors[idx]} 
                px-2 py-4 sm:px-6 sm:py-6 flex-1 min-w-0 max-w-[95vw] sm:max-w-xs`}
              style={{ minWidth: 0 }}
            >
              <img
                src={team.logo}
                alt={team.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-3 border-4 border-[#222]"
              />
              <div className="text-base sm:text-lg font-bold text-emerald-200 text-center mb-1 break-words">{team.name}</div>
              <div className="text-sm sm:text-md text-green-400 text-center mb-1">
                {getDisplayManagerName(team.manager)}
              </div>
              <div className="text-green-400 text-center text-base sm:text-lg font-mono">{team.record}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Helper to render sort arrow
  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  // Mobile sort options
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "rank", label: "Rank" },
    { key: "record", label: "Record" },
    { key: "pointsFor", label: "PF" },
    { key: "pointsAgainst", label: "PA" },
    { key: "pointDiff", label: "+/-" },
    { key: "winPct", label: "Pct" },
    { key: "avgPoints", label: "Avg Pts" },
    { key: "pointsOverProjected", label: "POP" }, // <-- Rename to POP
  ];

  // Generate year options from START_YEAR to current year, most recent year first
  const yearOptions = Array.from(
    { length: new Date().getFullYear() - START_YEAR + 1 },
    (_, i) => (START_YEAR + i).toString()
  ).reverse();

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Year selection and header */}
      <div className="flex justify-center mb-6">
        <label htmlFor="year-select" className="mr-2 text-emerald-400 font-semibold">
          Season:
        </label>
        <select
          id="year-select"
          className="bg-[#181818] border border-emerald-700 rounded px-3 py-1 text-emerald-400"
          value={year}
          onChange={e => setYear(e.target.value)}
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <h2 className="text-5xl font-bold mb-8 text-center text-[#a7f3d0]">
        {year} League Standings
      </h2>

      {/* Mobile/Tablet controls: sort dropdown + direction toggle */}
      <div className="flex items-center justify-between mb-3 sm:flex md:flex lg:hidden">
        <div className="flex items-center gap-2">
          <label htmlFor="mobile-sort" className="text-emerald-300 text-sm">Sort:</label>
          <select
            id="mobile-sort"
            className="bg-[#181818] border border-emerald-700 rounded px-2 py-1 text-emerald-400 text-sm"
            value={sortKey}
            onChange={(e) => changeSort(e.target.value as SortKey)}
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          className="text-xs px-2 py-1 rounded bg-[#222] border border-[#2a2a2a] text-emerald-300"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "Asc ▲" : "Desc ▼"}
        </button>
      </div>

      {/* Mobile/Tablet list (up to lg screens) */}
      <div className="lg:hidden space-y-3">
        {sortedTeams.map((team) => (
          <div key={team.id} className="bg-[#181818] border border-[#262626] rounded-xl p-3 shadow-sm">
            {/* Top row: rank, team, win% */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#121212] border border-[#2a2a2a] text-emerald-400 font-bold">
                    {team.rank}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <img src={team.logo} alt={team.name} className="w-8 h-8 rounded-full shrink-0" />
                  <Link
                    href={`/roster?teamId=${encodeURIComponent(team.id)}&year=${encodeURIComponent(year)}`}
                    className="text-emerald-200 hover:text-emerald-300 underline truncate"
                    title={team.name}
                  >
                    {team.name}
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-300">Pct</div>
                <div className="text-emerald-400 font-mono">{team.winPct}</div>
              </div>
            </div>

            {/* Manager + Record */}
            <div className="mt-2 flex items-center justify-between">
              <Link
                href={`/manager?name=${encodeURIComponent(getInternalManagerName(team.manager))}`}
                className="text-emerald-300 hover:text-emerald-200 underline text-sm"
              >
                {getDisplayManagerName(team.manager)}
              </Link>
              <div className="text-green-400 font-mono text-sm">{team.record}</div>
            </div>

            {/* PF / PA / +/- / Avg / POP */}
            <div className="mt-2 grid grid-cols-5 gap-2 text-center">
              <div className="bg-[#111] border border-[#222] rounded p-1.5">
                <div className="text-[10px] text-emerald-300">PF</div>
                <div className="text-emerald-200 font-mono text-xs break-words">{team.pointsFor.toFixed(2)}</div>
              </div>
              <div className="bg-[#111] border border-[#222] rounded p-1.5">
                <div className="text-[10px] text-emerald-300">PA</div>
                <div className="text-emerald-200 font-mono text-xs break-words">{team.pointsAgainst.toFixed(2)}</div>
              </div>
              <div className="bg-[#111] border border-[#222] rounded p-1.5">
                <div className="text-[10px] text-emerald-300">+/-</div>
                <div className="text-emerald-200 font-mono text-xs break-words">{team.pointDiff.toFixed(2)}</div>
              </div>
              <div className="bg-[#111] border border-[#222] rounded p-1.5">
                <div className="text-[10px] text-emerald-300">Avg</div>
                <div className="text-emerald-200 font-mono text-xs break-words">{team.avgPoints.toFixed(2)}</div>
              </div>
              <div className="bg-[#111] border border-[#222] rounded p-1.5">
                <div className="text-[10px] text-emerald-300">POP</div>
                <div className="text-emerald-200 font-mono text-xs break-words">{team.pointsOverProjected.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop/tablet table (lg and up) */}
      <div className="hidden lg:block overflow-x-auto mt-2">
        <table className="min-w-full bg-[#181818] rounded-lg shadow">
          <thead>
            <tr>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("rank")}
              >
                Rank{arrow("rank")}
              </th>
              {/* Remove sort for Team, Manager */}
              <th className="py-2 px-3 text-emerald-400 text-left">Team</th>
              <th className="py-2 px-3 text-emerald-400 text-center">Manager</th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("record")}
              >
                Record{arrow("record")}
              </th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("pointsFor")}
              >
                PF{arrow("pointsFor")}
              </th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("pointsAgainst")}
              >
                PA{arrow("pointsAgainst")}
              </th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("pointDiff")}
              >
                +/-{arrow("pointDiff")}
              </th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("avgPoints")}
              >
                Avg{arrow("avgPoints")}
              </th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("winPct")}
              >
                Pct{arrow("winPct")}
              </th>
              <th
                className="py-2 px-3 text-emerald-400 text-center cursor-pointer select-none"
                onClick={() => changeSort("pointsOverProjected")}
              >
                POP{arrow("pointsOverProjected")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => (
              <tr key={team.id} className="border-b border-[#222] hover:bg-[#222]">
                <td className="py-2 px-3 font-bold text-emerald-400 text-center">{team.rank}</td>
                <td className="py-2 px-3 text-emerald-400 text-left">
                  <div className="flex items-center gap-2">
                    <img src={team.logo} alt={team.name} className="w-8 h-8 rounded-full" />
                    <Link
                      href={`/roster?teamId=${encodeURIComponent(team.id)}&year=${encodeURIComponent(year)}`}
                      className="underline hover:text-emerald-300 text-emerald-200"
                    >
                      {team.name}
                    </Link>
                  </div>
                </td>
                <td className="py-2 px-3 text-emerald-400 text-center">
                  <Link
                    href={`/manager?name=${encodeURIComponent(getInternalManagerName(team.manager))}`}
                    className="underline hover:text-emerald-200 text-emerald-300"
                  >
                    {getDisplayManagerName(team.manager)}
                  </Link>
                </td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.record}</td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.pointsFor.toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.pointsAgainst.toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.pointDiff.toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.avgPoints.toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.winPct}</td>
                <td className="py-2 px-3 text-emerald-400 text-center">{team.pointsOverProjected.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Stats Key */}
      <div className="max-w-5xl mx-auto mt-8 mb-4 px-4">
        <div className="bg-[#181818] border border-emerald-700 rounded-xl p-4 text-emerald-300 text-sm shadow">
          <h3 className="text-emerald-400 font-bold mb-2">Stats Key</h3>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-6">
            <li><span className="font-mono text-emerald-200">Rank</span>: League rank</li>
            <li><span className="font-mono text-emerald-200">Record</span>: Wins-Losses-Ties</li>
            <li><span className="font-mono text-emerald-200">PF</span>: Points For (total points scored)</li>
            <li><span className="font-mono text-emerald-200">PA</span>: Points Against (total points allowed)</li>
            <li><span className="font-mono text-emerald-200">Avg</span>: Average points per week</li>
            <li><span className="font-mono text-emerald-200">+/-</span>: Point Differential (PF minus PA)</li>
            <li><span className="font-mono text-emerald-200">Pct</span>: Win Percentage</li>
            <li><span className="font-mono text-emerald-200">POP</span>: Points Over Projected (actual points minus projected points)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NewStandings;