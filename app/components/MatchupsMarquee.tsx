"use client";

import React, { useEffect, useState, useRef } from 'react';
import Marquee from "react-fast-marquee";

interface Matchup {
  team1: string;
  team2: string;
  displayValue1: string;
  displayValue2: string;
  record1: string;
  record2: string;
  rank1?: string;
  rank2?: string;
  winnerOnTop?: boolean;
}

function isAfterWednesday10amEST() {
  const now = new Date();
  const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return estNow.getDay() > 3 || (estNow.getDay() === 3 && estNow.getHours() >= 10);
}

const MatchupsMarquee = () => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [isMatchupStarted, setIsMatchupStarted] = useState(false);
  const [isWeekFinished, setIsWeekFinished] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [teamRecords, setTeamRecords] = useState<Record<string, string>>({});
  const [teamRanks, setTeamRanks] = useState<Record<string, string>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch team records and ranks from standings endpoint
  const fetchTeamRecords = async () => {
    try {
      const standingsRes = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=standings&year=2025`
      );
      const standingsJson = await standingsRes.json();
      const teamsObj =
        standingsJson?.fantasy_content?.league?.[1]?.standings?.[0]?.teams || {};

      const records: Record<string, string> = {};
      const ranks: Record<string, string> = {};

      Object.values(teamsObj).forEach((teamObj: any) => {
        const teamArr = teamObj?.team;
        if (!teamArr) return;
        const teamMeta = teamArr[0];
        const teamNameObj = teamMeta?.find((item: any) => item.name);
        const teamName = teamNameObj?.name ?? "";
        const teamStandings = teamArr[2]?.team_standings;
        const outcome = teamStandings?.outcome_totals || {};
        const wins = outcome.wins ?? 0;
        const losses = outcome.losses ?? 0;
        const ties = outcome.ties ?? 0;
        records[teamName] = `(${wins}-${losses}-${ties})`;
        const rank = teamStandings?.rank ?? "";
        ranks[teamName] = rank ? `#${rank}` : "";
      });

      setTeamRecords(records);
      setTeamRanks(ranks);
    } catch (error) {
      console.error("Error fetching team records:", error);
    }
  };

  // Fetch matchups and include team records
  const fetchMatchups = async (weekOverride?: number) => {
    try {
      const weekParam = weekOverride ?? currentWeek;
      const response = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=2025&week=${weekParam}`
      );
      const data = await response.json();

      const week =
        Number(data?.fantasy_content?.league?.[1]?.scoreboard?.["0"]?.week) ||
        Number(data?.fantasy_content?.league?.[1]?.current_week) ||
        1;
      setCurrentWeek(week);

      const matchupsData =
        data?.fantasy_content?.league?.[1]?.scoreboard?.["0"]?.matchups;
      if (!matchupsData) {
        console.error("Matchups data is undefined or missing");
        return;
      }

      // Check if week is finished
      const isFinished =
        data?.fantasy_content?.league?.[1]?.scoreboard?.["0"]?.is_finished === 1;
      setIsWeekFinished(isFinished);

      // Transform the data into the Matchup format
      const formattedMatchups = Object.values(matchupsData)
        .filter((matchup: any) => matchup?.matchup?.["0"]?.teams)
        .map((matchup: any) => {
          const teams = matchup.matchup["0"].teams;
          const team1 = teams["0"].team;
          const team2 = teams["1"].team;

          const started = matchup.matchup.status !== "preevent";

          const team1Name =
            team1?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 1";
          const team2Name =
            team2?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 2";

          const team1Score = started ? parseFloat(team1?.[1]?.team_points?.total || "0") : 0;
          const team2Score = started ? parseFloat(team2?.[1]?.team_points?.total || "0") : 0;

          const team1Value = started
            ? team1Score.toFixed(2)
            : team1?.[1]?.win_probability
            ? Math.round(team1[1].win_probability * 100) + "%"
            : "0%";

          const team2Value = started
            ? team2Score.toFixed(2)
            : team2?.[1]?.win_probability
            ? Math.round(team2[1].win_probability * 100) + "%"
            : "0%";

          // Get records and ranks from state
          const record1 = teamRecords[team1Name] || "(0-0-0)";
          const record2 = teamRecords[team2Name] || "(0-0-0)";
          const rank1 = teamRanks[team1Name] || "";
          const rank2 = teamRanks[team2Name] || "";

          // If week is finished and scores are available, put winner on top and highlight
          if (isFinished && started && team1Score !== team2Score) {
            const winner =
              team1Score > team2Score
                ? { name: team1Name, value: team1Value, record: record1, rank: rank1 }
                : { name: team2Name, value: team2Value, record: record2, rank: rank2 };
            const loser =
              team1Score > team2Score
                ? { name: team2Name, value: team2Value, record: record2, rank: rank2 }
                : { name: team1Name, value: team1Value, record: record1, rank: rank1 };
            return {
              team1: winner.name,
              team2: loser.name,
              displayValue1: winner.value,
              displayValue2: loser.value,
              record1: winner.record,
              record2: loser.record,
              rank1: winner.rank,
              rank2: loser.rank,
              winnerOnTop: true,
            };
          } else {
            // Default sorting logic
            if (parseFloat(team1Value) >= parseFloat(team2Value)) {
              return {
                team1: team1Name,
                team2: team2Name,
                displayValue1: team1Value,
                displayValue2: team2Value,
                record1,
                record2,
                rank1,
                rank2,
                winnerOnTop: false,
              };
            } else {
              return {
                team1: team2Name,
                team2: team1Name,
                displayValue1: team2Value,
                displayValue2: team1Value,
                record1: record2,
                record2: record1,
                rank1: rank2,
                rank2: rank1,
                winnerOnTop: false,
              };
            }
          }
        });

      setMatchups(formattedMatchups);

      const anyStarted = Object.values(matchupsData).some(
        (matchup: any) => matchup?.matchup?.status !== "preevent"
      );
      setIsMatchupStarted(anyStarted);
    } catch (error) {
      console.error("Error fetching matchups:", error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTeamRecords();
  }, []);

  useEffect(() => {
    fetchMatchups();
  }, [teamRecords]);

  // Polling logic
  useEffect(() => {
    if (isWeekFinished) {
      pollingRef.current = setInterval(() => {
        if (isAfterWednesday10amEST()) {
          fetchMatchups(currentWeek + 1);
        } else {
          fetchMatchups(currentWeek);
        }
      }, 15000);
    } else if (isMatchupStarted) {
      pollingRef.current = setInterval(() => fetchMatchups(currentWeek), 15000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isMatchupStarted, isWeekFinished, currentWeek]);

  const calculateCardWidth = (
    team1: string,
    team2: string,
    record1: string,
    record2: string,
    displayValue1: string,
    displayValue2: string
  ) => {
    // Combine team name and record for each team
    const team1Full = `${team1} ${record1} ${displayValue1}`;
    const team2Full = `${team2} ${record2} ${displayValue2}`;
    const maxLength = Math.max(team1Full.length, team2Full.length);
    // Use a multiplier for font size and padding, clamp between 300 and 900px
    return Math.min(900, Math.max(300, maxLength * 13));
  };

  return (
    <div style={{ background: "#0f0f0f", padding: "8px" }}>
      <Marquee autoFill={true} pauseOnHover={true} gradient={false} speed={60}>
        {matchups.map((matchup, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(90deg, #0f0f0f 60%, #333 100%)",
              borderRadius: "10px",
              padding: "10px 20px",
              margin: "5px 20px",
              marginBottom: "20px",
              boxShadow: "0 2px 12px 0 #00FF00",
              fontFamily: "Arial, sans-serif",
              fontSize: "15px",
              textAlign: "left",
              border: "1px solid #444",
              color: "#00FF00",
              width: `${calculateCardWidth(
                matchup.team1,
                matchup.team2,
                matchup.record1,
                matchup.record2,
                matchup.displayValue1,
                matchup.displayValue2
              )}px`,
              whiteSpace: "nowrap",
              overflow: "visible",
            }}
          >
            <div
              style={{
                flex: 1,
                textAlign: "left",
                whiteSpace: "nowrap",
                overflow: "visible",
                marginRight: "5px",
              }}
            >
              <strong
                style={{
                  color: matchup.winnerOnTop ? "#FFD700" : "#00FF00",
                  fontWeight: 700,
                  background: matchup.winnerOnTop ? "linear-gradient(90deg,#FFD700 60%,#fff70022 100%)" : undefined,
                  borderRadius: matchup.winnerOnTop ? "6px" : undefined,
                  padding: matchup.winnerOnTop ? "2px 6px" : undefined,
                  boxShadow: matchup.winnerOnTop ? "0 0 8px #FFD700" : undefined,
                  display: "inline-block",
                }}
              >
                {matchup.rank1 && (
                  <span style={{ color: "#FFD700", fontWeight: 700, marginRight: 4 }}>
                    {matchup.rank1}
                  </span>
                )}
                {matchup.team1}{" "}
                <span style={{ color: "#7a7a7a", fontWeight: 400 }}>
                  {matchup.record1}
                </span>
              </strong>
              <br />
              <strong style={{ color: "#00FF00", fontWeight: 700 }}>
                {matchup.rank2 && (
                  <span style={{ color: "#FFD700", fontWeight: 700, marginRight: 4 }}>
                    {matchup.rank2}
                  </span>
                )}
                {matchup.team2}{" "}
                <span style={{ color: "#7a7a7a", fontWeight: 400 }}>
                  {matchup.record2}
                </span>
              </strong>
            </div>
            <div style={{ flex: 1, textAlign: "right", marginLeft: "0px" }}>
              <span style={{ color: "#32CD32", fontWeight: 500 }}>
                {matchup.displayValue1}
              </span>
              <br />
              <span style={{ color: "#32CD32", fontWeight: 500 }}>
                {matchup.displayValue2}
              </span>
            </div>
          </div>
        ))}
      </Marquee>
    </div>
  );
};

export default MatchupsMarquee;