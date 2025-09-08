'use client';

import React, { useState, useEffect } from 'react';
import Ices from './components/ices/Ices';
import Standings from './components/standings/StandingsViewer';
import Events from './components/Events';
import KeeperBanner from './components/KeeperMarquee';
import MatchupsMarquee from './components/MatchupsViewer';
import Polls from './components/Poll';

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Simulate waiting for all components to load (replace with real checks if needed)
    const timer = setTimeout(() => setLoaded(true), 800); // Adjust time as needed
    return () => clearTimeout(timer);
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-[#0f0f0f]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-emerald-400 border-b-4 border-[#232323] mb-4"></div>
        <span className="text-emerald-200 text-xl font-bold">Loading Bok Choy League...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* <KeeperBanner /> */}
      <MatchupsMarquee Marquee/>
      <Polls ActivePolls={true} />
      <Standings topThree />
      <Ices latestOnly />
      <Events eventsSlideshow />
    </div>
  );
}
