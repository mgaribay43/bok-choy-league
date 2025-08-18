import React from 'react';
import Ices from './components/Ices';
import Standings from './components/Standings';
import Events from './components/Events';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Standings topThree/>
      <Events eventsSlideshow />
      <Ices latestOnly />
    </div>
  );
}
