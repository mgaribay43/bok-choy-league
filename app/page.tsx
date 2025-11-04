'use client';

import React, { useState, useEffect } from 'react';
import Ices from './components/ices/Ices';
import Standings from './components/standings/Standings';
import Events from './components/Events';
import KeeperBanner from './components/KeeperMarquee';
import MatchupsMarquee from './components/MatchupsViewer';
import Polls from './components/Poll';
import Transactions from './components/Transactions';

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState<boolean | null>(null);

  // NEW: track narrow/mobile viewport to adjust hero presentation
  const [isNarrow, setIsNarrow] = useState<boolean>(false);

  useEffect(() => {
    // Simulate waiting for all components to load (replace with real checks if needed)
    const timer = setTimeout(() => setLoaded(true), 800); // Adjust time as needed
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 640); // Tailwind 'sm' breakpoint ~= 640px
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // preload hero image to help diagnose loading issues
  useEffect(() => {
    const img = new Image();
    // public/ files are served from the site root — use an absolute path
    img.src = '/images/the_fellas.jpg';
    img.onload = () => setHeroLoaded(true);
    img.onerror = () => {
      console.error('Hero image failed to load from /images/the_fellas.jpg — ensure file exists in public/images/ and filename/casing matches.');
      setHeroLoaded(false);
    };
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

      {/* Hero image behind the Standings top-three */}
      <section className="relative w-full">
        {/* Matchups marquee sits visually on top of the hero on desktop only */}
        <div className="hidden sm:flex absolute top-4 justify-center z-30 pointer-events-auto">
          <div className=" w-full">
            <MatchupsMarquee Marquee />
          </div>
        </div>

        {/* Hero image area using background-image (more robust for cover placement)
            MOBILE-FRIENDLY: reduce vertical height on narrow screens so more horizontal image area is visible.
            Also adjust backgroundPosition when narrow to prioritize horizontal framing. */}
        <div
          className={
            // default (mobile) shorter height so more width of the image is visible,
            // then progressively larger on bigger viewports.
            // h-[280px] on mobile shows more horizontal composition instead of tall crop.
            "w-full h-[280px] sm:h-[360px] md:h-[420px] lg:h-[850px] overflow-hidden bg-cover"
          }
          // use the public/ root path
          style={{
            backgroundImage: "url('/images/the_fellas.jpg')",
            // If narrow, favor a slightly left/center horizontal framing so more of the sides show.
            // On wider screens use center top so standings overlay aligns well.
            backgroundPosition: isNarrow ? 'center center' : 'center top',
            backgroundRepeat: 'no-repeat'
          }}
          aria-hidden={heroLoaded === false}
        >
          {/* If image fails to load, you can show a subtle fallback color */}
          <div className="w-full h-full bg-[#0f0f0f] bg-opacity-10" />
          {/* subtle dark gradient at bottom so the standings blend over it */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0f0f] pointer-events-none" />
        </div>

        {/* Pull the Standings up so its bottom overlaps the hero image.
            The Standings component is rendered above the bottom of the image (z-20)
            and sits visually in front of the page content below. Adjust -mt values to taste. */}
        <div className="relative z-20 -mt-20 sm:-mt-28 md:-mt-36 lg:-mt-44 px-4">
          <Standings topThree />
        </div>
      </section>

      {/* other page content */}
      <div className="mt-8">
        <Polls ActivePolls={true} />
        {/* keep normal spacing below the overlapping standings */}
        <div className="mt-6">
          <Ices latestOnly />
          <Transactions />
          <Events eventsSlideshow />
        </div>
      </div>
    </div>
  );
}
