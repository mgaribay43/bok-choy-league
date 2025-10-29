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
  remainingWeeks?: number; // if not provided, will default to 6
  playoffSpots?: number; // default 6
  sims?: number; // default 2000
  estimateSd?: number; // optional fixed sd in points
  // optional schedule could be added later: Record<week, Array<[teamIdA, teamIdB]>>
}

function sampleNormal(mu = 0, sigma = 1) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * sigma + mu;
}

// erf approximation (Abramowitz & Stegun)
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

function winProbFromNormals(muA: number, sdA: number, muB: number, sdB: number) {
  const mu = muA - muB;
  const sd = Math.sqrt(sdA * sdA + sdB * sdB);
  const z = mu / (sd || 1e-6);
  return normalCdf(z);
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

  // Fetch standings from Firestore for current season if no teams prop provided
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
          if (isMounted) setFetchedTeams((data.teams ?? []) as TeamEntry[]);
        } else {
          if (isMounted) setFetchedTeams([]);
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

  const results = useMemo(() => {
    if (!teamsToUse || teamsToUse.length === 0) return null;

    // parse current wins from record and compute played games
    const state = teamsToUse.map(t => {
      const [w = '0', l = '0', tie = '0'] = t.record?.split('-') ?? [];
      const wins = Number(w) || 0;
      const losses = Number(l) || 0;
      const ties = Number(tie) || 0;
      const played = wins + losses + ties;
      return {
        id: t.id,
        name: t.name,
        manager: t.manager,
        wins,
        losses,
        ties,
        played,
        avgPoints: t.avgPoints || 0,
        pointsFor: t.pointsFor || 0,
      };
    });

    // estimate sd: if not provided, derive a league-level sd from team avg spread
    const avgs = state.map(s => s.avgPoints);
    const meanAvg = avgs.reduce((a,b) => a+b,0)/avgs.length;
    const variance = avgs.reduce((acc, v)=> acc + (v - meanAvg)*(v - meanAvg), 0) / Math.max(1, avgs.length - 1);
    const leagueSdEstimate = Math.sqrt(variance) * 1.5; // heuristic multiplier
    const sdDefault = estimateSd ?? Math.max(6, leagueSdEstimate);

    const teamIndex = new Map(state.map((s,i)=>[s.id, i]));
    const counts = new Array(state.length).fill(0).map(()=>({ placeTotals: new Array(state.length).fill(0), playoffCount: 0, expectedPlaceSum: 0 }));

    // simple symmetric round-robin schedule fallback: create matchups by pairing shuffled teams each week
    function generateFallbackMatchups() {
      const ids = state.map(s => s.id);
      const weeks: Array<Array<[string,string | null]>> = [];
      for (let w=0; w<remainingWeeks; w++) {
        const shuffled = ids.slice().sort(() => Math.random()-0.5);
        const weekMatchups: Array<[string,string | null]> = [];
        for (let i=0;i+1<shuffled.length;i+=2) {
          weekMatchups.push([shuffled[i], shuffled[i+1]]);
        }
        // if odd, last team gets a bye vs null (treated as league mean)
        if (shuffled.length % 2 === 1) weekMatchups.push([shuffled[shuffled.length-1], null]);
        weeks.push(weekMatchups);
      }
      return weeks;
    }

    const fallbackSchedule = generateFallbackMatchups();

    // simulations
    for (let sim = 0; sim < sims; sim++) {
      // copy current wins
      const simWins = state.map(s => s.wins);
      // simulate remaining weeks
      for (let w = 0; w < remainingWeeks; w++) {
        const matchups = fallbackSchedule[w];
        for (const [aId, bId] of matchups) {
          const aIdx = teamIndex.get(aId)!;
          const a = state[aIdx];
          const bIdx = bId ? teamIndex.get(bId)! : -1;
          const b = bIdx >= 0 ? state[bIdx] : undefined;
          // if opponent missing treat as league mean opponent (use meanAvg)
          const muA = a.avgPoints;
          const muB = b ? b.avgPoints : meanAvg;
          const sdA = sdDefault;
          const sdB = sdDefault;
          // sample scores
          const scoreA = sampleNormal(muA, sdA);
          const scoreB = sampleNormal(muB, sdB);
          if (scoreA > scoreB + 0.5) {
            simWins[aIdx] += 1;
          } else if (scoreB > scoreA + 0.5) {
            if (bIdx >= 0) simWins[bIdx] += 1;
          } else {
            // tie handling: count half-win for both real teams
            simWins[aIdx] += 0.5;
            if (bIdx >= 0) simWins[bIdx] += 0.5;
          }
        }
      }

      // compute ranking by wins (desc), tie-breaker by pointsFor (desc)
      const order = state.map((s,i)=>({
        i,
        wins: simWins[i],
        // approximate final pf: existing pointsFor + expected additional points from remaining weeks
        pf: s.pointsFor + (remainingWeeks * s.avgPoints),
      }));
      order.sort((x,y) => {
        if (y.wins !== x.wins) return y.wins - x.wins;
        return y.pf - x.pf;
      });

      order.forEach((o, place) => {
        counts[o.i].placeTotals[place] += 1;
        counts[o.i].expectedPlaceSum += place + 1;
        if (place < playoffSpots) counts[o.i].playoffCount += 1;
      });
    }

    // build results summary
    const summary = state.map((s, i) => {
      const placeTotals = counts[i].placeTotals;
      const mostLikelyPlace = placeTotals.indexOf(Math.max(...placeTotals)) + 1;
      const distribution = placeTotals.map(c => c / sims);
      return {
        id: s.id,
        name: s.name,
        manager: s.manager,
        playoffProb: counts[i].playoffCount / sims,
        expectedPlace: counts[i].expectedPlaceSum / sims,
        mostLikelyPlace,
        placeDistribution: distribution,
      };
    });

    return { summary };
  }, [teamsToUse, remainingWeeks, playoffSpots, sims, estimateSd]);

  if (loadingFirestore) return <div className="text-sm text-emerald-300">Loading standings…</div>;
  if (fsError) return <div className="text-sm text-red-400">Error loading standings: {fsError}</div>;
  if (!results) return <div className="text-sm text-emerald-300">No teams provided</div>;

  // Sort rows by expectedPlace (1st -> last) to make table intuitive
  const rows = results.summary.slice().sort((a,b) => a.expectedPlace - b.expectedPlace);
  const numPlaces = teamsToUse.length;

  // helper to add border classes around playoff column group
  const colClass = (i: number) => {
    let cls = "";
    // only outside vertical borders for the playoff group (no internal verticals)
    if (i === 0) cls += " border-l-2 border-emerald-600";
    if (i === playoffSpots - 1) cls += " border-r-2 border-emerald-600";
    return cls;
  };

  // ordinal helper for header labels
  const ord = (n: number) => {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  };

  return (
    <div className="bg-[#111] border border-[#222] rounded p-4 text-emerald-300">
      <h3 className="text-lg font-bold text-emerald-200 mb-4">Playoff Odds (MC)</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-300">
              <th className="py-2 pr-4">Team Name</th>
              {Array.from({ length: numPlaces }, (_, i) => (
                <th
                  key={i}
                  // apply light bg for playoff columns, outside vertical borders via colClass,
                  // and a top border across the playoff group so the group has a top edge
                  className={`py-2 px-3 text-right ${i < playoffSpots ? "bg-emerald-900/5 border-t-2 border-emerald-600" : ""} ${colClass(i)}`}
                >
                  {ord(i + 1)}
                </th>
              ))}
              <th className="py-2 pl-4 text-right">Playoff %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => {
              // total is sum of probabilities for 1..playoffSpots
              const playoffTotal = r.placeDistribution.slice(0, playoffSpots).reduce((s: number, p: number) => s + p, 0) * 100;
              const isLastRow = rowIdx === rows.length - 1;

              return (
                <tr key={r.id} className="border-t border-[#222]">
                  <td className="py-3 pr-4 align-top">
                    <div className="font-semibold text-emerald-200">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.manager}</div>
                  </td>

                  {Array.from({ length: numPlaces }, (_, i) => {
                    const pct = (r.placeDistribution[i] ?? 0) * 100;
                    const bgClass = pct > 0 ? "bg-emerald-900/30" : "";
                    // only add bottom border on the playoff group's last row so the group has a bottom edge
                    const bottomBorder = i < playoffSpots && isLastRow ? " border-b-2 border-emerald-600" : "";
                    const framed = colClass(i);
                    return (
                      <td key={i} className={`py-3 px-3 align-top text-right ${bgClass} ${framed}${bottomBorder}`}>
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

      <p className="text-xs text-gray-400 mt-3">
        *Note: These odds are calculated from each team's scores this year (average & variance) using a Monte‑Carlo simulation of remaining matchups. For best accuracy provide the real remaining schedule and increase simulations.
      </p>
    </div>
  );
}