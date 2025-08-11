'use client';

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface PlayerStats {
  byeWeek?: number | null;
  fanPts?: number | null;
  [key: string]: any;
}

interface Player {
  playerKey: string;
  id: string;
  name: string;
  position: string;
  team: string;
  headshotUrl?: string;
  selectedPosition?: string;
  stats?: PlayerStats;
}

type ScoringMap = Record<string, number>;

export default function RosterPage() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const teamId = searchParams.get("teamId");

  const [week, setWeek] = useState<number>(1);

  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerImg, setManagerImg] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const buildScoringMap = (settingsJson: any): ScoringMap => {
    const league = settingsJson?.fantasy_content?.league;
    const settings = league?.[1]?.settings?.[0] || {};
    const modifiers = settings?.stat_modifiers?.stats || [];
    const categories = settings?.stat_categories?.stats || [];

    const map: ScoringMap = {};

    modifiers.forEach((s: any) => {
      const id = String(s?.stat?.stat_id ?? "");
      const val = parseFloat(s?.stat?.value ?? "0");
      if (id) map[id] = val;
    });

    categories.forEach((s: any) => {
      const id = String(s?.stat?.stat_id ?? "");
      const val = parseFloat(s?.stat?.points ?? "0");
      if (id && !(id in map) && Number.isFinite(val)) {
        map[id] = val;
      }
    });

    return map;
  };

  const calculateFantasyPointsFromStats = (statsArray: any[], scoringMap: ScoringMap): number => {
    if (!Array.isArray(statsArray)) return 0;
    return statsArray.reduce((total, s) => {
      const id = String(s?.stat?.stat_id ?? "");
      const val = parseFloat(s?.stat?.value ?? "0");
      const mult = Number(scoringMap[id] ?? 0);
      if (!Number.isFinite(val) || !Number.isFinite(mult)) return total;
      return total + val * mult;
    }, 0);
  };

  useEffect(() => {
    if (!year || !teamId) return;

    async function fetchRosterAndStats() {
      setLoading(true);
      setError(null);
      try {
        const settingsRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${year}`
        );
        if (!settingsRes.ok) throw new Error("Failed to fetch settings");
        const settingsJson = await settingsRes.json();
        const scoringMap = buildScoringMap(settingsJson);

        const response = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${year}&teamId=${teamId}&week=${week}`
        );
        if (!response.ok) throw new Error("Failed to fetch roster");

        const json = await response.json();
        const team = json.fantasy_content.team[0];
        const roster = json.fantasy_content.team[1].roster;

        setTeamName(team.find((item: any) => item.name)?.name || "");
        setTeamLogo(team.find((item: any) => item.team_logos)?.team_logos[0].team_logo.url || "");

        const managerObj = team.find((item: any) => item.managers)?.managers[0].manager;
        setManagerName(managerObj?.nickname || "");
        setManagerImg(managerObj?.image_url || "");

        const playersObj = roster?.["0"]?.players || {};
        const parsed: Player[] = [];

        Object.keys(playersObj).forEach((key) => {
          const playerData = playersObj[key]?.player;
          if (!playerData) return;

          const metaArray = playerData[0];
          const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";

          parsed.push({
            playerKey: getVal("player_key"),
            id: getVal("player_id"),
            name: getVal("name")?.full || "",
            position: getVal("display_position"),
            team: getVal("editorial_team_abbr"),
            headshotUrl: getVal("headshot")?.url || "",
            selectedPosition:
              playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "",
          });
        });

        if (parsed.length === 0) {
          setPlayers([]);
          return;
        }

        const playerKeys = parsed.map((p) => p.playerKey).join(",");
        const statsResponse = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${year}&week=${week}&playerKeys=${playerKeys}`
        );
        if (!statsResponse.ok) throw new Error("Failed to fetch player stats");
        const statsJson = await statsResponse.json();

        const playersArray = statsJson?.fantasy_content?.players || {};
        const statsMap: Record<string, PlayerStats> = {};

        Object.values(playersArray).forEach((playerWrapper: any) => {
          const pArr = playerWrapper?.player;
          if (!pArr) return;

          const metaArray = pArr[0];
          const playerKeyObj = metaArray.find((obj: any) => obj.player_key);
          const pKey = playerKeyObj?.player_key;
          if (!pKey) return;

          const byeObj = metaArray.find((obj: any) => "bye_weeks" in obj);
          const byeWeek = byeObj?.bye_weeks?.week ? Number(byeObj.bye_weeks.week) : null;

          const rawStats = pArr?.[1]?.player_stats?.stats ?? [];

          const computedFanPts = calculateFantasyPointsFromStats(rawStats, scoringMap);

          statsMap[pKey] = { byeWeek, fanPts: computedFanPts };
        });

        const playersWithStats = parsed.map((p) => ({
          ...p,
          stats: statsMap[p.playerKey] || {},
        }));

        setPlayers(playersWithStats);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchRosterAndStats();
  }, [year, teamId, week]);

  if (!year || !teamId) {
    return <p className="text-center text-red-500 mt-10">Missing year or teamId in URL.</p>;
  }

  const yearNum = Number(year);
  const maxWeek = yearNum >= 2017 && yearNum <= 2020 ? 16 : 17;

  const weekOptions = Array.from({ length: 17 }, (_, i) => i + 1);

  const normalizeSlot = (s?: string) => {
    if (!s) return "";
    const up = s.toUpperCase();
    if (up === "BN") return "BN";
    if (up === "IR") return "IR";
    if (up.includes("QB")) return "QB";
    if (up.includes("WR")) return "WR";
    if (up.includes("RB")) return "RB";
    if (up.includes("TE")) return "TE";
    if (up.includes("W/R") || up.includes("W/R/T") || up.includes("FLEX") || up === "WRT") return "W/R";
    if (up.includes("K")) return "K";
    if (up.includes("DEF") || up.includes("DST")) return "DEF";
    return up;
  };

  const positionOrder = ["QB", "WR", "RB", "TE", "W/R", "K", "DEF", "BN", "IR"];

  const posMap = new Map<string, Player[]>();
  players.forEach((p) => {
    const norm = normalizeSlot(p.selectedPosition || p.position);
    const arr = posMap.get(norm) ?? [];
    arr.push(p);
    posMap.set(norm, arr);
  });

  const orderedPlayers: Player[] = [];
  for (const pos of positionOrder) {
    const list = posMap.get(pos);
    if (list) orderedPlayers.push(...list);
  }
  const includedIds = new Set(orderedPlayers.map((p) => p.playerKey));
  players.forEach((p) => {
    if (!includedIds.has(p.playerKey)) orderedPlayers.push(p);
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Week selector */}
      <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
        <label htmlFor="week-select" className="font-semibold text-slate-800">
          Select Week:
        </label>
        <select
          id="week-select"
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
        >
          {weekOptions.map((w) => (
            <option key={w} value={w} disabled={w === 17 && maxWeek === 16}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-center text-slate-500">Loading roster...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            {teamLogo && (
              <img
                src={teamLogo}
                alt={`${teamName} Logo`}
                className="w-16 h-16 object-contain rounded-full border-4 border-white/20 shadow-lg"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{teamName}</h1>
              <div className="flex items-center gap-2 text-emerald-600">
                {managerImg && (
                  <img
                    src={managerImg}
                    alt={managerName}
                    className="w-6 h-6 rounded-full border-2 border-white/30 shadow-sm"
                  />
                )}
                <span className="font-medium text-sm">Manager: {managerName}</span>
              </div>
            </div>
          </div>

          {/* Roster */}
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Roster</h2>

          {orderedPlayers.length === 0 ? (
            <p className="text-slate-500">No players found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl shadow-xl border border-slate-200/50 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-200">
                  <tr>
                    <th className="p-3 border border-slate-300 text-left font-semibold text-slate-700 w-16">
                      Pos
                    </th>
                    <th className="p-3 border border-slate-300 text-left font-semibold text-slate-700">
                      Roster
                    </th>
                    <th className="p-3 border border-slate-300 text-center font-semibold text-slate-700 w-20">
                      Fan Pts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Active players */}
                  {orderedPlayers
                    .filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR")
                    .map((player) => (
                      <tr key={player.playerKey} className="hover:bg-emerald-50 transition-colors duration-150">
                        <td className="p-3 border border-slate-200 text-center font-bold text-slate-700">
                          {player.selectedPosition}
                        </td>
                        <td className="p-3 border border-slate-200 flex items-center gap-3">
                          {player.headshotUrl ? (
                            <img
                              src={player.headshotUrl}
                              alt={player.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                              <span className="text-slate-600 font-semibold">
                                {player.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-slate-800 truncate max-w-xs">{player.name}</span>
                        </td>
                        <td className="p-3 border border-slate-200 text-center font-bold text-emerald-600">
                          {player.stats?.fanPts != null ? player.stats.fanPts.toFixed(1) : "-"}
                        </td>
                      </tr>
                    ))}

                  {/* Bench players */}
                  {orderedPlayers
                    .filter((p) => p.selectedPosition === "BN")
                    .map((player) => (
                      <tr key={player.playerKey} className="hover:bg-slate-100 transition-colors duration-150">
                        <td className="p-3 border border-slate-200 text-center font-semibold text-slate-500">
                          {player.selectedPosition}
                        </td>
                        <td className="p-3 border border-slate-200 flex items-center gap-3">
                          {player.headshotUrl ? (
                            <img
                              src={player.headshotUrl}
                              alt={player.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                              <span className="text-slate-600 font-semibold">{player.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="font-medium text-slate-700 truncate max-w-xs">{player.name}</span>
                        </td>
                        <td className="p-3 border border-slate-200 text-center text-slate-500">
                          {player.stats?.fanPts != null ? player.stats.fanPts.toFixed(1) : "-"}
                        </td>
                      </tr>
                    ))}

                  {/* IR players */}
                  {orderedPlayers
                    .filter((p) => p.selectedPosition === "IR")
                    .map((player) => (
                      <tr key={player.playerKey} className="hover:bg-slate-100 transition-colors duration-150">
                        <td className="p-3 border border-slate-200 text-center text-slate-500 font-semibold">
                          {player.selectedPosition}
                        </td>
                        <td className="p-3 border border-slate-200 flex items-center gap-3">
                          {player.headshotUrl ? (
                            <img
                              src={player.headshotUrl}
                              alt={player.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                              <span className="text-slate-600 font-semibold">{player.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="font-medium text-slate-700 truncate max-w-xs">{player.name}</span>
                        </td>
                        <td className="p-3 border border-slate-200 text-center text-slate-500">
                          {player.stats?.fanPts != null ? player.stats.fanPts.toFixed(1) : "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
