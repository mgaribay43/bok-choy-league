'use client';

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import PlayerViewer from "./PlayerViewer";
import Link from "next/link";
import yahooDefImagesJson from "../data/yahooDefImages.json";

const slotColor = (slot: string) =>
  ({
    QB: "bg-gradient-to-br from-orange-800 to-orange-900",
    RB: "bg-gradient-to-br from-green-800 to-green-900",
    WR: "bg-gradient-to-br from-blue-800 to-blue-900",
    TE: "bg-gradient-to-br from-purple-800 to-purple-900",
    K: "bg-gradient-to-br from-yellow-800 to-yellow-900",
    DEF: "bg-gradient-to-br from-gray-800 to-gray-900",
    "W/R": "bg-gradient-to-br from-pink-800 to-pink-900",
    BN: "bg-gradient-to-br from-slate-800 to-slate-900",
    IR: "bg-gradient-to-br from-red-800 to-red-900",
  }[slot] || "bg-gradient-to-br from-slate-800 to-slate-900");

const yahooDefImages: Record<string, { hash: string; img: string; folder?: string; pxFolder?: string }> = yahooDefImagesJson;

function getPlayerImageUrl(player: any) {
  const fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png";
  if (player.position === "DEF") {
    let rawAbbr = player.team?.toUpperCase() || "FA";
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
    !player.headshotUrl ||
    player.headshotUrl === "/fallback-avatar.png" ||
    player.headshotUrl.includes("dh/ap/default/140828/silhouette@2x.png")
  ) {
    return fallbackUrl;
  }
  const match = player.headshotUrl.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
  if (match) return match[1];
  return player.headshotUrl.replace(/(\.png).*$/, '$1');
}

