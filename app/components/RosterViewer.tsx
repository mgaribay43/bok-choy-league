'use client';

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import PlayerViewer from "./PlayerViewer";
import Link from "next/link";

const slotColor = (slot: string) =>
  ({
    QB: "bg-gradient-to-br from-orange-300 to-orange-500",
    RB: "bg-gradient-to-br from-green-300 to-green-500",
    WR: "bg-gradient-to-br from-blue-300 to-blue-500",
    TE: "bg-gradient-to-br from-purple-300 to-purple-500",
    K: "bg-gradient-to-br from-yellow-200 to-yellow-400",
    DEF: "bg-gradient-to-br from-gray-300 to-gray-500",
    "W/R": "bg-gradient-to-br from-pink-200 to-pink-400",
    BN: "bg-gradient-to-br from-slate-200 to-slate-400",
    IR: "bg-gradient-to-br from-red-200 to-red-400",
  }[slot] || "bg-gradient-to-br from-slate-100 to-slate-300");

type CollapsibleSectionProps = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function CollapsibleSection({ title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`mb-0`}>
      <button
        className="flex items-center gap-2 mb-2 w-full text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <h2 className="text-2xl font-bold text-emerald-800">{title}</h2>
        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold text-sm">{count}</span>
        <span className="ml-auto text-emerald-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && children}
    </section>
  );
}

export default function RosterPage() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const teamId = searchParams.get("teamId");
  const yearNum = Number(year);
  const maxWeek = yearNum >= 2017 && yearNum <= 2020 ? 16 : 17;
  const [week, setWeek] = useState(maxWeek);
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
    if (!year || !teamId) return;
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

  if (!year || !teamId) return <p className="text-center text-red-500 mt-10">Missing year or teamId in URL.</p>;

  const weekOptions = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const starters = players.filter((p) => p.selectedPosition !== "BN" && p.selectedPosition !== "IR");
  const bench = players.filter((p) => p.selectedPosition === "BN");
  const ir = players.filter((p) => p.selectedPosition === "IR");

  // Update PlayerGrid to accept onPlayerClick
  const PlayerGrid = ({ players, onPlayerClick }: { players: any[]; onPlayerClick: (p: any) => void }) => (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-10">
      {players.map((p) => (
        <div
          key={p.playerKey}
          className="relative rounded-2xl shadow-xl border border-slate-200 bg-white/80 backdrop-blur-lg p-2 sm:p-5 flex flex-col items-center transition-transform hover:-translate-y-1 hover:shadow-emerald-300 cursor-pointer"
          onClick={() => onPlayerClick(p)}
        >
          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 sm:px-4 sm:py-1 rounded-full text-xs sm:text-sm text-white font-bold shadow-lg ${slotColor(p.selectedPosition || p.position)}`}>
            {p.selectedPosition || p.position}
          </div>
          {p.headshotUrl ? (
            <Image src={p.headshotUrl} alt={p.name} width={48} height={48} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full object-cover border-2 sm:border-4 border-emerald-100 shadow" />
          ) : (
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xl sm:text-3xl font-bold text-slate-600 border-2 sm:border-4 border-emerald-100 shadow">
              {p.name.charAt(0)}
            </div>
          )}
          <div className="mt-2 sm:mt-3 text-base sm:text-lg font-semibold text-slate-800 text-center truncate w-full">{p.name}</div>
          <div className="text-xs sm:text-sm text-slate-500 mb-1 sm:mb-2">{p.team} &middot; {p.position}</div>
          <div className="mt-1 sm:mt-2 flex items-center gap-1 sm:gap-2">
            <span className="text-emerald-600 font-bold text-base sm:text-xl">{p.stats?.fanPts != null ? p.stats.fanPts.toFixed(1) : "-"}</span>
            <span className="text-xs text-slate-400">pts</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-100 flex flex-col items-center">
      <div className="w-full bg-white/80 border-b border-emerald-100">
        <div className="max-w-5xl mx-auto flex flex-col items-center px-8 py-6">
          <div className="flex items-center gap-4 mb-2">
            {teamLogo && (
              <Image src={teamLogo} alt={`${teamName} Logo`} width={72} height={72} className="w-18 h-18 object-contain rounded-full border-4 border-emerald-200 shadow-xl" />
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-emerald-700 mb-1">{teamName}</h1>
              <div className="flex items-center gap-2">
                {managerImg && (
                  <Image src={managerImg} alt={managerName} width={32} height={32} className="w-8 h-8 rounded-full border-2 border-emerald-300 shadow" />
                )}
                <span className="font-medium text-slate-700 text-lg">
                  <span className="text-emerald-600">Manager:</span>{" "}
                  <Link
                    href={`/manager?name=${encodeURIComponent(managerName)}`}
                    className="underline text-emerald-700 hover:text-emerald-900 transition"
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
                    week === w ? "bg-emerald-500 text-white shadow-lg" : "bg-white/80 text-emerald-700 hover:bg-emerald-100"
                  }`}
                  onClick={() => setWeek(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <main className="w-full max-w-5xl px-2 sm:px-6 py-10 flex flex-col gap-12">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          </div>
        )}
        {error && <p className="text-center text-red-500 text-lg mt-10">{error}</p>}
        {!loading && !error && (
          <>
            <CollapsibleSection title="Starters" count={starters.length} defaultOpen={true}>
              <PlayerGrid players={starters} onPlayerClick={setSelectedPlayer} />
            </CollapsibleSection>
            <CollapsibleSection title="Bench" count={bench.length} defaultOpen={false}>
              <PlayerGrid players={bench} onPlayerClick={setSelectedPlayer} />
            </CollapsibleSection>
            {ir.length > 0 && (
              <CollapsibleSection title="Injured Reserve" count={ir.length} defaultOpen={false}>
                <PlayerGrid players={ir} onPlayerClick={setSelectedPlayer} />
              </CollapsibleSection>
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
