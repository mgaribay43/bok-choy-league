'use client';

import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import leagueKeys from "../data/League_Keys/league_keys.json";

type TeamEntry = {
  id: string;
  name: string;
  manager: string;
  rank: number;
  logo: string;
  season: string;
};

export default function ManagerViewer() {
  const searchParams = useSearchParams();
  const managerName = searchParams.get("name");

  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllTeams() {
      setLoading(true);
      const allTeams: TeamEntry[] = [];
      // Get all seasons from leagueKeys
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

            if (manager === managerName) {
              allTeams.push({ id, name, manager, rank, logo, season });
            }
          }
        } catch {
          // Ignore errors for missing seasons
        }
      }
      // Sort teams by season descending (most recent first)
      allTeams.sort((a, b) => parseInt(b.season) - parseInt(a.season));
      setTeams(allTeams);
      setLoading(false);
    }

    if (managerName) fetchAllTeams();
  }, [managerName]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-emerald-700 mb-4 text-center">
          Manager: {managerName}
        </h1>
        <h2 className="text-xl font-semibold text-emerald-600 mb-2 text-center">
          Teams Owned Throughout League History
        </h2>
        {loading ? (
          <p className="text-center text-slate-500">Loading teams...</p>
        ) : teams.length === 0 ? (
          <p className="text-center text-slate-500">No teams found for this manager.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
            {teams.map(team => (
              <div key={team.season + team.id} className="bg-emerald-50 rounded-lg shadow p-4 flex flex-col items-center">
                <img src={team.logo} alt={team.name} className="w-16 h-16 rounded-full mb-2" />
                <div className="text-lg font-bold text-emerald-700 text-center">{team.name}</div>
                <div className="text-xs text-slate-500 text-center mb-1">Season: {team.season}</div>
                <div className="text-xs text-slate-700 text-center">Final Rank: {team.rank}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}