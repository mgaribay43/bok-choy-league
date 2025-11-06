'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import yahooDefImagesJson from "../data/yahooDefImages.json";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import { getCurrentSeason } from "./globalUtils/getCurrentSeason";
import { isPostdraft } from "./globalUtils/getDraftStatus";
const PlayerViewer = dynamic(() => import("./PlayerViewer"), { ssr: false });

type KeeperYearData = { Teams: { TeamID: string; keeper: string; }[] };
type KeepersType = { [year: string]: KeeperYearData };

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
  byeWeek?: string;
}

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  players: Player[];
}

const yahooDefImages: Record<string, { hash: string; img: string; folder?: string; pxFolder?: string }> = yahooDefImagesJson;

export default function KeepersPage() {
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(""); // start empty to avoid flash
  const [yearsLoading, setYearsLoading] = useState(true);       // NEW
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [keepers, setKeepers] = useState<KeepersType>({});

  interface ModalPlayer extends Player {
    season: string;
    headshotUrl: string;
    team: string;
    stats?: { fanPts: number };
  }
  const [modalPlayer, setModalPlayer] = useState<ModalPlayer | null>(null);
  const [modalStats, setModalStats] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch keepers from Firestore
  useEffect(() => {
    const fetchKeepersFromFirestore = async () => {
      try {
        const db = getFirestore();
        const querySnapshot = await getDocs(collection(db, "Keepers"));
        const keepersData: KeepersType = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          keepersData[doc.id] = {
            Teams: Array.isArray(data.Teams) ? data.Teams : [],
          };
        });
        setKeepers(keepersData);
      } catch (err) {
        setError("Failed to load keepers from Firestore.");
      }
    };
    fetchKeepersFromFirestore();
  }, []);

  // Build the season list using current season + draft status (show next season if postdraft)
  useEffect(() => {
    async function buildYears() {
      setYearsLoading(true);
      try {
        const currentSeasonStr = await getCurrentSeason();
        const currentSeason = Number(currentSeasonStr) || new Date().getFullYear();
        const currentIsPostdraft = await isPostdraft(currentSeasonStr);
        const latest = currentIsPostdraft ? currentSeason + 1 : currentSeason;

        const start = 2024;
        const years: string[] = [];
        for (let y = latest; y >= start; y--) years.push(String(y));

        setAvailableYears(years);
        if (years.length) setSelectedYear(years[0]); // first visible season
      } catch {
        const fallbackCurrent = new Date().getFullYear();
        const years: string[] = [];
        for (let y = fallbackCurrent; y >= 2024; y--) years.push(String(y));
        setAvailableYears(years);
        if (years.length) setSelectedYear(years[0]);
      } finally {
        setYearsLoading(false);
      }
    }
    buildYears();
  }, []);

  // Fetch keepers only after selectedYear is known
  useEffect(() => {
    if (!selectedYear) return; // guard against initial render
    const fetchKeepers = async () => {
      setLoading(true);
      setError(null);

      try {
        const year = Number(selectedYear) - 1;
        const draftRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=draftresults&year=${year}`
        );
        const draftText = await draftRes.text();
        const draftData = JSON.parse(draftText.replace(/^callback\((.*)\)$/, "$1"));

        const draftPicks = extractDraftPicks(draftData);

        const rosterPromises = [];
        for (let teamNum = 1; teamNum <= 10; teamNum++) {
          const url = `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${year}&teamId=${teamNum}`;
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
  }, [selectedYear]);

  // Map team IDs to keeper names for the selected year
  const keeperMap: Record<string, string> = {};
  const keeperTeams = keepers[selectedYear]?.Teams ?? [];
  keeperTeams.forEach((team: { TeamID: string; keeper: string }) => {
    if (team.keeper) keeperMap[team.TeamID] = team.keeper;
  });

  // Build sets of keepers for the previous two seasons (any manager)
  const prevYear = selectedYear ? String(Number(selectedYear) - 1) : "";
  const prevPrevYear = selectedYear ? String(Number(selectedYear) - 2) : "";
  const prevKeeperSet = new Set<string>();
  const prevPrevKeeperSet = new Set<string>();
  (keepers[prevYear]?.Teams ?? []).forEach((t: { TeamID: string; keeper: string }) => {
    if (t.keeper) prevKeeperSet.add(t.keeper);
  });
  (keepers[prevPrevYear]?.Teams ?? []).forEach((t: { TeamID: string; keeper: string }) => {
    if (t.keeper) prevPrevKeeperSet.add(t.keeper);
  });

  const visibleTeams = selectedTeamId
    ? teams.filter((team) => team.id === selectedTeamId)
    : teams;

  const handlePlayerClick = async (player: Player, teamAbbr: string) => {
    setModalLoading(true);
    const byeWeek =
      (player as any).byeWeek ??
      (player as any).bye_weeks ??
      (player as any).stats?.byeWeek ??
      (player as any).stats?.bye_weeks?.week ??
      null;

    setModalPlayer({
      ...player,
      season: String(Number(selectedYear) - 1),
      headshotUrl: player.image_url,
      team: teamAbbr,
      byeWeek,
    });
    try {
      const year = String(Number(selectedYear) - 1);
      // Fetch league key from Firestore
      const db = getFirestore();
      const leagueKeysDoc = await getDoc(doc(db, "League_Keys", "leagueKeysByYear"));
      const leagueKeysData = leagueKeysDoc.exists() ? leagueKeysDoc.data() : {};
      const leagueKeyFull = leagueKeysData[year];

      if (!leagueKeyFull) throw new Error("League key not found for year " + year);

      // Only use the first 3 digits of the league key
      const leaguePrefix = leagueKeyFull.split(".")[0];
      const playerKey = `${leaguePrefix}.p.${player.player_id}`;

      // Fetch stats for each week (1-17)
      const weekPromises = [];
      for (let week = 1; week <= 17; week++) {
        weekPromises.push(
          fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${year}&playerKeys=${playerKey}&week=${week}`
          )
            .then((res) => res.json())
            .then((statsJson) => {
              const playersObj = statsJson?.fantasy_content?.league?.[1]?.players || {};
              let weekStats: any = null;
              Object.values(playersObj).forEach((p: any) => {
                const stats = p?.player?.[1]?.player_stats?.stats;
                if (Array.isArray(stats)) {
                  weekStats = { week, stats };
                }
              });
              return weekStats;
            })
        );
      }

      const weeks = (await Promise.all(weekPromises)).filter(Boolean);

      // Fetch stat modifiers from league settings
      let seasonFanPoints = 0;
      try {
        const settingsRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${year}`
        );
        const settingsJson = await settingsRes.json();
        const modifiers = settingsJson?.fantasy_content?.league?.[1]?.settings?.[0]?.stat_modifiers?.stats || [];
        const scoringMap: Record<string, number> = {};
        modifiers.forEach((mod: any) => {
          const id = mod?.stat?.stat_id;
          const value = parseFloat(mod?.stat?.value ?? "0");
          if (id) scoringMap[id] = value;
        });

        // Calculate total fan points
        for (const week of weeks) {
          if (Array.isArray(week?.stats)) {
            seasonFanPoints += week.stats.reduce((total: number, s: any) => {
              const id = String(s?.stat?.stat_id ?? "");
              const val = parseFloat(s?.stat?.value ?? "0");
              const mult = Number(scoringMap[id] ?? 0);
              return Number.isFinite(val) && Number.isFinite(mult) ? total + val * mult : total;
            }, 0);
          }
        }
      } catch {
        seasonFanPoints = 0;
      }

      setModalStats(weeks);
      const byeWeekFinal =
        (player as any).byeWeek ??
        (player as any).bye_weeks ??
        (player as any).stats?.byeWeek ??
        (player as any).stats?.bye_weeks?.week ??
        null;
      setModalPlayer({
        ...player,
        season: String(Number(selectedYear) - 1),
        headshotUrl: player.image_url,
        team: teamAbbr,
        stats: { fanPts: seasonFanPoints }, // <-- pass to PlayerViewer
        byeWeek: byeWeekFinal,
      });
    } catch {
      setModalStats([]);
    }
    setModalLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 bg-[#0f0f0f] min-h-screen">
      {/* Year Selector */}
      {!yearsLoading && (
        <div className="flex justify-center mb-4 relative">
          <div
            className="inline-block relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button
              className="text-2xl sm:text-4xl font-extrabold text-emerald-200 text-center mb-4 px-3 sm:px-4 py-2 bg-[#232323] border border-[#333] rounded-lg focus:outline-none flex items-center gap-2"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((open) => !open)}
            >
              {selectedYear} Keepers
              <svg
                className={`w-5 h-5 sm:w-7 sm:h-7 text-emerald-200 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <ul
              className={`absolute left-1/2 -translate-x-1/2 mt-0 w-32 bg-[#232323] border border-[#333] rounded-lg shadow-lg z-10 transition-all duration-200
                ${dropdownOpen ? "block" : "hidden"}`}
              style={{ top: "100%" }}
              role="listbox"
            >
              {availableYears.map((year) => (
                <li
                  key={year}
                  className={`px-4 py-2 cursor-pointer hover:bg-emerald-900 text-center first:rounded-t-lg last:rounded-b-lg ${year === selectedYear ? "font-bold text-emerald-200 bg-[#0f0f0f]" : "text-emerald-100"}`}
                  onClick={() => {
                    setSelectedYear(year);
                    setSelectedTeamId(null);
                    setDropdownOpen(false); // close dropdown
                  }}
                  role="option"
                  aria-selected={year === selectedYear}
                >
                  {year}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="mb-6 sm:mb-8 text-center text-sm sm:text-base px-2 text-emerald-300">
        Use this tool to help determine the player you wish to keep next season
      </p>

      {/* Team Selector - Better mobile styling */}
      {teams.length > 0 && (
        <div className="flex justify-center mb-6 px-2">
          <select
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value || null)}
            className="border border-[#333] rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base shadow-sm w-full max-w-xs bg-[#232323] text-emerald-100"
          >
            <option value="" className="bg-[#232323] text-emerald-100">Show All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id} className="bg-[#232323] text-emerald-100">
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Key Legend - Mobile optimized grid */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium mb-6 sm:mb-8 px-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 sm:w-6 sm:h-6 border border-[#333] rounded bg-[#232323] flex-shrink-0" />
          <span className="leading-tight text-emerald-100">Undrafted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-emerald-900 border border-emerald-700 flex-shrink-0" />
          <span className="leading-tight text-emerald-100">Keeper Eligible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-red-900 border border-red-700 flex-shrink-0" />
          <span className="leading-tight text-emerald-100">Keeper Ineligible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-yellow-700 border border-yellow-600 flex-shrink-0" />
          <span className="leading-tight text-emerald-100">Selected Keeper</span>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20">
          <div className="relative">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        </div>
      ) : error ? (
        <p className="text-red-400 text-center text-sm sm:text-base px-2">Error: {error}</p>
      ) : visibleTeams.length === 0 ? (
        <p className="text-center italic text-emerald-400 text-sm sm:text-base px-2">No teams found.</p>
      ) : (
        visibleTeams.length === 1 ? (
          <div className="flex justify-center">
            {visibleTeams.map((team) => {
              const teamId = team.id.split(".").pop() ?? team.id;
              const keeperName = keeperMap[teamId];

              return (
                <div
                  key={team.id}
                  className="flex flex-col w-full max-w-xl border border-[#333] rounded-lg sm:rounded-md shadow bg-[#232323] p-4 sm:p-6"
                >
                  {/* Team Header - Mobile optimized */}
                  <div className="flex flex-col items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
                    {team.logo_url && (
                      <Image
                        src={team.logo_url}
                        alt={`${team.name} logo`}
                        width={60}
                        height={60}
                        className="sm:w-20 sm:h-20 rounded-md"
                      />
                    )}
                    <h2 className="text-xl sm:text-2xl font-semibold text-center px-2 text-emerald-200">{team.name}</h2>
                  </div>

                  {/* Players List - Single column on mobile, responsive grid */}
                  <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {team.players.map((player) => {
                      // Is this player the keeper? Also detect if they were kept the previous two seasons (any manager)
                      const isKeeper = keeperName && player.name === keeperName;
                      const keptPreviousTwoSeasons = prevKeeperSet.has(player.name) && prevPrevKeeperSet.has(player.name);
                      return (
                        <li
                          key={`${team.id}-${player.player_id || player.name}`}
                          className={`flex items-center gap-3 border rounded-lg p-3 shadow-sm min-w-0
                            ${keptPreviousTwoSeasons
                              ? "bg-red-900 border-red-700" // force ineligible style if kept in both prior seasons
                              : isKeeper
                                ? "bg-yellow-700 border-yellow-600"
                                : player.draftPick
                                  ? player.draftPick.round >= 2
                                    ? "bg-emerald-900 border-emerald-700"
                                    : "bg-red-900 border-red-700"
                                  : "bg-[#232323] border-[#333]"
                            }`}
                        >
                          {/* Player Image - Smaller on mobile */}
                          <Image
                            src={
                              (() => {
                                const fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png";
                                if (player.position === "DEF") {
                                  let rawAbbr = player.team_abbr?.toUpperCase() || "FA";
                                  if (rawAbbr === "WAS") rawAbbr = "WSH";
                                  const defInfo = yahooDefImages[rawAbbr];
                                  if (defInfo) {
                                    if (defInfo.pxFolder) {
                                      return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/${defInfo.folder}/${defInfo.pxFolder}/${defInfo.img}`;
                                    }
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
                                const match = typeof player.image_url === "string" && player.image_url.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
                                if (match) return match[1];
                                return player.image_url.replace(/(\.png).*$/, '$1');
                              })()
                            }
                            alt={player.name}
                            width={64}
                            height={64}
                            className={`w-16 h-16 sm:w-16 sm:h-16 flex-shrink-0 ${player.position === "DEF" ? "" : "object-cover"}`}
                            style={player.position === "DEF"
                              ? { objectFit: "contain" }
                              : undefined
                            }
                            unoptimized={false}
                          />

                          {/* Player Info - Better mobile text sizing */}
                          <div className="min-w-0 flex-1">
                            <button
                              className="font-semibold text-sm sm:text-base truncate text-emerald-100 underline hover:text-emerald-300"
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                              onClick={() => handlePlayerClick(player, player.team_abbr)}
                              type="button"
                            >
                              {player.name}
                            </button>
                            <p className="text-xs sm:text-sm text-emerald-400 truncate">
                              {player.position} – {player.team_abbr}
                            </p>
                            {player.draftPick ? (
                              <p className="text-xs sm:text-sm text-emerald-300">
                                <span className="sm:hidden">R{player.draftPick.round}, P{player.draftPick.pick}</span>
                                <span className="hidden sm:inline">Round {player.draftPick.round}, Pick {player.draftPick.pick}</span>
                              </p>
                            ) : (
                              <p className="text-xs sm:text-sm text-emerald-700 italic">Undrafted</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 w-full items-stretch">
            {visibleTeams.map((team) => {
              const teamId = team.id.split(".").pop() ?? team.id;
              const keeperName = keeperMap[teamId];

              return (
                <div
                  key={team.id}
                  className="flex flex-col w-full h-full border border-[#333] rounded-lg sm:rounded-md shadow bg-[#232323] p-4 sm:p-6"
                >
                  {/* Team Header - Mobile optimized */}
                  <div className="flex flex-col items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
                    {team.logo_url && (
                      <Image
                        src={team.logo_url}
                        alt={`${team.name} logo`}
                        width={60}
                        height={60}
                        className="sm:w-20 sm:h-20 rounded-md"
                      />
                    )}
                    <h2 className="text-xl sm:text-2xl font-semibold text-center px-2 text-emerald-200">{team.name}</h2>
                  </div>

                  {/* Players List - Single column on mobile, responsive grid */}
                  <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {team.players.map((player) => {
                      // Is this player the keeper? Also detect if they were kept the previous two seasons (any manager)
                      const isKeeper = keeperName && player.name === keeperName;
                      const keptPreviousTwoSeasons = prevKeeperSet.has(player.name) && prevPrevKeeperSet.has(player.name);
                      return (
                        <li
                          key={`${team.id}-${player.player_id || player.name}`}
                          className={`flex items-center gap-3 border rounded-lg p-3 shadow-sm min-w-0
                            ${keptPreviousTwoSeasons
                              ? "bg-red-900 border-red-700" // force ineligible style if kept in both prior seasons
                              : isKeeper
                                ? "bg-yellow-700 border-yellow-600"
                                : player.draftPick
                                  ? player.draftPick.round >= 2
                                    ? "bg-emerald-900 border-emerald-700"
                                    : "bg-red-900 border-red-700"
                                  : "bg-[#232323] border-[#333]"
                            }`}
                        >
                          {/* Player Image - Smaller on mobile */}
                          <Image
                            src={
                              (() => {
                                const fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png";
                                if (player.position === "DEF") {
                                  let rawAbbr = player.team_abbr?.toUpperCase() || "FA";
                                  if (rawAbbr === "WAS") rawAbbr = "WSH";
                                  const defInfo = yahooDefImages[rawAbbr];
                                  if (defInfo) {
                                    if (defInfo.pxFolder) {
                                      return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/${defInfo.folder}/${defInfo.pxFolder}/${defInfo.img}`;
                                    }
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
                                const match = typeof player.image_url === "string" && player.image_url.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
                                if (match) return match[1];
                                return player.image_url.replace(/(\.png).*$/, '$1');
                              })()
                            }
                            alt={player.name}
                            width={64}
                            height={64}
                            className={`w-16 h-16 sm:w-16 sm:h-16 flex-shrink-0 ${player.position === "DEF" ? "" : "object-cover"}`}
                            style={player.position === "DEF"
                              ? { objectFit: "contain" }
                              : undefined
                            }
                            unoptimized={false}
                          />

                          {/* Player Info - Better mobile text sizing */}
                          <div className="min-w-0 flex-1">
                            <button
                              className="font-semibold text-sm sm:text-base truncate text-emerald-100 underline hover:text-emerald-300"
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                              onClick={() => handlePlayerClick(player, player.team_abbr)}
                              type="button"
                            >
                              {player.name}
                            </button>
                            <p className="text-xs sm:text-sm text-emerald-400 truncate">
                              {player.position} – {player.team_abbr}
                            </p>
                            {player.draftPick ? (
                              <p className="text-xs sm:text-sm text-emerald-300">
                                <span className="sm:hidden">R{player.draftPick.round}, P{player.draftPick.pick}</span>
                                <span className="hidden sm:inline">Round {player.draftPick.round}, Pick {player.draftPick.pick}</span>
                              </p>
                            ) : (
                              <p className="text-xs sm:text-sm text-emerald-700 italic">Undrafted</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal rendering at the end of your component */}
      {modalPlayer && (
        <PlayerViewer
          player={modalPlayer}
          onClose={() => setModalPlayer(null)}
          stats={modalStats}
        />
      )}

      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
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
    // Extract bye week from the player base object when present
    const byeObj = base.find((obj: any) => obj && obj.bye_weeks);
    const byeValue = byeObj && byeObj.bye_weeks && byeObj.bye_weeks.week
      ? String(byeObj.bye_weeks.week)
      : undefined;

    const fullPlayerKey = `${leaguePrefix}.p.${playerId}`;
    const draftPick = draftPicks.find((pick) => pick.player_key === fullPlayerKey);

    players.push({
      player_id: playerId,
      name,
      position,
      team_abbr: teamAbbr,
      image_url: imageUrl,
      byeWeek: byeValue,
      draftPick: draftPick
        ? { pick: draftPick.pick, round: draftPick.round }
        : undefined,
    });
  }

  return [{ id: teamKey, name: teamName, logo_url: logoUrl, players }];
}
