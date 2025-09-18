import React, { useEffect, useState } from "react";
import { getCurrentSeason } from "./globalUtils/getCurrentSeason";

const START_YEAR = 2017;

type ChampionTeam = {
  year: number;
  name: string;
  logo: string;
  manager: string;
  record: string;
  points: string;
};

function extractChampionFromYahooJson(json: any, year: number): ChampionTeam | null {
  const leagueArr = json?.fantasy_content?.league;
  if (!Array.isArray(leagueArr) || leagueArr.length < 2) return null;
  const standingsArr = leagueArr[1]?.standings;
  if (!Array.isArray(standingsArr) || standingsArr.length === 0) return null;
  const teamsObj = standingsArr[0]?.teams;
  if (!teamsObj || typeof teamsObj !== "object") return null;

  for (const key of Object.keys(teamsObj)) {
    if (key === "count") continue;
    const teamArr = teamsObj[key]?.team;
    if (!Array.isArray(teamArr)) continue;

    // teamArr[0] is an array of objects, find the right ones
    const teamInfoArr = Array.isArray(teamArr[0]) ? teamArr[0] : [];
    const teamInfoObj = teamInfoArr.find((item: any) => item && typeof item === "object" && "name" in item);
    const teamLogosObj = teamInfoArr.find((item: any) => item && typeof item === "object" && "team_logos" in item);
    const managersObj = teamInfoArr.find((item: any) => item && typeof item === "object" && "managers" in item);

    // Team name
    const name = teamInfoObj?.name || "";
    // Team logo
    let logo = "";
    if (
      teamLogosObj &&
      Array.isArray(teamLogosObj.team_logos) &&
      teamLogosObj.team_logos.length > 0 &&
      teamLogosObj.team_logos[0]?.team_logo?.url
    ) {
      logo = teamLogosObj.team_logos[0].team_logo.url;
    }
    // Manager nickname
    let manager = "";
    if (
      managersObj &&
      Array.isArray(managersObj.managers) &&
      managersObj.managers.length > 0 &&
      managersObj.managers[0]?.manager?.nickname
    ) {
      manager = managersObj.managers[0].manager.nickname;
    }

    // teamArr[2] is team_standings
    const teamStandings = teamArr[2]?.team_standings;
    const rank = teamStandings?.rank;
    if ((rank === 1 || rank === "1") && name && manager && logo) {
      let record = "";
      if (teamStandings?.outcome_totals) {
        record = `${teamStandings.outcome_totals.wins}-${teamStandings.outcome_totals.losses}-${teamStandings.outcome_totals.ties}`;
      }
      let points = teamStandings?.points_for || "";
      return {
        year,
        name,
        logo,
        manager,
        record,
        points,
      };
    }
  }
  return null;
}

async function fetchChampion(year: number): Promise<ChampionTeam | null> {
  try {
    const res = await fetch(
      `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=${year}`,
      { method: "GET" }
    );
    const json = await res.json();
    return extractChampionFromYahooJson(json, year);
  } catch (err) {
    return null;
  }
}

export default function ChampionsShowcase() {
  const [champions, setChampions] = useState<ChampionTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAllChampions() {
      setLoading(true);
      const currentSeason = await getCurrentSeason();
      const currentSeasonYear = Number(currentSeason);
      const years: number[] = [];
      for (let y = START_YEAR; y < currentSeasonYear; y++) years.push(y); // exclude current season
      const results: ChampionTeam[] = [];
      for (const year of years) {
        const champ = await fetchChampion(year);
        if (champ) results.push(champ);
      }
      if (mounted) {
        setChampions(results.reverse()); // newest first
        setLoading(false);
      }
    }
    loadAllChampions();
    return () => {
      mounted = false;
    };
  }, []);

  // If nothing is selected, select the most recent champion
  useEffect(() => {
    if (!loading && champions.length && selected === null) {
      setSelected(0);
    }
  }, [loading, champions, selected]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold text-center text-emerald-400 mb-8 tracking-tight drop-shadow-lg">
        Bok Choy League Hall of Champions
      </h1>
      {loading ? (
        <div className="text-center text-emerald-300 text-xl">Loading champions...</div>
      ) : champions.length === 0 ? (
        <div className="text-center text-emerald-300 text-xl">No champions found.</div>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {champions.map((champ, idx) => (
              <button
                key={champ.year}
                onClick={() => setSelected(idx)}
                className={`px-4 py-2 rounded-full border-2 font-semibold transition-all
                  ${
                    selected === idx
                      ? "bg-emerald-400 text-[#181818] border-emerald-400 shadow-lg scale-105"
                      : "bg-[#232323] text-emerald-200 border-[#333] hover:bg-emerald-700 hover:text-white"
                  }
                `}
              >
                {champ.year}
              </button>
            ))}
          </div>
          {selected !== null && champions[selected] && (
            <div className="relative bg-gradient-to-br from-emerald-900/80 to-[#181818] rounded-3xl shadow-2xl border-4 border-emerald-400 p-8 flex flex-col items-center animate-fadein mt-8">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <span className="inline-block px-6 py-2 rounded-full bg-emerald-400 text-[#181818] font-bold text-lg shadow-lg border-2 border-emerald-500 uppercase tracking-widest">
                  {champions[selected].year} Champion
                </span>
              </div>
              <img
                src={champions[selected].logo}
                alt={champions[selected].name}
                className="w-40 h-40 rounded-full border-8 border-emerald-300 shadow-xl mt-8 mb-6 object-cover bg-white"
                style={{ background: "#fff" }}
              />
              <div className="text-3xl font-extrabold text-white mb-2 text-center drop-shadow-lg">
                {champions[selected].name}
              </div>
              <div className="text-xl text-emerald-200 font-semibold mb-4 text-center">
                Managed by <span className="text-white">{champions[selected].manager}</span>
              </div>
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="bg-[#232323] rounded-full px-6 py-2 text-lg text-emerald-300 font-bold shadow">
                  Record: <span className="text-white">{champions[selected].record}</span>
                </div>
                <div className="bg-[#232323] rounded-full px-6 py-2 text-lg text-emerald-300 font-bold shadow">
                  Points For: <span className="text-white">{champions[selected].points}</span>
                </div>
              </div>
              <div className="mt-6 text-center text-emerald-200 text-lg italic">
                Congratulations to <span className="font-bold text-white">{champions[selected].manager}</span> and the{" "}
                <span className="font-bold text-white">{champions[selected].name}</span> for their championship season!
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                {selected > 0 && (
                  <button
                    className="px-6 py-2 rounded-full bg-emerald-400 text-[#181818] font-bold shadow hover:bg-emerald-300 transition"
                    onClick={() => setSelected(selected - 1)}
                  >
                    ← Previous
                  </button>
                )}
                {selected < champions.length - 1 && (
                  <button
                    className="px-6 py-2 rounded-full bg-emerald-400 text-[#181818] font-bold shadow hover:bg-emerald-300 transition"
                    onClick={() => setSelected(selected + 1)}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`
        .animate-fadein {
          animation: fadein 0.7s;
        }
        @keyframes fadein {
          from { opacity: 0; transform: scale(0.97);}
          to { opacity: 1; transform: scale(1);}
        }
      `}</style>
    </div>
  );
}