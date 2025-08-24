import React from 'react';
import Ices from './components/Ices';
import Standings from './components/Standings';
import Events from './components/Events';
import KeeperBanner from './components/KeeperMarquee'
import MatchupsMarquee from './components/MatchupsMarquee';
import Polls from './components/Poll'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* <KeeperBanner /> */}
      <MatchupsMarquee />
      <Polls ActivePolls={true} />
      <Standings topThree />
      <Events eventsSlideshow />
      <Ices latestOnly />
    </div>
  );
}
