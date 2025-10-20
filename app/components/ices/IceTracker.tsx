'use client';

import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { getDisplayManagerName } from "../globalUtils/getManagerNames";
import { getHighResPlayerImage } from "../globalUtils/getHighResPlayerImage";
import { useAuth } from "../../../context/AuthContext";
import AddIces from "../addIces";

// Improved lookup that mirrors server logic and handles DEF/team-name cases
function getNflGameForPlayerTeam(
  nflGames: Record<string, any> | null | undefined,
  yahooAbbr?: string | null,
  fallbackTeamName?: string | null
) {
  if (!nflGames) return null;

  const raw = (yahooAbbr || "").toString().trim();
  const cleanAbb = raw.replace(/\s+DEF$/i, "").replace(/\./g, "").toUpperCase();
  const cleanedLower = cleanAbb.toLowerCase();

  const tryKeys = new Set<string>();
  if (cleanAbb) tryKeys.add(cleanAbb);
  if (cleanedLower) tryKeys.add(cleanedLower);
  if (yahooAbbr) tryKeys.add(String(yahooAbbr));
  if (yahooAbbr) tryKeys.add(String(yahooAbbr).toLowerCase());

  const norm = (s: any) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (fallbackTeamName) {
    const fb = norm(fallbackTeamName);
    if (fb) tryKeys.add(fb);
    (fallbackTeamName.match(/\w+/g) || []).slice(0, 3).forEach((tok: string) => tryKeys.add(norm(tok)));
  }

  // Try common mapping used server-side
  const YAHOO_TO_NFL_ABBR: Record<string, string> = { WAS: "WSH", JAC: "JAX" };
  if (cleanAbb) {
    const mapped = YAHOO_TO_NFL_ABBR[cleanAbb] || cleanAbb;
    tryKeys.add(mapped);
    tryKeys.add(mapped.toLowerCase());
  }

  // attempt direct lookups
  for (const k of Array.from(tryKeys)) {
    if (!k) continue;
    if ((nflGames as any)[k]) return (nflGames as any)[k];
  }

  // last-resort partial matching against home/away names/abbs
  const needle = norm(cleanAbb || fallbackTeamName || "");
  if (needle) {
    for (const key of Object.keys(nflGames)) {
      const g = (nflGames as any)[key];
      const homeAbb = norm(g?.homeTeam?.abbreviation || "");
      const awayAbb = norm(g?.awayTeam?.abbreviation || "");
      const homeName = norm(g?.homeTeam?.fullName || g?.homeTeam?.name || "");
      const awayName = norm(g?.awayTeam?.fullName || g?.awayTeam?.name || "");

      if (homeAbb === needle || awayAbb === needle) return g;
      if (homeName.includes(needle) || awayName.includes(needle)) return g;
      if (needle.includes(homeAbb) || needle.includes(awayAbb)) return g;
    }
  }

  return null;
}

