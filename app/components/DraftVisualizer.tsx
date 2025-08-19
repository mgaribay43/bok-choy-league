'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import leagueKeysByYearJson from "../data/League_Keys/league_keys.json";

const positionColors: Record<string, string> = {
  QB: "bg-gradient-to-br from-orange-300 to-orange-500",
  RB: "bg-gradient-to-br from-green-300 to-green-500",
  WR: "bg-gradient-to-br from-blue-300 to-blue-500",
  TE: "bg-gradient-to-br from-purple-300 to-purple-500",
  K: "bg-gradient-to-br from-yellow-200 to-yellow-400",
  DEF: "bg-gradient-to-br from-gray-300 to-gray-500",
};

export default function DraftBoardPage() {
  const [selectedYear, setSelectedYear] = useState("");
  const [draftPicks, setDraftPicks] = useState<any[]>([]);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamManagers, setTeamManagers] = useState<Record<string, string>>({});
  const [draftTime2025, setDraftTime2025] = useState<number | null>(null);
  const leagueKeysByYear = leagueKeysByYearJson as Record<string, string>;

  useEffect(() => {
    if (!selectedYear) {
      setDraftPicks([]); setPlayers({}); setError(null); setLoading(false); return;
    }

    // Try cache first
    const cached = getCachedDraft(selectedYear);
    if (cached) {
      setDraftPicks(cached.draftPicks);
      setPlayers(cached.players);
      setTeamManagers(cached.teamManagers);
      setLoading(false);
      return; // <-- Only fetch if not cached
    }

    const safeParse = (raw: string) => JSON.parse(raw.replace(/^callback\((.*)\)$/, "$1"));
    const fetchData = async () => {
      if (!leagueKeysByYear[selectedYear]) {
        setError(`No league key for year ${selectedYear}`); setDraftPicks([]); setPlayers({}); return;
      }
      setLoading(true); setError(null);
      try {
        // Teams
        const teamsJson = safeParse(await (await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=teams&year=${selectedYear}`
        )).text());
        const teamManagers = extractTeamManagerMap(teamsJson);
        setTeamManagers(teamManagers);

        // Draft Results
        const draftJson = safeParse(await (await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=draftresults&year=${selectedYear}`
        )).text());
        const draftPicks = extractDraftPicks(draftJson);
        setDraftPicks(draftPicks);

        // Players
        const uniquePlayerKeys = [...new Set(draftPicks.map((p: any) => p.player_key))];
        const allPlayers: Record<string, any> = {};
        for (let i = 0; i < uniquePlayerKeys.length; i += 25) {
          const batchKeys = uniquePlayerKeys.slice(i, i + 25).join(",");
          const pJson = safeParse(await (await fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=players&year=${selectedYear}&playerKeys=${batchKeys}`
          )).text());
          Object.assign(allPlayers, extractPlayerMap(pJson));
        }
        setPlayers(allPlayers);

        // Save to cache
        setCachedDraft(selectedYear, { draftPicks, players: allPlayers, teamManagers });
      } catch (err: any) {
        setError(err?.message || "Failed to load draft data");
      } finally { setLoading(false); }
    };

    fetchData();
  }, [selectedYear]);

  useEffect(() => {
    // Fetch draft time for 2025
    async function fetchDraftTime() {
      try {
        const response = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=2025`
        );
        if (!response.ok) return;
        const json = await response.json();
        const draftTime = json?.fantasy_content?.league?.[1]?.settings?.[0]?.draft_time;
        if (draftTime) setDraftTime2025(Number(draftTime) * 1000);
      } catch {
        setDraftTime2025(null);
      }
    }
    fetchDraftTime();
  }, []);

  // Table data prep
  const groupedByRoundAndTeam: Record<number, Record<string, any>> = {};
  draftPicks.forEach((pick) => {
    if (!groupedByRoundAndTeam[pick.round]) groupedByRoundAndTeam[pick.round] = {};
    groupedByRoundAndTeam[pick.round][pick.team_key] = pick;
  });
  const rounds = [...new Set(draftPicks.map((p) => p.round))].sort((a, b) => a - b);
  const teamOrder = draftPicks.filter((p) => p.round === 1).sort((a, b) => a.pick - b.pick).map((p) => p.team_key);
  const teamKeyToName = Object.fromEntries(teamOrder.map((key) => [key, teamManagers[key] || key]));
  const pickMap = Object.fromEntries(draftPicks.map((p) => [p.pick, p]));

  return (
    <div className="w-full overflow-x-auto px-2 py-0">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-green-800">Draft Board</h1>
      <div className="mb-6 flex justify-center gap-4 flex-wrap">
        <label htmlFor="year-select" className="font-semibold self-center">Select Year:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 bg-white text-black"
        >
          <option value="">Select Year</option>
          {Object.keys(leagueKeysByYear).sort((a, b) => Number(b) - Number(a)).map(year => (
            <option
              key={year}
              value={year}
              disabled={
                year === "2025" &&
                (!draftTime2025 || Date.now() < draftTime2025)
              }
            >
              {year === "2025"
                ? draftTime2025 && Date.now() >= draftTime2025
                  ? "2025"
                  : "2025 (after draft)"
                : year}
            </option>
          ))}
        </select>
      </div>
      {selectedYear === "2025" && draftTime2025 && Date.now() < draftTime2025 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-center text-slate-500">Draft results will be available after the draft.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        </div>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : !selectedYear ? (
        <p className="text-center italic text-gray-600">Please select a year to view the draft board.</p>
      ) : (
        <div className="overflow-x-auto max-h-[80vh] rounded shadow-md">
          <table className="min-w-[900px] w-full border-separate border-spacing-0 text-sm md:text-base">
            <thead className="bg-white sticky top-0 z-30 shadow-sm">
              <tr>
                {teamOrder.map(teamKey => (
                  <th key={teamKey} className="px-3 py-2 text-center w-28 whitespace-normal break-words font-semibold text-gray-700 border-b border-gray-300" title={teamKeyToName[teamKey]}>
                    {teamKeyToName[teamKey]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map(round => (
                <tr key={round} className="hover:bg-gray-50 transition-colors duration-150">
                  {teamOrder.map((teamKey, colIndex) => {
                    const pick = groupedByRoundAndTeam[round]?.[teamKey];
                    const player = pick ? players[pick.player_key] : null;
                    const positionColorClass = player?.position && positionColors[player.position] ? positionColors[player.position] : "bg-white";
                    const nextPick = pick ? pickMap[pick.pick + 1] : undefined;
                    let arrowDirection: "right" | "down" | "left" | null = null;
                    if (nextPick) {
                      const nextRound = nextPick.round;
                      const nextTeamKey = nextPick.team_key;
                      const nextColIndex = teamOrder.indexOf(nextTeamKey);
                      if (nextRound === round) {
                        if (nextColIndex === colIndex + 1) arrowDirection = "right";
                        else if (nextColIndex === colIndex - 1) arrowDirection = "left";
                      } else if (nextRound === round + 1) {
                        if (nextColIndex === colIndex) arrowDirection = "down";
                        else if (nextColIndex < colIndex) arrowDirection = "left";
                      }
                    }
                    const rotationDegrees = { right: 0, down: 90, left: 180 };
                    return (
                      <td
                        key={teamKey}
                        className={`align-top p-1 rounded-md max-w-[9rem] min-w-[8rem] relative cursor-default ${positionColorClass}`}
                        title={player ? `${player.name} (${player.team} - ${player.position})\nPick ${pick.pick}` : undefined}
                      >
                        {player ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Image src={player.image_url} alt={player.name} width={28} height={28} className="rounded-full object-cover flex-shrink-0" />
                              <div className="flex flex-col flex-shrink min-w-0 text-left">
                                {(() => {
                                  const [firstName, ...rest] = player.name.split(" ");
                                  const lastName = rest.join(" ");
                                  return (
                                    <>
                                      <p className="font-semibold text-gray-800 leading-tight" style={{ fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)", lineHeight: 1.1 }} title={player.name}>{firstName}</p>
                                      <p className="font-semibold text-gray-700 leading-tight" style={{ fontSize: "clamp(0.65rem, 1.3vw, 0.85rem)", lineHeight: 1.1 }}>{lastName}</p>
                                    </>
                                  );
                                })()}
                                <p className="text-xs text-gray-600" style={{ fontSize: "clamp(0.55rem, 1vw, 0.65rem)" }}>{player.team} – {player.position}</p>
                                <p className="text-xs text-gray-500" style={{ fontSize: "clamp(0.5rem, 0.9vw, 0.6rem)" }}>Pick {pick.pick}</p>
                              </div>
                            </div>
                            {arrowDirection && (
                              <div className="absolute bottom-1 right-1" style={{ width: "1rem", height: "1rem", transform: `rotate(${rotationDegrees[arrowDirection]}deg)`, transition: "transform 0.3s ease" }} aria-label={`Next pick: ${nextPick!.pick}`} title={`Next pick: ${nextPick!.pick}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                                  <line x1="3" y1="12" x2="21" y2="12" />
                                  <polyline points="15 6 21 12 15 18" />
                                </svg>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="italic text-gray-400">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Utility functions
function extractTeamManagerMap(teamsData: any) {
  const teams = teamsData?.fantasy_content?.league?.[1]?.teams;
  if (!teams) return {};
  const result: Record<string, string> = {};
  Object.entries(teams).forEach(([key, value]) => {
    if (key === "count") return;
    const teamArray = (value as any).team;
    if (!Array.isArray(teamArray) || !teamArray.length) return;
    const teamInfoArray = teamArray[0];
    const teamKey = teamInfoArray.find((item: any) => "team_key" in item)?.team_key;
    const teamName = teamInfoArray.find((item: any) => "name" in item)?.name;
    const nickname = teamInfoArray.find((item: any) => "managers" in item)?.managers?.[0]?.manager?.nickname;
    if (teamKey) result[teamKey] = teamName || nickname || teamKey;
  });
  return result;
}

function extractDraftPicks(draftData: any) {
  const draftResultsObj = draftData.fantasy_content?.league?.[1]?.draft_results;
  if (!draftResultsObj) return [];
  return Object.values(draftResultsObj)
    .flatMap((entry: any) => {
      const result = entry?.draft_result;
      const arr = Array.isArray(result) ? result : [result];
      return arr
        .filter((pick: any) => pick && pick.pick && pick.player_key)
        .map((pick: any) => ({
          pick: Number(pick.pick),
          round: Number(pick.round),
          player_key: pick.player_key,
          team_key: pick.team_key,
        }));
    });
}

function extractPlayerMap(playersData: any) {
  const playerList = playersData.fantasy_content?.players || {};
  return Object.entries(playerList)
    .filter(([key]) => key !== "count")
    .reduce((map, [, playerEntry]) => {
      const playerArr = (playerEntry as any).player?.[0];
      if (!Array.isArray(playerArr)) return map;
      const playerKey = playerArr.find((item: any) => item.player_key)?.player_key || "";
      const fullName = playerArr.find((item: any) => item.name)?.name?.full || "Unknown Player";
      const team = playerArr.find((item: any) => item.editorial_team_abbr)?.editorial_team_abbr || "FA";
      const position = playerArr.find((item: any) => item.display_position)?.display_position || "";
      const image_url = playerArr.find((item: any) => item.image_url)?.image_url || "/fallback-avatar.png";
      if (playerKey) map[playerKey] = { player_key: playerKey, name: fullName, team, position, image_url };
      return map;
    }, {} as Record<string, any>);
}

function getCachedDraft(year: string) {
  try {
    const cached = localStorage.getItem(`draft_${year}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedDraft(year: string, data: { draftPicks: any[]; players: Record<string, any>; teamManagers: Record<string, string> }) {
  try {
    localStorage.setItem(`draft_${year}`, JSON.stringify(data));
  } catch {}
}