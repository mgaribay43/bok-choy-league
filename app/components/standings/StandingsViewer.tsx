'use client';

import React, { useEffect, useState } from "react";

import { TeamEntry, StandingsProps, getDisplayManagerName } from "./utils/standingsUtils";

import StandingsHeader from "./components/StandingsHeader";
import LeadersStrip from "./components/LeadersStrip";
import TeamsGridPreseason from "./components/TeamsGridPreseason";
import ChampionSpotlight from "./components/ChampionSpotlight";
import PlayoffsGrid from "./components/PlayoffsGrid";
import EliminatedGrid from "./components/EliminatedGrid";

const StandingsViewer = ({ topThree = false }: StandingsProps) => {
  const [year, setYear] = useState<string>("2025");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchStandings() {
      setError(null);
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
          const outcome = standings?.outcome_totals || {};
          const wins = outcome.wins ?? 0;
          const losses = outcome.losses ?? 0;
          const ties = outcome.ties ?? 0;
          const record = `(${wins}-${losses}-${ties})`;
          parsed.push({
            id,
            name,
            manager: getDisplayManagerName(manager),
            realManager: manager,
            rank,
            logo,
            record,
          });
        }

        parsed.sort((a, b) => a.rank - b.rank);

        if (isMounted) setTeams(parsed);
      } catch (err: unknown) {
        let message = "An error occurred";
        if (err instanceof Error) message = err.message;
        setError(message);
        console.error("Fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStandings();
    return () => { isMounted = false; };
  }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => setYear(e.target.value);

  // Only show top 3 teams if topThree prop is true
  const allRanksNaN = teams.length > 0 && teams.every(t => isNaN(t.rank));

  if (topThree) {
    return <LeadersStrip year={year} teams={teams} error={error} loading={loading} />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <StandingsHeader year={year} onYearChange={handleYearChange} />

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-900 border border-red-700 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-red-200 mb-2">Unable to Load Standings</h3>
              <p className="text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {/* Preseason Grid (no ranks) */}
        {!loading && !error && allRanksNaN && (
          <TeamsGridPreseason year={year} teams={teams} />
        )}

        {/* Completed/active seasons with ranks */}
        {!loading && !error && !allRanksNaN && (
          <>
            <ChampionSpotlight year={year} teams={teams} />

            {(() => {
              const gridTeams = year === "2025" ? teams : teams.slice(3);
              const playoffs = gridTeams.filter(team => team.rank <= 6);
              const eliminated = gridTeams.filter(team => team.rank > 6);
              return (
                <>
                  {playoffs.length > 0 && <PlayoffsGrid year={year} teams={playoffs} />}
                  {eliminated.length > 0 && <EliminatedGrid year={year} teams={eliminated} />}
                </>
              );
            })()}

            {/* Empty state fallback */}
            {!loading && !error && teams.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🏈</div>
                <h3 className="text-2xl font-semibold text-emerald-200 mb-2">No Standings Available</h3>
                <p className="text-emerald-400">Unable to load standings for the {year} season.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StandingsViewer;