"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface TeamEntry {
  id: string;
  name: string;
  manager: string;
  rank: number;
  logo: string;
}

const StandingsViewer = () => {
  const [year, setYear] = useState<string>("2025");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchStandings() {
      setError(null);
      setTeams([]);
      setLoading(true);

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
          const manager =
            metadata.find((item: any) => item.managers)?.managers?.[0]?.manager?.nickname ?? "Unknown";
          const rank = parseInt(standings?.rank ?? "99", 10);
          const logo =
            metadata.find((item: any) => item.team_logos)?.team_logos?.[0]?.team_logo?.url ??
            "https://via.placeholder.com/100";

          parsed.push({ id, name, manager, rank, logo });
        }

        parsed.sort((a, b) => a.rank - b.rank);
        setTeams(parsed);
      } catch (err: unknown) {
        let message = "An error occurred";
        if (err instanceof Error) message = err.message;
        setError(message);
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
  }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYear(e.target.value);
  };

  const champion = teams[0];
  const others = teams.slice(1);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Year Selector */}
      <div className="flex justify-center mb-8">
        <select
          value={year}
          onChange={handleYearChange}
          className="border border-gray-300 rounded-xl px-5 py-2 text-lg shadow-sm hover:shadow-md transition"
        >
          {Array.from({ length: 2025 - 2017 + 1 }, (_, i) => (2025 - i).toString()).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Heading */}
      <h2 className="text-4xl font-extrabold text-center mb-4 text-slate-800">
        🏈 Bok Choy League Standings {year}
      </h2>

      {year === "2025" && (
        <p className="text-center text-gray-600 mb-10">Check back once the season has begun.</p>
      )}

      {/* Error or Loading */}
      {error && <p className="text-red-500 text-center">{error}</p>}
      {loading && <p className="text-center text-gray-600">Loading standings...</p>}

      {/* Champion Card - only for years other than 2025 */}
      {!loading && !error && champion && year !== "2025" && (
        <div className="mb-12">
          <h3 className="text-center text-2xl font-bold text-yellow-500 mb-4">🥇 Champion</h3>
          <div className="bg-gradient-to-r from-yellow-200 to-yellow-100 border border-yellow-400 rounded-3xl shadow-lg p-6 flex flex-col items-center max-w-md mx-auto">
            <Image
              src={champion.logo}
              alt={`${champion.name} logo`}
              width={112}
              height={112}
              className="rounded-full object-cover border-4 border-yellow-500 mb-4"
            />
            <h3 className="text-2xl font-bold text-yellow-700">{champion.name}</h3>
            <p className="text-gray-700">
              Manager: <span className="font-medium">{champion.manager}</span>
            </p>
          </div>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {(year === "2025" ? teams : others).map((team) => (
          <div
            key={team.id}
            className="bg-white rounded-3xl shadow-md p-6 flex flex-col items-center text-center hover:shadow-xl transition-all"
          >
            <Image
              src={team.logo}
              alt={`${team.name} logo`}
              width={80}
              height={80}
              className="rounded-full object-cover mb-3"
            />
            <h3 className="text-lg font-semibold text-slate-800">{team.name}</h3>
            <p className="text-sm text-gray-600">
              Manager: <span className="font-medium">{team.manager}</span>
            </p>
            {!isNaN(team.rank) && (
              <p className="text-xs text-gray-500 mt-1">Rank: {team.rank}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StandingsViewer;
