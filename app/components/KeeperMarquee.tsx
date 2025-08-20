"use client";

import React from 'react';
import Marquee from "react-fast-marquee";
import keepersData from '../data/keepers/keepers.json';

interface Team {
  Manager: string;
  TeamID: string;
  keeper: string;
}

interface KeepersData {
  [year: string]: {
    Teams: Team[];
  };
}

const KeeperMarquee = () => {
  const currentYear = new Date().getFullYear().toString();
  const keepers = (keepersData as KeepersData)[currentYear]?.Teams.filter((team: Team) => team.keeper);

  return (
    <div style={{ background: "#0f0f0f", padding: "8px" }}>
      <Marquee autoFill={true} pauseOnHover={true} gradient={false} speed={60}>
        {keepers?.map((team: Team, index: number) => (
          <div
            key={index}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(90deg, #0f0f0f 60%, #333 100%)',
              borderRadius: '10px',
              padding: '10px 20px',
              margin: '5px 20px',
              marginBottom: "20px",
              boxShadow: '0 2px 12px 0 #FFD700',
              fontFamily: 'Arial, sans-serif',
              fontSize: '15px',
              textAlign: 'center',
              border: '1px solid #444',
              color: '#f3e743',
              minWidth: '120px'
            }}
          >
            <strong style={{ color: '#f3e743', fontWeight: 700 }}>{team.keeper}</strong>
            <br />
            <span style={{ color: '#bdb76b', fontWeight: 500 }}>{team.Manager}</span>
          </div>
        ))}
      </Marquee>
    </div>
  );
};

export default KeeperMarquee;