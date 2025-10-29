'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { getCurrentSeason } from "../globalUtils/getCurrentSeason";
import { db } from "../../../firebase";
import { doc, getDoc } from "firebase/firestore";

type TeamEntry = {
  id: string;
  name: string;
  manager: string;
  rank: number;
  logo: string;
  record: string; // "W-L-T"
  pointsFor: number; // total points
  pointsAgainst: number;
  pointDiff: number;
  winPct: string; // "0.125"
  avgPoints: number; // average per played week
  pointsOverProjected: number;
};

interface PlayoffOddsProps {
  teams?: TeamEntry[]; // optional - will fetch from Firestore if omitted
  remainingWeeks?: number; // default ui starting value (kept for backwards compat)
  playoffSpots?: number; // default 6 (ignored — component forces 6)
  sims?: number; // default 2000 (ignored — component forces 10000)
  estimateSd?: number; // optional fixed sd in points
}

function sampleNormal(mu = 0, sigma = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * sigma + mu;
}

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1;
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export default function PlayoffOdds({
  teams,
  remainingWeeks = 6,
  playoffSpots = 6,
  sims = 2000,
  estimateSd,
}: PlayoffOddsProps) {
  const [fetchedTeams, setFetchedTeams] = useState<TeamEntry[] | null>(null);
  const [loadingFirestore, setLoadingFirestore] = useState(false);
  const [fsError, setFsError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Array<Array<[string, string | null]>> | null>(null);
  const [lastUpdatedWeek, setLastUpdatedWeek] = useState<number | null>(null);

  // Enforce fixed values per request
  const FIXED_PLAYOFF_SPOTS = 6;
  const FIXED_SIMS = 10000;

  // Local interactive controls (reactive) — only sims/spots removed; keep sims/playoff props for backwards compat but ignore them
  const [inputPlayoffSpots, setInputPlayoffSpots] = useState<number>(FIXED_PLAYOFF_SPOTS); // retained only for legacy UI state if needed
  const [inputSims, setInputSims] = useState<number>(FIXED_SIMS); // retained but not used
  const [appliedRemaining, setAppliedRemaining] = useState<number>(remainingWeeks);

  // Responsive: detect mobile to switch to card view
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);

  // Fetch standings from Firestore for current season if no teams prop provided.
  // Also capture lastUpdatedWeek (use this as the "current week" — season is 14 weeks).
  useEffect(() => {
    if (teams && teams.length > 0) return; // skip if teams provided
    let isMounted = true;
    (async () => {
      setLoadingFirestore(true);
      setFsError(null);
      try {
        const season = await getCurrentSeason();
        const standingsRef = doc(db, "standings", season);
        const snap = await getDoc(standingsRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (isMounted) {
            setFetchedTeams((data.teams ?? []) as TeamEntry[]);
            // support multiple possible field names
            const lw = data.lastUpdatedWeek ?? data.latestUpdatedWeek ?? data.last_week ?? null;
            setLastUpdatedWeek(lw != null ? Number(lw) : null);
          }
        } else {
          if (isMounted) {
            setFetchedTeams([]);
            setLastUpdatedWeek(null);
          }
        }
      } catch (err: any) {
        if (isMounted) setFsError(err?.message ?? "Failed to load standings");
      } finally {
        if (isMounted) setLoadingFirestore(false);
      }
    })();
    return () => { isMounted = false; };
  }, [teams]);

  const teamsToUse = teams && teams.length > 0 ? teams : (fetchedTeams ?? []);

  // Always simulate the number of weeks left in the 14-week season.
  useEffect(() => {
    if (lastUpdatedWeek == null) return;
    const remain = Math.max(0, 14 - Number(lastUpdatedWeek));
    setAppliedRemaining(remain);
  }, [lastUpdatedWeek]);

  // Build remaining schedule from Yahoo scoreboard using lastUpdatedWeek (14-week season).
  useEffect(() => {
    if (!teamsToUse || teamsToUse.length === 0) return;
    if (lastUpdatedWeek == null) return;

    let alive = true;
    (async () => {
      try {
        const season = await getCurrentSeason();
        const currentWeek = Number(lastUpdatedWeek);
        const weeksRemainingInSeason = Math.max(0, 14 - currentWeek);
        const weeksToFetch = Math.min(appliedRemaining, weeksRemainingInSeason);
        if (weeksToFetch <= 0) {
          if (alive) setSchedule([]); // no remaining scheduled weeks
          return;
        }

        const teamIdsSet = new Set(teamsToUse.map(t => String(t.id)));
        const weeks: Array<Array<[string, string | null]>> = [];

        for (let offset = 1; offset <= weeksToFetch; offset++) {
          const wk = currentWeek + offset;
          try {
            const res = await fetch(
              `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=${season}&week=${wk}`
            );
            if (!res.ok) {
              weeks.push([]); // keep slot so index aligns
              continue;
            }
            const json = await res.json();
            const matchupsObj = json?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups || {};
            const weekMatchups: Array<[string, string | null]> = [];
            Object.values(matchupsObj).forEach((m: any) => {
              const matchup = m?.matchup;
              if (!matchup) return;
              const teamsObj = matchup["0"]?.teams;
              if (!teamsObj) return;
              const teamA = teamsObj["0"]?.team;
              const teamB = teamsObj["1"]?.team;
              const idA = teamA?.[0]?.find((it: any) => it.team_id)?.team_id;
              const idB = teamB?.[0]?.find((it: any) => it.team_id)?.team_id;
              const aStr = idA ? String(idA) : null;
              const bStr = idB ? String(idB) : null;
              if (!aStr && !bStr) return;
              const aIn = aStr && teamIdsSet.has(aStr) ? aStr : null;
              const bIn = bStr && teamIdsSet.has(bStr) ? bStr : null;
              if (aIn && bIn) weekMatchups.push([aIn, bIn]);
              else if (aIn) weekMatchups.push([aIn, null]);
              else if (bIn) weekMatchups.push([bIn, null]);
            });
            weeks.push(weekMatchups);
          } catch {
            weeks.push([]);
          }
        }

        if (alive) {
          const hasData = weeks.some(w => w && w.length > 0);
          if (hasData) setSchedule(weeks);
          else setSchedule(null); // fallback generator will be used
        }
      } catch {
        // ignore and let generator fallback
      }
    })();
    return () => { alive = false; };
  }, [teamsToUse, lastUpdatedWeek, appliedRemaining]);

  // Recompute whenever applied controls change
  const results = useMemo(() => {
    if (!teamsToUse || teamsToUse.length === 0) return null;

    const state = teamsToUse.map(t => {
      const [w = '0', l = '0', tie = '0'] = t.record?.split('-') ?? [];
      const wins = Number(w) || 0;
      const losses = Number(l) || 0;
      const ties = Number(tie) || 0;
      return {
        id: t.id,
        name: t.name,
        manager: t.manager,
        wins,
        losses,
        ties,
        avgPoints: t.avgPoints || 0,
        pointsFor: t.pointsFor || 0,
      };
    });

    const avgs = state.map(s => s.avgPoints);
    const meanAvg = avgs.reduce((a,b) => a+b,0)/avgs.length;
    const variance = avgs.reduce((acc, v)=> acc + (v - meanAvg)*(v - meanAvg), 0) / Math.max(1, avgs.length - 1);
    const leagueSdEstimate = Math.sqrt(variance) * 1.5;
    const sdDefault = estimateSd ?? Math.max(6, leagueSdEstimate);

    const teamIndex = new Map(state.map((s,i)=>[s.id, i]));
    const counts = new Array(state.length).fill(0).map(()=>({ placeTotals: new Array(state.length).fill(0), playoffCount: 0, expectedPlaceSum: 0 }));

    // fallback schedule generator
    function generateFallbackMatchups() {
      const ids = state.map(s => s.id);
      const weeks: Array<Array<[string,string | null]>> = [];
      for (let w=0; w<appliedRemaining; w++) {
        const shuffled = ids.slice().sort(() => Math.random()-0.5);
        const weekMatchups: Array<[string,string | null]> = [];
        for (let i=0;i+1<shuffled.length;i+=2) {
          weekMatchups.push([shuffled[i], shuffled[i+1]]);
        }
        if (shuffled.length % 2 === 1) weekMatchups.push([shuffled[shuffled.length-1], null]);
        weeks.push(weekMatchups);
      }
      return weeks;
    }

    const fallbackSchedule = schedule ?? generateFallbackMatchups();

    // simulations (synchronous — fixed to FIXED_SIMS)
    for (let sim = 0; sim < FIXED_SIMS; sim++) {
      const simWins = state.map(s => s.wins);
      for (let w = 0; w < appliedRemaining; w++) {
        const matchups = fallbackSchedule[w] ?? [];
        for (const [aId, bId] of matchups) {
          const aIdx = teamIndex.get(aId)!;
          const a = state[aIdx];
          const bIdx = bId ? teamIndex.get(bId)! : -1;
          const b = bIdx >= 0 ? state[bIdx] : undefined;
          const muA = a.avgPoints;
          const muB = b ? b.avgPoints : meanAvg;
          const sdA = sdDefault;
          const sdB = sdDefault;
          const scoreA = sampleNormal(muA, sdA);
          const scoreB = sampleNormal(muB, sdB);
          if (scoreA > scoreB + 0.5) simWins[aIdx] += 1;
          else if (scoreB > scoreA + 0.5) { if (bIdx >= 0) simWins[bIdx] += 1; }
          else { simWins[aIdx] += 0.5; if (bIdx >= 0) simWins[bIdx] += 0.5; }
        }
      }

      const order = state.map((s,i)=>({
        i,
        wins: simWins[i],
        pf: s.pointsFor + (appliedRemaining * s.avgPoints),
      }));
      order.sort((x,y) => {
        if (y.wins !== x.wins) return y.wins - x.wins;
        return y.pf - x.pf;
      });

      order.forEach((o, place) => {
        counts[o.i].placeTotals[place] += 1;
        counts[o.i].expectedPlaceSum += place + 1;
        if (place < FIXED_PLAYOFF_SPOTS) counts[o.i].playoffCount += 1;
      });
    }

    const summary = state.map((s, i) => {
      const placeTotals = counts[i].placeTotals;
      const distribution = placeTotals.map(c => c / FIXED_SIMS);
      return {
        id: s.id,
        name: s.name,
        manager: s.manager,
        playoffProb: counts[i].playoffCount / FIXED_SIMS,
        expectedPlace: counts[i].expectedPlaceSum / FIXED_SIMS,
        placeDistribution: distribution,
      };
    });

    return { summary };
  }, [teamsToUse, appliedRemaining, estimateSd, schedule]);

  if (loadingFirestore) return <div className="text-sm text-emerald-300">Loading standings…</div>;
  if (fsError) return <div className="text-sm text-red-400">Error loading standings: {fsError}</div>;
  if (!results) return <div className="text-sm text-emerald-300">No teams provided</div>;

  // Sort rows by expectedPlace (1st -> last)
  const rows = results.summary.slice().sort((a,b) => a.expectedPlace - b.expectedPlace);
  const numPlaces = teamsToUse.length;

  // column border helper for playoff group (only outer border)
  const colClass = (i: number) => {
    let cls = "";
    if (i === 0) cls += " border-l-2 border-emerald-600";
    if (i === FIXED_PLAYOFF_SPOTS - 1) cls += " border-r-2 border-emerald-600";
    return cls;
  };

  const ord = (n: number) => {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  };

  return (
    <div className="bg-[#111] border border-[#222] rounded p-4 text-emerald-300">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-emerald-200">Playoff Odds (MC)</h3>
          <div className="text-xs text-gray-400 mt-1">
            Season week: {lastUpdatedWeek ?? "?"} • Weeks left: {appliedRemaining} • 14 weeks total
          </div>
          <div className="text-xs text-gray-400 mt-1">Playoff spots: {FIXED_PLAYOFF_SPOTS} • Simulations: {FIXED_SIMS.toLocaleString()}</div>
        </div>
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div className="space-y-3">
          {rows.map(r => {
            const playoffTotal = r.placeDistribution.slice(0, FIXED_PLAYOFF_SPOTS).reduce((s: number, p: number) => s + p, 0) * 100;
            return (
              <div key={r.id} className="bg-[#0f0f0f] border border-[#222] rounded p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-emerald-200">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.manager}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-green-400">{playoffTotal.toFixed(1)}%</div>
                    <div className="text-xs text-gray-400">Playoff %</div>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-2">
                    {r.placeDistribution.map((p, i) => (
                      <div key={i} className="min-w-[72px]">
                        <div className="text-xs text-gray-400">{ord(i+1)}</div>
                        <div className="mt-1 h-3 bg-[#0b0b0b] rounded overflow-hidden">
                          <div
                            style={{ width: `${(p*100).toFixed(2)}%` }}
                            className="h-3 bg-emerald-600"
                          />
                        </div>
                        <div className="text-xs text-emerald-200 mt-1 font-mono">{(p*100).toFixed(2)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop/table layout */
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-gray-300">
                <th className="py-2 pr-4">Team Name</th>
                {Array.from({ length: numPlaces }, (_, i) => (
                  <th
                    key={i}
                    className={`py-2 px-3 text-right ${i < FIXED_PLAYOFF_SPOTS ? "border-t-2 border-emerald-600" : ""} ${colClass(i)}`}
                  >
                    {ord(i + 1)}
                  </th>
                ))}
                <th className="py-2 pl-4 text-right">Playoff %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rowIdx) => {
                const playoffTotal = r.placeDistribution.slice(0, FIXED_PLAYOFF_SPOTS).reduce((s: number, p: number) => s + p, 0) * 100;
                const isLastRow = rowIdx === rows.length - 1;
                return (
                  <tr key={r.id} className="border-t border-[#222]">
                    <td className="py-3 pr-4 align-top">
                      <div className="font-semibold text-emerald-200">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.manager}</div>
                    </td>

                    {Array.from({ length: numPlaces }, (_, i) => {
                      const pct = (r.placeDistribution[i] ?? 0) * 100;
                      const bottomBorder = i < FIXED_PLAYOFF_SPOTS && isLastRow ? " border-b-2 border-emerald-600" : "";
                      const framed = colClass(i);
                      return (
                        <td key={i} className={`py-3 px-3 align-top text-right ${framed}${bottomBorder}`}>
                          <div className="font-mono text-sm text-emerald-200">{pct.toFixed(2)}%</div>
                        </td>
                      );
                    })}

                    <td className="py-3 pl-4 align-top text-right">
                      <div className="font-mono text-sm text-emerald-200">{playoffTotal.toFixed(2)}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        *Note: These odds are calculated from each team's scores this year (average & variance) using a Monte‑Carlo simulation of remaining matchups.
      </p>
    </div>
  );
}