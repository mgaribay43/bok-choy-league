'use client';

import React, { useEffect, useState } from "react";
import { getCurrentSeason } from "../globalUtils/getCurrentSeason";
import { getDisplayManagerName, getInternalManagerName } from "../globalUtils/getManagerNames";
import Link from "next/link";

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
};

const START_YEAR = 2017;

interface NewStandingsProps {
  topThree?: boolean;
}

const NewStandings: React.FC<NewStandingsProps> = ({ topThree = false }) => {
  const [year, setYear] = useState<string>("");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch standings when year changes
  useEffect(() => {
    if (!year) return;
    let isMounted = true;
    async function fetchStandings() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=${year}`
        );
        if (!response.ok) throw new Error("Failed to fetch standings");

        const json = await response.json();
        const rawTeams = json.fantasy_content.league[1].standings[0].teams;
        const teamCount = parseInt(rawTeams.count, 10);
        const parsed: TeamEntry[] = [];

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
          });
        }

        parsed.sort((a, b) => a.rank - b.rank);
        if (isMounted) setTeams(parsed);
      } catch (err: any) {
        if (isMounted) setError(err.message || "An error occurred");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchStandings();
    return () => {
      isMounted = false;
    };
  }, [year]);

  // Generate year options (most recent first)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= START_YEAR; y--) {
    yearOptions.push(y.toString());
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

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

  if (topThree) {
    const podium = teams.slice(0, 3);
    const colors = [
      "border-yellow-400", // 1st
      "border-gray-400",   // 2nd
      "border-orange-400", // 3rd
    ];
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Link href="/standings" className="block w-fit mx-auto">
          <h2 className="text-5xl font-extrabold mb-8 text-center text-[#a7f3d0] hover:underline">
            Leaders
          </h2>
        </Link>
        <div className="flex flex-row justify-center gap-4 sm:gap-6">
          {podium.map((team, idx) => (
            <div
              key={team.id}
              className={`flex flex-col items-center bg-[#181818] rounded-xl border-2 ${colors[idx]} 
                px-2 py-4 sm:px-6 sm:py-6 w-1/3 min-w-0 max-w-xs flex-shrink`}
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

  return (
    <div className="max-w-5xl mx-auto p-4">
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
      <div className="overflow-x-auto">
        <table className="min-w-full bg-[#181818] rounded-lg shadow">
          <thead>
            <tr>
              <th className="py-2 px-3 text-emerald-400 text-center">Rank</th>
              <th className="py-2 px-3 text-emerald-400 text-center">Team</th>
              <th className="py-2 px-3 text-emerald-400 text-center">Manager</th>
              <th className="py-2 px-3 text-emerald-400 text-center">Record</th>
              <th className="py-2 px-3 text-emerald-400 text-center">PF</th>
              <th className="py-2 px-3 text-emerald-400 text-center">PA</th>
              <th className="py-2 px-3 text-emerald-400 text-center">+/-</th>
              <th className="py-2 px-3 text-emerald-400 text-center">Win %</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b border-[#222] hover:bg-[#222]">
                <td className="py-2 px-3 font-bold text-emerald-400 text-cen1ter">{team.rank}</td>
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
                <td className="py-2 px-3 text-emerald-400 text-center">{team.winPct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NewStandings;