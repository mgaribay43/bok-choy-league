import React from 'react';
import Ices from './components/Ices';
import Standings from './components/Standings';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Standings topThree/>
      <Ices latestOnly />
    </div>
  );
}
