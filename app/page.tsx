'use client';

import React, { useState, useEffect } from 'react';
import MatchupsMarquee from './components/MatchupsViewer';
import Ices from './components/ices/Ices';
import Standings from './components/standings/Standings';
import Events from './components/Events';
import KeeperBanner from './components/KeeperMarquee';
import Polls from './components/Poll';
import Transactions from './components/Transactions';

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState<boolean | null>(null);

  // NEW: track narrow/mobile viewport to adjust hero presentation
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  const [heroHeight, setHeroHeight] = useState<number>(360);
  const [heroTopOffset, setHeroTopOffset] = useState<number>(0);

  useEffect(() => {
    // Simulate waiting for all components to load (replace with real checks if needed)
    const timer = setTimeout(() => setLoaded(true), 800); // Adjust time as needed
    return () => clearTimeout(timer);
  }, []);

  // compute narrow/mobile flag and hero height so the fixed hero matches layout sizing
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const narrow = w < 640; // Tailwind sm
      setIsNarrow(narrow);
      let h = 360;
      if (w >= 1024) h = 980;
      else if (w >= 768) h = 380;
      else if (w >= 640) h = 340;
      else h = 360;
      setHeroHeight(h);


      // measure top nav/header if present and use its height as a top offset for the fixed hero.
      // This prevents the hero from appearing underneath a fixed/sticky navbar on mobile.
      try {
        const sel = ['header', 'nav', '.site-header', '.main-header', '#navbar'];
        let foundHeight = 0;
        for (const s of sel) {
          const el = document.querySelector(s) as HTMLElement | null;
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.height > 0) {
              foundHeight = rect.height;
              break;
            }
          }
        }
        setHeroTopOffset(foundHeight || 0);
      } catch (err) {
        setHeroTopOffset(0);
      }
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // preload hero image to help diagnose loading issues
  useEffect(() => {
    const img = new Image();
    // public/ files are served from the site root — use an absolute path
    img.src = '/images/the_fellas_plus_jakes.jpg';
    img.onload = () => setHeroLoaded(true);
    img.onerror = () => {
      console.error('Hero image failed to load from /images/the_fellas_plus_jakes.jpg — ensure file exists in public/images/ and filename/casing matches.');
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
        {/* Matchups marquee sits visually on top of the hero on desktop only.
            Make it full-bleed by removing the max-width wrapper so the marquee extends
            to the full page width. Keep overflow-hidden on the absolute container so
            duplicated marquee children don't widen the page. */}
        {/* Desktop marquee: sits on top of hero (desktop only) */}
        <div
          className="hidden sm:flex absolute inset-x-0 z-40 pointer-events-auto overflow-hidden"
          style={{ top: `${Math.max(heroTopOffset - 60, 0)}px` }}
        >
          <div className="w-full">
            <MatchupsMarquee Marquee />
          </div>
        </div>

        {/* Mobile compact marquee: full-bleed, compact items (logos + scores) */}
        <div
          className="sm:hidden absolute inset-x-0 z-40 pointer-events-auto overflow-hidden"
          style={{ top: `${Math.max(heroTopOffset - 60, 0)}px` }}
        >
          <div className="w-full px-3">
            <MatchupsMarquee Marquee />
          </div>
        </div>

        {/* Fixed hero background that stays in place while other elements scroll over it.
            We render a fixed-position background element sized to the hero height and keep a
            placeholder element in flow so layout/spacing matches Tailwind sizing. */}
        <div aria-hidden={heroLoaded === false}>
          {/* fixed hero (image + gradient together) — nothing else should render a gradient here */}
          <div
             aria-hidden
             style={{
              position: "fixed",
              top: `${heroTopOffset}px`,
               left: 0,
               right: 0,
               height: `${heroHeight}px`,
               zIndex: -1,
               pointerEvents: "none",
               backgroundImage: `linear-gradient(to bottom, rgba(15,15,15,0) 45%, rgba(15,15,15,1) 100%), url('/images/the_fellas_plus_jakes.jpg')`,
               backgroundSize: "cover",
               backgroundRepeat: "no-repeat",
               backgroundPosition: isNarrow ? "center 48%" : "center 8%",
               transform: "translateZ(0)",
               // force GPU compositing in problematic browsers
               willChange: "transform, opacity",
             }}
           />

          {/* spacer reserves the hero vertical space plus the top offset so layout doesn't jump */}
          <div style={{ height: heroHeight + heroTopOffset }} aria-hidden />
         </div>

        {/* Pull the Standings up so its bottom overlaps the hero image.
            The Standings component is rendered above the bottom of the image (z-20)
            and sits visually in front of the page content below. Adjust -mt values to taste. */}
        <div className="relative z-20 -mt-28 sm:-mt-36 md:-mt-44 lg:-mt-72 xl:-mt-96 px-4">
           {/* Keep Standings fully transparent (no translucent background) */}
           <div className="w-full bg-transparent">
             <Standings topThree />
           </div>
         </div>
      </section>

      {/* other page content */}
      <div className="mt-8">
        <Polls ActivePolls={true} />
        <div className="mt-6">
          <Ices latestOnly />
          <Transactions />
          <Events eventsSlideshow />
        </div>
      </div>
    </div>
  );
}