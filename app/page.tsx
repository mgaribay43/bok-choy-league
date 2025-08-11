import React from 'react';
import HeroSection from './components/HeroSection';
import Standings from './components/Standings';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-green-50">
      <HeroSection />
      <Standings />
    </div>
  );
}
