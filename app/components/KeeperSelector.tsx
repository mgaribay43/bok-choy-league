"use client";

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

  useEffect(() => {
    const fetchKeepers = async () => {
      setLoading(true);
      setError(null);
      console.log("Fetching draft results...");

      try {
        const draftRes = await fetch(
          "https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=draftresults&year=2024"
        );
        const draftText = await draftRes.text();
        const draftData = JSON.parse(draftText.replace(/^callback\((.*)\)$/, "$1"));
        console.log("Draft data:", draftData);

        const draftPicks = extractDraftPicks(draftData);
        console.log("Draft picks extracted:", draftPicks);

        const rosterPromises = [];
        for (let teamNum = 1; teamNum <= 10; teamNum++) {
          const url = `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=2024&teamId=${teamNum}`;
          rosterPromises.push(fetch(url).then((res) => res.text()));
        }

        const rosterTexts = await Promise.all(rosterPromises);
        console.log("Roster responses received");

        const allTeams: Team[] = [];

        for (const rosterText of rosterTexts) {
          const rosterData = JSON.parse(rosterText.replace(/^callback\((.*)\)$/, "$1"));
          const teamsForRoster = mergeRosterWithDraft(rosterData, draftPicks);
          console.log("Teams for this roster:", teamsForRoster);
          allTeams.push(...teamsForRoster);
        }

        console.log("All teams merged:", allTeams);
        setTeams(allTeams);
      } catch (err: any) {
        console.error("Failed to load keepers:", err);
        setError(err?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchKeepers();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Page Title */}
      <h1 className="text-4xl font-extrabold text-green-800 text-center mb-10">2025 Keepers</h1>
      <p className="mb-8 text-center">Use this tool to help determine the player you wish to keep next season</p>
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

      {/* Loading/Error */}
      {loading && <p className="text-center">Loading rosters and draft results...</p>}
      {error && <p className="text-red-600 text-center">Error: {error}</p>}

      {/* Teams Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 px-2 sm:px-0">
          {teams.map((team) => (
            <div
              key={team.id}
              className="border p-6 rounded-md shadow bg-white max-w-full sm:max-w-xl mx-auto"
            >
              {/* Team Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center mb-6 gap-4">
                {team.logo_url && (
                  <Image
                    src={team.logo_url}
                    alt={`${team.name} logo`}
                    width={80}
                    height={80}
                    className="rounded-md mx-auto sm:mx-0"
                  />
                )}
                <h2 className="text-2xl font-semibold text-center sm:text-left flex-grow">
                  {team.name}
                </h2>
              </div>

              {/* Player List */}
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {team.players.map((player) => (
                  <li
                    key={`${team.id}-${player.player_id || player.name}`}
                    className={`flex items-center gap-3 border rounded-lg p-3 shadow ${player.draftPick
                      ? player.draftPick.round >= 2
                        ? "bg-green-100"
                        : "bg-red-100"
                      : "bg-white"
                      } min-w-0`} // min-w-0 helps text truncate properly inside flex
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

function mergeRosterWithDraft(rosterData: any, draftPicks: DraftPick[]): Team[] {
  const teamData = rosterData.fantasy_content?.team;
  if (!teamData) return [];

  let teamKey = "unknown_team";
  let teamName = "Unnamed Team";
  let logoUrl = "";

  for (const meta of teamData[0]) {
    if (meta.team_key) teamKey = meta.team_key;
    if (meta.name) teamName = meta.name;

    if (meta.team_logos && Array.isArray(meta.team_logos) && meta.team_logos.length > 0) {
      logoUrl = meta.team_logos[0]?.team_logo?.url || "";
    }

    if (!logoUrl && meta.team_logo?.url) {
      logoUrl = meta.team_logo.url;
    }
  }

  const rawPlayers = teamData[1]?.roster?.["0"]?.players;
  if (!rawPlayers) return [];

  const playerEntries = Object.entries(rawPlayers).filter(([key]) => key !== "count");
  const players: Player[] = [];

  const leaguePrefix = teamKey.split('.')[0]; // e.g. '449'

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

    const draftPick = draftPicks.find(
      (pick) => pick.player_key === fullPlayerKey
    );

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