export default function IceTracker() {
  const [loading, setLoading] = useState(true);
  const [icePlayers, setIcePlayers] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});
  const [nflGames, setNflGames] = useState<Record<string, any>>({});
  const [showAddIceModal, setShowAddIceModal] = useState(false);
  const [addIcePrefill, setAddIcePrefill] = useState<any>(null);

  // NEW: state for manual cloud function run
  const [runningIceJob, setRunningIceJob] = useState(false);
  const [iceJobMessage, setIceJobMessage] = useState<string | null>(null);

  // NEW: allow manually selecting a week to test
  const [manualWeek, setManualWeek] = useState<string>("");

  const { user } = useAuth() || {};

  // NEW: run cloud function manually for testing
  async function runIceTracker() {
    try {
      setRunningIceJob(true);
      setIceJobMessage(null);

      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bokchoyleague";
      const season = new Date().getFullYear().toString();
      // prefer manualWeek when provided, otherwise fall back to currentWeek
      const chosenWeek = manualWeek ? manualWeek : (currentWeek ? String(currentWeek) : "");
      const weekParam = chosenWeek ? `&week=${encodeURIComponent(chosenWeek)}` : "";
      const url = `https://us-central1-${projectId}.cloudfunctions.net/iceTracker?season=${encodeURIComponent(
        season
      )}${weekParam}`;

      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} ${text}`);
      }
      const json = await res.json().catch(() => ({}));
      setIceJobMessage(`Function ran: ${json?.count ?? "ok"}`);
    } catch (err: any) {
      setIceJobMessage(`Run failed: ${String(err?.message ?? err)}`);
    } finally {
      setRunningIceJob(false);
    }
  }

  useEffect(() => {
    const db = getFirestore();
    const docRef = doc(db, "iceTracker", "current");

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setIcePlayers([]);
          setPointsMap({});
          setNflGames({});
          setCurrentWeek(null);
          setLastUpdated(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as Record<string, any>;

        setIcePlayers(Array.isArray(data.players) ? data.players : []);
        setPointsMap(data.pointsMap || {});
        setNflGames(data.nflGames || {});
        setCurrentWeek(typeof data.currentWeek === "number" ? data.currentWeek : null);

        const lu = data.lastUpdated;
        if (!lu) {
          setLastUpdated(null);
        } else if (typeof (lu as any).toDate === "function") {
          setLastUpdated((lu as any).toDate());
        } else {
          setLastUpdated(new Date(lu));
        }

        setLoading(false);
      },
      (err) => {
        console.error("IceTracker snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Group by display manager
  const playersByManager: Record<string, typeof icePlayers> = {};
  icePlayers.forEach((p) => {
    const displayName = getDisplayManagerName(p.managerName);
    if (!playersByManager[displayName]) playersByManager[displayName] = [];
    playersByManager[displayName].push(p);
  });

  function getGameEndDateFromGame(game: any): string {
    if (!game) return "";
    if (game.endTime) {
      try {
        return new Date(game.endTime).toISOString().slice(0, 10);
      } catch {}
    }
    if (game.date) {
      try {
        return new Date(game.date).toISOString().slice(0, 10);
      } catch {}
    }
    if (game.statusDetail && /\d{1,2}\/\d{1,2}\/\d{4}/.test(game.statusDetail)) {
      const match = game.statusDetail.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, mm, dd, yyyy] = match;
        return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
    }
    return new Date().toISOString().slice(0, 10);
  }

  function handleAddIce(p: any) {
    // use robust lookup with teamName fallback (handles DEF entries)
    const game = getNflGameForPlayerTeam(nflGames, p.team, p.teamName);
    const date = getGameEndDateFromGame(game);
    setAddIcePrefill({
      player: p.name,
      manager: getDisplayManagerName(p.managerName),
      week: currentWeek?.toString() || "",
      team: p.team,
      date,
      flavor: "Standard", // always prefill flavor to "standard"
    });
    setShowAddIceModal(true);
  }

  return (
    <div className="max-w-3xl mx-auto mt-4 bg-[#181818] rounded-xl shadow-lg px-2 sm:px-6">
      <h2 className="text-2xl font-bold text-emerald-300 mb-1 text-center">
        🧊 Ice Tracker
        {currentWeek && (
          <span className="block text-base font-semibold text-emerald-200 mt-1">
            Week {currentWeek}
          </span>
        )}
      </h2>

      {/* NEW: manual run button for testing (visible to commissioner) */}
      {user?.email === "mikeyjordan43@gmail.com" && (
        <div className="flex flex-col items-center mt-2 mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-300 font-medium">Week</label>
            <input
              type="number"
              min={1}
              className="w-20 px-2 py-1 rounded bg-[#121212] text-emerald-100 border border-[#2b2b2b]"
              value={manualWeek}
              onChange={(e) => setManualWeek(e.target.value)}
              placeholder={currentWeek ? String(currentWeek) : "auto"}
            />
            <button
              type="button"
              onClick={() => setManualWeek("")}
              className="text-xs px-2 py-1 rounded bg-[#2b2b2b] text-gray-200 hover:bg-[#333]"
              title="Clear manual week"
            >
              Clear
            </button>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              disabled={runningIceJob}
              onClick={runIceTracker}
              className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition"
            >
              {runningIceJob ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                </svg>
              ) : (
                `Run IceTracker (test${manualWeek ? ` — week ${manualWeek}` : ""})`
              )}
            </button>
          </div>
        </div>
      )}
      {iceJobMessage && (
        <div className="text-center text-xs text-gray-300 mb-3">{iceJobMessage}</div>
      )}

      <p className="text-center text-gray-400 mb-2">
        Players in starting lineups with <span className="font-semibold text-emerald-200">0 points</span> this week.
      </p>

      {lastUpdated && (
        <div className="text-xs text-gray-500 text-center mb-4">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : icePlayers.length === 0 ? (
        <div className="text-center text-emerald-400 font-semibold py-8">No starters are currently on ice! 🥶</div>
      ) : (
        <div>
          {Object.entries(playersByManager).map(([manager, players]) => (
            <div key={manager} className="mb-8">
              <h3 className="text-xl font-bold text-emerald-200 mb-4 border-b border-emerald-800 pb-1 text-center">
                {manager}
              </h3>
              <ul className="divide-y divide-[#232323]">
                {players.map((p, idx) => {
                  const game = getNflGameForPlayerTeam(nflGames, p.team, p.teamName);

                  let gameInfo = null;
                  let isGameActiveOrFinal = false;
                  if (game) {
                    const status = (game.status || "").toLowerCase();
                    const statusDetail = (game.statusDetail || "").toLowerCase();
                    const isFinal = status.includes("final") || statusDetail.includes("final");
                    const isInProgress = status.includes("in progress") || statusDetail.includes("in progress");
                    isGameActiveOrFinal = isFinal || isInProgress;

                    gameInfo = (
                      <div className="text-xs text-right mt-1">
                        <div className="text-gray-300 font-semibold">
                          {game.awayTeam?.abbreviation} @ {game.homeTeam?.abbreviation}
                        </div>
                        <div className="text-gray-400">{game.statusDetail || game.status}</div>
                        {isFinal ? (
                          <span className="text-red-400 font-semibold">Game Final – Iced ❄️</span>
                        ) : isInProgress ? (
                          <span className="text-blue-300 font-semibold">Live: {game.statusDetail}</span>
                        ) : null}
                      </div>
                    );
                  } else {
                    gameInfo = (
                      <div className="text-xs text-gray-500 mt-1">No NFL game found for {p.team || p.teamName}</div>
                    );
                  }

                  const pts = typeof pointsMap?.[p.playerKey] === "number" ? pointsMap[p.playerKey] : undefined;
                  const isIced = isGameActiveOrFinal && pts !== undefined && pts <= 0;

                  return (
                    <li
                      key={p.playerKey + "-" + idx}
                      className={`flex flex-row items-center gap-3 sm:gap-6 py-4 px-2 sm:px-4 ${
                        isIced
                          ? "border-2 border-transparent bg-[#181818] shadow-[0_0_12px_4px_#22d3ee]"
                          : "border-transparent bg-[#181818]"
                      } rounded-xl sm:rounded-lg transition-all mb-6`}
                    >
                      <div className="flex items-center justify-center flex-shrink-0">
                        <img src={getHighResPlayerImage(p)} alt={p.name} className="h-16 w-16 sm:h-24 sm:w-24 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base sm:text-lg font-semibold text-emerald-300 truncate">{p.name}</div>
                        <div className="text-xs sm:text-sm text-gray-400 truncate">
                          {p.position} - {p.team}
                        </div>
                      </div>
                      <div className="flex flex-col items-end min-w-[90px] sm:min-w-[120px] ml-2 sm:ml-6">
                        <span className="text-base sm:text-lg font-bold text-emerald-400">
                          {typeof pts === "number" ? pts.toFixed(2) : "0.00"}
                        </span>
                        {gameInfo}
                        {isIced && user?.email === "mikeyjordan43@gmail.com" && (
                          <button
                            className="mt-2 px-3 py-1 rounded bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition"
                            onClick={() => handleAddIce(p)}
                            type="button"
                          >
                            Add Ice
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showAddIceModal && (
        <AddIces open={showAddIceModal} onClose={() => setShowAddIceModal(false)} prefill={addIcePrefill} />
      )}
    </div>
  );
}