export default function RosterPage() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const teamId = searchParams.get("teamId");
  const yearNum = Number(year);
  const maxWeek = yearNum >= 2017 && yearNum <= 2020 ? 16 : 17;

  const [week, setWeek] = useState<number | null>(null); // Start as null
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerImg, setManagerImg] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, any>>({});
  const weekSliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // On mount, fetch settings.json to get current week for 2025
    async function fetchCurrentWeek() {
      if (year === "2025") {
        try {
          const res = await fetch(
            `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=2025`
          );
          if (!res.ok) throw new Error("Failed to fetch settings");
          const settingsJson = await res.json();
          // Use matchup_week for the current week
          let matchupWeek = settingsJson?.fantasy_content?.league?.[0]?.matchup_week;
          matchupWeek = Number(matchupWeek);
          if (Number.isFinite(matchupWeek) && matchupWeek >= 1 && matchupWeek <= maxWeek) {
            setWeek(matchupWeek);
          } else {
            setWeek(maxWeek); // fallback
          }
        } catch {
          setWeek(maxWeek); // fallback
        }
      } else {
        setWeek(maxWeek); // fallback for other years
      }
    }
    fetchCurrentWeek();
  }, [year, maxWeek]);

  useEffect(() => {
    if (!year || !teamId || week == null) return;
    const buildScoringMap = (settingsJson: any) => {
      const league = settingsJson?.fantasy_content?.league;
      const settings = league?.[1]?.settings?.[0] || {};
      const modifiers = settings?.stat_modifiers?.stats || [];
      const categories = settings?.stat_categories?.stats || [];
      const map: Record<string, number> = {};
      modifiers.forEach((s: any) => {
        const id = String(s?.stat?.stat_id ?? "");
        const val = parseFloat(s?.stat?.value ?? "0");
        if (id) map[id] = val;
      });
      categories.forEach((s: any) => {
        const id = String(s?.stat?.stat_id ?? "");
        const val = parseFloat(s?.stat?.points ?? "0");
        if (id && !(id in map) && Number.isFinite(val)) map[id] = val;
      });
      return map;
    };
    const calcFanPts = (statsArray: any[], scoringMap: Record<string, number>) =>
      Array.isArray(statsArray)
        ? statsArray.reduce((total, s) => {
            const id = String(s?.stat?.stat_id ?? "");
            const val = parseFloat(s?.stat?.value ?? "0");
            const mult = Number(scoringMap[id] ?? 0);
            return Number.isFinite(val) && Number.isFinite(mult) ? total + val * mult : total;
          }, 0)
        : 0;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const settingsRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=settings&year=${year}`
        );
        if (!settingsRes.ok) throw new Error("Failed to fetch settings");
        const scoringMap = buildScoringMap(await settingsRes.json());

        const rosterRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=roster&year=${year}&teamId=${teamId}&week=${week}`
        );
        if (!rosterRes.ok) throw new Error("Failed to fetch roster");
        const json = await rosterRes.json();
        const team = json.fantasy_content.team[0];
        const roster = json.fantasy_content.team[1].roster;

        setTeamName(team.find((item: any) => item.name)?.name || "");
        setTeamLogo(team.find((item: any) => item.team_logos)?.team_logos[0].team_logo.url || "");
        const managerObj = team.find((item: any) => item.managers)?.managers[0].manager;
        setManagerName(managerObj?.nickname || "");
        setManagerImg(managerObj?.image_url || "");

        const playersObj = roster?.["0"]?.players || {};
        const parsed = Object.values(playersObj)
          .map((obj: any) => {
            const playerData = obj?.player;
            if (!playerData) return null;
            const metaArray = playerData[0];
            const getVal = (prop: string) => metaArray.find((item: any) => item[prop])?.[prop] || "";
            return {
              playerKey: getVal("player_key"),
              id: getVal("player_id"),
              name: getVal("name")?.full || "",
              position: getVal("display_position"),
              team: getVal("editorial_team_abbr"),
              headshotUrl: getVal("headshot")?.url || "",
              selectedPosition: playerData[1]?.selected_position?.find((p: any) => p.position)?.position || "",
            };
          })
          .filter(Boolean);

        if (!parsed.length) {
          setPlayers([]);
          setLoading(false);
          return;
        }

        const playerKeys = parsed.map((p: any) => p.playerKey).join(",");
        const statsRes = await fetch(
          `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstats&year=${year}&week=${week}&playerKeys=${playerKeys}`
        );
        if (!statsRes.ok) throw new Error("Failed to fetch player stats");
        const statsJson = await statsRes.json();
        const statsMap: Record<string, any> = {};
        Object.values(statsJson?.fantasy_content?.players || {}).forEach((playerWrapper: any) => {
          const pArr = playerWrapper?.player;
          if (!pArr) return;
          const metaArray = pArr[0];
          const playerKeyObj = metaArray.find((obj: any) => obj.player_key);
          const pKey = playerKeyObj?.player_key;
          if (!pKey) return;
          const byeObj = metaArray.find((obj: any) => "bye_weeks" in obj);
          const byeWeek = byeObj?.bye_weeks?.week ? Number(byeObj.bye_weeks.week) : null;
          const rawStats = pArr?.[1]?.player_stats?.stats ?? [];
          statsMap[pKey] = { byeWeek, fanPts: calcFanPts(rawStats, scoringMap) };
        });

        setPlayers(parsed.map((p: any) => ({ ...p, stats: statsMap[p.playerKey] || {} })));
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    })();
  }, [year, teamId, week]);

  useEffect(() => {
    async function fetchAllPlayerStats() {
      if (!players?.length) return;
      const playerKeys = players.map(p => p.playerKey).join(",");
      const res = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=playerstatsyear&year=${year}&playerKeys=${playerKeys}`
      );
      const json = await res.json();
      const playersObj = json?.fantasy_content?.league?.[1]?.players || {};
      const statsMap: Record<string, any> = {};

      Object.values(playersObj).forEach((playerWrapper: any) => {
        const playerArr = playerWrapper?.player;
        if (!playerArr) return;
        const playerKeyObj = playerArr[0]?.find((obj: any) => obj.player_key);
        const playerKey = playerKeyObj?.player_key;
        const playerStats = playerArr[1]?.player_stats?.stats_by_week || [];
        if (playerKey) {
          statsMap[playerKey] = playerStats;
        }
      });

      setPlayerStatsMap(statsMap);
    }

    fetchAllPlayerStats();
  }, [players, year]);

  useEffect(() => {
    if (weekSliderRef.current) {
      const latestWeekBtn = weekSliderRef.current.querySelector(`[data-week="${week}"]`);
      if (latestWeekBtn && latestWeekBtn instanceof HTMLElement) {
        const slider = weekSliderRef.current;
        const btnRect = latestWeekBtn.getBoundingClientRect();
        const sliderRect = slider.getBoundingClientRect();
        const scrollLeft = latestWeekBtn.offsetLeft - sliderRect.width / 2 + btnRect.width / 2;
        slider.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [week]);

  useEffect(() => {
    if (!players || players.length === 0) return;
    players.forEach((player) => {
      const img = new window.Image();
      img.src = getPlayerImageUrl(player);
    });
  }, [players]);

  if (!year || !teamId) return <p className="text-center text-red-500 mt-10">Missing year or teamId in URL.</p>;

  const weekOptions = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const starters = players.filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR");
  const bench = players.filter((p) => p.selectedPosition === "BN");
  const ir = players.filter((p) => p.selectedPosition === "IR");

  const RosterSlot = ({
    slot,
    player,
    onPlayerClick,
  }: {
    slot: string;
    player: any;
    onPlayerClick: (p: any) => void;
  }) => (
    <div className="flex items-center gap-3 py-2 px-2 border-b border-[#222] bg-[#181818] hover:bg-[#232323] transition cursor-pointer" onClick={() => onPlayerClick(player)}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-white text-base sm:text-lg shadow ${slotColor(slot)}`}>
        {slot}
      </div>
      <Image
        src={getPlayerImageUrl(player)}
        alt={player.name}
        width={40}
        height={40}
        loading="eager"
        className={`w-10 h-10 rounded-full border-2 border-[#232323] object-cover ${player.position === "DEF" ? "object-contain p-1" : ""}`}
        style={player.position === "DEF" ? { background: "#232323" } : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base sm:text-lg text-white truncate">{player.name}</div>
        <div className="text-xs text-emerald-300 truncate">
          {player.team} - {player.position}
        </div>
        {player.stats?.byeWeek && (
          <div className="text-xs text-slate-400">Bye Week: {player.stats.byeWeek}</div>
        )}
        {player.matchup && (
          <div className="text-xs text-slate-400">{player.matchup}</div>
        )}
      </div>
      <div className="flex flex-col items-end min-w-[48px]">
        <div className="font-bold text-emerald-200 text-base sm:text-lg">
          {player.stats?.fanPts != null ? player.stats.fanPts.toFixed(2) : "-"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#181818] flex flex-col items-center">
      <div className="w-full bg-[#232323] border-b border-[#222]">
        <div className="max-w-5xl mx-auto flex flex-col items-center px-8 py-6">
          <div className="text-xl font-bold text-emerald-400 mb-2">{year}</div>
          <div className="flex items-center gap-4 mb-2">
            {teamLogo && (
              <Image src={teamLogo} alt={`${teamName} Logo`} width={72} height={72} className="w-18 h-18 object-contain rounded-full border-4 border-emerald-900 shadow-xl" />
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-emerald-200 mb-1">{teamName}</h1>
              <div className="flex items-center gap-2">
                {managerImg && (
                  <Image src={managerImg} alt={managerName} width={32} height={32} className="w-8 h-8 rounded-full border-2 border-emerald-700 shadow" />
                )}
                <span className="font-medium text-emerald-400 text-lg">
                  <span className="text-emerald-300">Manager:</span>{" "}
                  <Link
                    href={`/manager?name=${encodeURIComponent(managerName)}`}
                    className="underline text-emerald-200 hover:text-emerald-400 transition"
                  >
                    {managerName}
                  </Link>
                </span>
              </div>
            </div>
          </div>
          <div className="w-full mt-4 flex justify-center">
            <div ref={weekSliderRef} className="flex gap-2 overflow-x-auto no-scrollbar">
              {weekOptions.map((w) => (
                <button
                  key={w}
                  data-week={w}
                  className={`px-4 py-2 rounded-full font-semibold text-sm transition-all whitespace-nowrap ${
                    week === w ? "bg-emerald-600 text-white shadow-lg" : "bg-[#232323] text-emerald-200 hover:bg-emerald-900"
                  }`}
                  onClick={() => setWeek(w)}
                  disabled={week == null}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <main className="w-full max-w-5xl px-2 sm:px-6 py-2 flex flex-col gap-2">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          </div>
        )}
        {error && <p className="text-center text-red-400 text-lg mt-10">{error}</p>}
        {!loading && !error && (
          <>
            <section>
              <h2 className="text-lg font-bold text-emerald-200">Starters</h2>
              <div className="rounded-lg overflow-hidden shadow bg-[#181818]">
                {starters.map((p) => (
                  <RosterSlot key={p.playerKey} slot={p.selectedPosition || p.position} player={p} onPlayerClick={setSelectedPlayer} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-lg font-bold text-emerald-200">Bench</h2>
              <div className="rounded-lg overflow-hidden shadow bg-[#181818]">
                {bench.map((p) => (
                  <RosterSlot key={p.playerKey} slot={p.selectedPosition || p.position} player={p} onPlayerClick={setSelectedPlayer} />
                ))}
              </div>
            </section>
            {ir.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-emerald-200">Injured Reserve</h2>
                <div className="rounded-lg overflow-hidden shadow bg-[#181818]">
                  {ir.map((p) => (
                    <RosterSlot key={p.playerKey} slot={p.selectedPosition || p.position} player={p} onPlayerClick={setSelectedPlayer} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {selectedPlayer && (
        <PlayerViewer player={selectedPlayer} stats={playerStatsMap[selectedPlayer.playerKey]} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
