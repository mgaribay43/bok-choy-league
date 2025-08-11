'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface DraftPick {
  pick: number;
  round: number;
  player_key: string;
  team_key: string;
}

interface Player {
  player_id: string;
  name: string;
  position: string;
  team_abbr: string;
  image_url: string;
  draftPick?: {
    pick: number;
    round: number;
  };
}

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  players: Player[];
}

export default function KeepersPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const fetchKeepers = async () => {
      setLoading(true);
      setError(null);

      try {
        const draftRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=draftresults&year=${(new Date().getFullYear()) - 1}`
        );
        const draftText = await draftRes.text();
        const draftData = JSON.parse(draftText.replace(/^callback\((.*)\)$/, "$1"));

        const draftPicks = extractDraftPicks(draftData);

        const rosterPromises = [];
        for (let teamNum = 1; teamNum <= 10; teamNum++) {
          const url = `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${(new Date().getFullYear()) - 1}&teamId=${teamNum}`;
          rosterPromises.push(fetch(url).then((res) => res.text()));
        }

        const rosterTexts = await Promise.all(rosterPromises);
        const allTeams: Team[] = [];

        for (const rosterText of rosterTexts) {
          const rosterData = JSON.parse(rosterText.replace(/^callback\((.*)\)$/, "$1"));
          const teamsForRoster = mergeRosterWithDraft(rosterData, draftPicks);
          allTeams.push(...teamsForRoster);
        }

        setTeams(allTeams);
      } catch (err: any) {
        setError(err?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchKeepers();
  }, []);

  const visibleTeams = selectedTeamId
    ? teams.filter((team) => team.id === selectedTeamId)
    : teams;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-4xl font-extrabold text-green-800 text-center mb-4">
        {new Date().getFullYear()} Keepers
      </h1>

      <p className="mb-8 text-center">
        Use this tool to help determine the player you wish to keep next season
      </p>

      {/* Team Selector */}
      {teams.length > 0 && (
        <div className="flex justify-center mb-6">
          <select
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value || null)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-base shadow-sm"
          >
            <option value="">Show All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Key Legend */}
      <div className="flex flex-wrap justify-center gap-6 text-sm font-medium mb-8">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border rounded bg-white" />
          <span>Undrafted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-green-100 border border-green-300" />
          <span>Keeper Eligible (Draft Round ≥ 2)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-red-100 border border-red-300" />
          <span>Keeper Ineligible (Draft Round &lt; 2)</span>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 text-lg mt-6 font-medium">
            Loading Keepers...
          </p>
        </div>
      ) : error ? (
        <p className="text-red-600 text-center">Error: {error}</p>
      ) : visibleTeams.length === 0 ? (
        <p className="text-center italic text-gray-600">No teams found.</p>
      ) : (
        <div
          className={`grid gap-8 px-2 sm:px-0 ${selectedTeamId ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
            }`}
        >
          {visibleTeams.map((team) => (
            <div
              key={team.id}
              className={`border p-6 rounded-md shadow bg-white mx-auto ${selectedTeamId
                  ? "max-w-4xl w-full"
                  : "w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl"
                }`}
            >
              <div className="flex flex-col items-center mb-6 gap-4">
                {team.logo_url && (
                  <Image
                    src={team.logo_url}
                    alt={`${team.name} logo`}
                    width={80}
                    height={80}
                    className="rounded-md"
                  />
                )}
                <h2 className="text-2xl font-semibold text-center">{team.name}</h2>
              </div>

              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {team.players.map((player) => (
                  <li
                    key={`${team.id}-${player.player_id || player.name}`}
                    className={`flex items-center gap-3 border rounded-lg p-3 shadow ${player.draftPick
                        ? player.draftPick.round >= 2
                          ? "bg-green-100"
                          : "bg-red-100"
                        : "bg-white"
                      } min-w-0`}
                  >
                    <Image
                      src={player.image_url || "/fallback-avatar.png"}
                      alt={player.name}
                      width={48}
                      height={48}
                      className="rounded-full object-cover bg-gray-100 flex-shrink-0"
                      unoptimized={false}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{player.name}</p>
                      <p className="text-sm text-gray-600 truncate">
                        {player.position} – {player.team_abbr}
                      </p>
                      {player.draftPick ? (
                        <p className="text-sm text-gray-500">
                          Drafted: Round {player.draftPick.round}, Pick {player.draftPick.pick}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Undrafted</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );

}

/**
 * Extracts all draft picks from the Yahoo Fantasy API draft results data.
 *
 * @param draftData - The raw JSON response from the Yahoo API's draftresults endpoint.
 * @returns An array of draft pick objects containing the pick number, round, player key, and team key.
 */
function extractDraftPicks(draftData: any): DraftPick[] {
  const draftResultsObj = draftData.fantasy_content?.league?.[1]?.draft_results;
  if (!draftResultsObj) return [];
  const draftEntries = Object.values(draftResultsObj) as any[];
  const picks: DraftPick[] = [];

  for (const entry of draftEntries) {
    const result = entry?.draft_result;
    if (!result) continue;
    const resultArray = Array.isArray(result) ? result : [result];
    for (const pick of resultArray) {
      if (!pick?.pick || !pick?.player_key) continue;
      picks.push({
        pick: Number(pick.pick),
        round: Number(pick.round),
        player_key: pick.player_key,
        team_key: pick.team_key,
      });
    }
  }
  return picks;
}

/**
 * Merges a single team's roster data with draft pick information to determine keeper eligibility.
 *
 * @param rosterData - The raw JSON response from the Yahoo API's roster endpoint for a team.
 * @param draftPicks - All draft picks from the league's draft, used to match players with draft round/pick.
 * @returns A normalized team object containing team ID, name, logo, and enriched player info.
 */
function mergeRosterWithDraft(rosterData: any, draftPicks: DraftPick[]): Team[] {
  const teamData = rosterData.fantasy_content?.team;
  if (!teamData) return [];

  let teamKey = "unknown_team";
  let teamName = "Unnamed Team";
  let logoUrl = "";

  for (const meta of teamData[0]) {
    if (meta.team_key) teamKey = meta.team_key;
    if (meta.name) teamName = meta.name;
    if (meta.team_logos && Array.isArray(meta.team_logos)) {
      logoUrl = meta.team_logos[0]?.team_logo?.url || "";
    } else if (meta.team_logo?.url) {
      logoUrl = meta.team_logo.url;
    }
  }

  const rawPlayers = teamData[1]?.roster?.["0"]?.players;
  if (!rawPlayers) return [];

  const playerEntries = Object.entries(rawPlayers).filter(([key]) => key !== "count");
  const players: Player[] = [];
  const leaguePrefix = teamKey.split(".")[0];

  for (const [_, playerEntry] of playerEntries) {
    const playerObj = (playerEntry as { player: any[] })?.player;
    if (!playerObj || !Array.isArray(playerObj)) continue;

    const base = playerObj[0];
    const playerId = base.find((obj: any) => obj.player_id)?.player_id || "";
    const name = base.find((obj: any) => obj.name)?.name?.full || "Unknown Player";
    const position = base.find((obj: any) => obj.display_position)?.display_position || "";
    const teamAbbr = base.find((obj: any) => obj.editorial_team_abbr)?.editorial_team_abbr || "";
    const imageUrl = base.find((obj: any) => obj.image_url)?.image_url || "";

    const fullPlayerKey = `${leaguePrefix}.p.${playerId}`;
    const draftPick = draftPicks.find((pick) => pick.player_key === fullPlayerKey);

    players.push({
      player_id: playerId,
      name,
      position,
      team_abbr: teamAbbr,
      image_url: imageUrl,
      draftPick: draftPick
        ? { pick: draftPick.pick, round: draftPick.round }
        : undefined,
    });
  }

  return [{ id: teamKey, name: teamName, logo_url: logoUrl, players }];
}
