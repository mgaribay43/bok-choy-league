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
    <div style={{ marginTop: '20px', paddingBottom: '10px' }}>
      <Marquee autoFill={true} pauseOnHover={true} gradient={false} speed={60}>
        {keepers?.map((team: Team, index: number) => (
          <div
            key={index}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(90deg, #ccb637ff, #f3e743ff)',
              borderRadius: '8px',
              padding: '10px 20px',
              margin: '5px 20px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              fontFamily: 'Arial, sans-serif',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            <strong>{team.keeper}</strong>
            <br />
            <span style={{ color: '#757575' }}>{team.Manager}</span>
          </div>
        ))}
      </Marquee>
    </div>
  );
};

export default KeeperMarquee;