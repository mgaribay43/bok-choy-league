import React from 'react';
import HeroSection from './components/HeroSection';
import Matchups from './components/Matchups';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-green-50">
      <HeroSection />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full mt-2"> {/* small margin */}
        <Matchups showSelectors={false} />
      </div>
    </div>
  );
}
