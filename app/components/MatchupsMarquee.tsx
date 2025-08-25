"use client";

import React, { useEffect, useState } from 'react';
import Marquee from "react-fast-marquee";

interface Matchup {
  team1: string;
  team2: string;
  displayValue1: string;
  displayValue2: string;
}

const MatchupsMarquee = () => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);

  useEffect(() => {
    const fetchMatchups = async () => {
      try {
        const response = await fetch(`https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=scoreboard&year=2025`);
        const data = await response.json();

        // Dynamically get the current week
        const currentWeek = data?.fantasy_content?.league?.[1]?.current_week;

        // Safely access the deeply nested matchups structure based on examplescoreboard.json
        const matchupsData = data?.fantasy_content?.league?.[1]?.scoreboard?.["0"]?.matchups;

        if (!matchupsData) {
          console.error("Matchups data is undefined or missing");
          return;
        }

        // Transform the data into the Matchup format
        const formattedMatchups = Object.values(matchupsData)
          .filter((matchup: any) => matchup?.matchup?.["0"]?.teams)
          .map((matchup: any) => {
            const teams = matchup.matchup["0"].teams;
            const team1 = teams["0"].team;
            const team2 = teams["1"].team;

            // Determine whether to display win probabilities or scores based on matchup status
            const isMatchupStarted = matchup.matchup.status !== "preevent";

            const team1Name = team1?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 1";
            const team2Name = team2?.[0]?.find((item: any) => item.name)?.name || "Unknown Team 2";

            const team1Value = isMatchupStarted
              ? parseFloat(team1?.[1]?.team_points?.total || "0").toFixed(2)
              : (team1?.[1]?.win_probability ? Math.round(team1[1].win_probability * 100) : 0);

            const team2Value = isMatchupStarted
              ? parseFloat(team2?.[1]?.team_points?.total || "0").toFixed(2)
              : (team2?.[1]?.win_probability ? Math.round(team2[1].win_probability * 100) : 0);

            // Sort teams so the higher percentage is on top
            if (team1Value >= team2Value) {
              return {
                team1: team1Name,
                team2: team2Name,
                displayValue1: isMatchupStarted ? `${team1Value}` : `${team1Value}%`,
                displayValue2: isMatchupStarted ? `${team2Value}` : `${team2Value}%`,
              };
            } else {
              return {
                team1: team2Name,
                team2: team1Name,
                displayValue1: isMatchupStarted ? `${team2Value}` : `${team2Value}%`,
                displayValue2: isMatchupStarted ? `${team1Value}` : `${team1Value}%`,
              };
            }
          });

        setMatchups(formattedMatchups);
      } catch (error) {
        console.error("Error fetching matchups:", error);
      }
    };

    fetchMatchups();
  }, []);

  const calculateCardWidth = (team1: string, team2: string, displayValue1: string, displayValue2: string) => {
    const maxLength = Math.max(
      team1.length + displayValue1.length,
      team2.length + displayValue2.length
    );
    return Math.min(800, Math.max(300, maxLength * 10)); // Dynamically adjust width between 300px and 800px
  };

  return (
    <div style={{ background: "#0f0f0f", padding: "8px" }}>
      <Marquee autoFill={true} pauseOnHover={true} gradient={false} speed={60}>
        {matchups.map((matchup, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(90deg, #0f0f0f 60%, #333 100%)',
              borderRadius: '10px',
              padding: '10px 20px',
              margin: '5px 20px',
              marginBottom: "20px",
              boxShadow: '0 2px 12px 0 #00FF00',
              fontFamily: 'Arial, sans-serif',
              fontSize: '15px',
              textAlign: 'left',
              border: '1px solid #444',
              color: '#00FF00',
              width: `${calculateCardWidth(matchup.team1, matchup.team2, matchup.displayValue1, matchup.displayValue2)}px`,
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            <div style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', marginRight: '5px' }}>
              <strong style={{ color: '#00FF00', fontWeight: 700 }}>{matchup.team1}</strong>
              <br />
              <strong style={{ color: '#00FF00', fontWeight: 700 }}>{matchup.team2}</strong>
            </div>
            <div style={{ flex: 1, textAlign: 'right', marginLeft: '0px' }}>
              <span style={{ color: '#32CD32', fontWeight: 500 }}>{matchup.displayValue1}</span>
              <br />
              <span style={{ color: '#32CD32', fontWeight: 500 }}>{matchup.displayValue2}</span>
            </div>
          </div>
        ))}
      </Marquee>
    </div>
  );
};

export default MatchupsMarquee;