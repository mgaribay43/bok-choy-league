'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import leagueKeysByYearJson from "../data/League_Keys/league_keys.json";

const positionColors: Record<string, string> = {
  QB: "bg-gradient-to-br from-orange-700 to-orange-900",
  RB: "bg-gradient-to-br from-green-700 to-green-900",
  WR: "bg-gradient-to-br from-blue-700 to-blue-900",
  TE: "bg-gradient-to-br from-purple-700 to-purple-900",
  K: "bg-gradient-to-br from-yellow-700 to-yellow-900",
  DEF: "bg-gradient-to-br from-gray-700 to-gray-900",
};

// Map team abbreviations to Yahoo defense image hashes and image paths
const yahooDefImages: Record<string, { hash: string; img: string; folder?: string; pxFolder?: string }> = {
  DEN: { hash: "2ryPkHnKLeN6pwLpCNLIzw--", img: "2019_DEN.png" },
  PHI: { hash: "sHdqDnOKm.VqhUcJbkQV0w--", img: "2019_PHI.png" },
  MIN: { hash: "a3fAhhYYFltgzqJ5xDDUaQ--", img: "2019_MIN.png" },
  KC: { hash: "zw8PWS4vfpxgMVqp1v1eYw--", img: "2019_KC.png" },
  DET: { hash: "X_djfvvxv1QajPN7MyNkkA--", img: "2019_DET.png" },
  LAC: { hash: "SD0F5LgxJ8K9uyPRNViKEA--", img: "chargers.png", folder: "20200508" },
  HOU: { hash: ".ATgePlNDvMZQcZ1ZFVlOg--", img: "2019_HOU.png" },
  BUF: { hash: "4AM2K40.PxCYdXcjee18Jg--", img: "2019_BUF.png" },
  NYJ: { hash: "dtEwQvkZ5sLY30lGabPhkA--~C", img: "Jets.png", folder: "20240610", pxFolder: "500px" },
  SEA: { hash: "LzAnPXULOD65CNY8w.NM.A--", img: "2019_SEA.png" },
  LAR: { hash: "VJs6Ghs66W811UkkDd90OA--", img: "rams.png", folder: "20200323" },
  CLE: { hash: "T4mvF8UQVaXOxTDw2.Uz1Q--", img: "2019_CLE.png" },
  GB: { hash: "2MMBKgdqastSfmxSSWLLfg--", img: "2019_GB.png" },
  DAL: { hash: "Ip32wf6PnIkm9U05Ap73.A--", img: "2019_DAL.png" },
  NE: { hash: "YYUnurcCTjQMbkvgRkiqdg--", img: "2019_NE.png" },
  SF: { hash: "WtaL3IcCDTpU6Scpaz9p4A--", img: "2019_SF.png" },
  TB: { hash: "2zXlLUp.mFnpy2rcwCwa.Q--", img: "buccaneers.png", folder: "20200508" },
  CHI: { hash: "X_NszvC1JzHbQQSCwAydGw--~C", img: "bears_new.png", folder: "20230905", pxFolder: "500px" },
  MIA: { hash: "hVO5JWGw_LUVjO8XOZO1nA--", img: "2019_MIA.png" },
  WSH: { hash: "nJpfIFmBhh6CiJPTSCDRcQ--", img: "washington.png", folder: "20220202" },
  CIN: { hash: "0vqhunH68VeIojFhZGhOFg--", img: "2019_CIN.png" },
  NO: { hash: "p1Xthb1b70rMVPYADzbc3Q--", img: "2019_NO.png" },
  IND: { hash: "1qH8FeRuMdO9r7JfL5fA0g--", img: "2019_IND.png" },
  PIT: { hash: "rh_v5LuGevS5sHMS_.OxKw--", img: "2019_PIT.png" },
  ARI: { hash: "flzok_70._33ZWZkdlghUA--", img: "ari.png", folder: "20230503" },
  ATL: { hash: "vWPPZRKii.sPlRox48SNfA--", img: "2019_ATL.png" },
  BAL: { hash: "tYcK6qUrDTAyQ1luc5u_bg--", img: "2019_BAL.png" },
  CAR: { hash: "BOZYXBAlx4uxlnfjGc7SkQ--", img: "2019_CAR.png" },
  JAX: { hash: "Ub6qKzgdAA1vq_u9vSgRoA--", img: "2019_JAX.png" },
  LV: { hash: "zBNWLq5MM9vDEvd9fY.pdQ--", img: "raiders.png", folder: "20200908" },
  NYG: { hash: "TuBVnXSCrgeyV8jqNIyeIQ--", img: "2019_NYG.png" },
  TEN: { hash: "nHwnFC87xWH3nZPQSa2VRw--", img: "2019_TEN.png" },
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
    <div className="w-full overflow-x-auto px-2 py-0 bg-[#0f0f0f] min-h-screen">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-emerald-200">Draft Board</h1>
      <div className="mb-6 flex justify-center gap-4 flex-wrap">
        <label htmlFor="year-select" className="font-semibold self-center text-emerald-100">Select Year:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="border border-[#333] rounded px-3 py-2 bg-[#232323] text-emerald-100"
        >
          <option value="" className="bg-[#232323] text-emerald-100">Select Year</option>
          {Object.keys(leagueKeysByYear).sort((a, b) => Number(b) - Number(a)).map(year => (
            <option
              key={year}
              value={year}
              disabled={
                year === "2025" &&
                (!draftTime2025 || Date.now() < draftTime2025)
              }
              className="bg-[#232323] text-emerald-100"
            >
              {year === "2025"
                ? draftTime2025 && Date.now() >= draftTime2025
                  ? "2025"
                  : "2025 (available after draft)"
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
          <p className="mt-4 text-center text-emerald-400">Draft results will be available after the draft.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        </div>
      ) : error ? (
        <p className="text-center text-red-400">{error}</p>
      ) : !selectedYear ? (
        <p className="text-center italic text-emerald-400">Please select a year to view the draft board.</p>
      ) : (
        <div className="overflow-x-auto max-h-[80vh] rounded shadow-md bg-[#232323]">
          <table className="min-w-[900px] w-full border-separate border-spacing-0 text-sm md:text-base">
            <thead className="bg-[#232323] sticky top-0 z-30 shadow-sm">
              <tr>
                {teamOrder.map(teamKey => (
                  <th key={teamKey} className="px-3 py-2 text-center w-28 whitespace-normal break-words font-semibold text-emerald-200 border-b border-[#333]" title={teamKeyToName[teamKey]}>
                    {teamKeyToName[teamKey]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map(round => (
                <tr key={round} className="hover:bg-[#222] transition-colors duration-150">
                  {teamOrder.map((teamKey, colIndex) => {
                    const pick = groupedByRoundAndTeam[round]?.[teamKey];
                    const player = pick ? players[pick.player_key] : null;
                    const positionColorClass = player?.position && positionColors[player.position] ? positionColors[player.position] : "bg-[#232323]";
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
                        className={`align-top p-1 rounded-md max-w-[9rem] min-w-[8rem] relative cursor-default ${positionColorClass} border border-[#222]`}
                        title={player ? `${player.name} (${player.team} - ${player.position})\nPick ${pick.pick}` : undefined}
                      >
                        {player ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Image
                                src={
                                  (() => {
                                    const fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png";
                                    if (player.position === "DEF") {
                                      let rawAbbr = player.team?.toUpperCase() || "FA";
                                      if (rawAbbr === "WAS") rawAbbr = "WSH";
                                      const defInfo = yahooDefImages[rawAbbr];
                                      if (defInfo) {
                                        // Special case for teams with pxFolder (Jets, Bears, etc.)
                                        if (defInfo.pxFolder) {
                                          return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/${defInfo.folder}/${defInfo.pxFolder}/${defInfo.img}`;
                                        }
                                        // Use folder from mapping if present, else default to 20190724
                                        const folder = defInfo.folder || "20190724";
                                        return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/nfl/${folder}/500x500/${defInfo.img}`;
                                      }
                                      return fallbackUrl;
                                    }
                                    if (
                                      !player.image_url ||
                                      player.image_url === "/fallback-avatar.png" ||
                                      player.image_url.includes("dh/ap/default/140828/silhouette@2x.png")
                                    ) {
                                      return fallbackUrl;
                                    }
                                    const match = player.image_url.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
                                    if (match) return match[1];
                                    return player.image_url.replace(/(\.png).*$/, '$1');
                                  })()
                                }
                                alt={player.name}
                                width={60}
                                height={60}
                                className="rounded-full object-cover flex-shrink-0"
                              />
                              <div className="flex flex-col flex-shrink min-w-0 text-left">
                                {(() => {
                                  const [firstName, ...rest] = player.name.split(" ");
                                  const lastName = rest.join(" ");
                                  return (
                                    <>
                                      <p className="font-semibold text-emerald-100 leading-tight" style={{ fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)", lineHeight: 1.1 }} title={player.name}>{firstName}</p>
                                      <p className="font-semibold text-emerald-200 leading-tight" style={{ fontSize: "clamp(0.65rem, 1.3vw, 0.85rem)", lineHeight: 1.1 }}>{lastName}</p>
                                    </>
                                  );
                                })()}
                                <p className="text-xs text-emerald-400" style={{ fontSize: "clamp(0.55rem, 1vw, 0.65rem)" }}>{player.team} – {player.position}</p>
                                <p className="text-xs text-emerald-400" style={{ fontSize: "clamp(0.5rem, 0.9vw, 0.6rem)" }}>Pick {pick.pick}</p>
                              </div>
                            </div>
                            {arrowDirection && (
                              <div className="absolute bottom-1 right-1" style={{ width: "1rem", height: "1rem", transform: `rotate(${rotationDegrees[arrowDirection]}deg)`, transition: "transform 0.3s ease" }} aria-label={`Next pick: ${nextPick!.pick}`} title={`Next pick: ${nextPick!.pick}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                                  <line x1="3" y1="12" x2="21" y2="12" />
                                  <polyline points="15 6 21 12 15 18" />
                                </svg>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="italic text-emerald-700">—</span>
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