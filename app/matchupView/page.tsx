'use client';

import React, { Suspense } from "react";
import Matchup from "../components/MatchupViewer";

const MatchupViewer = () => {
  return (
    <Suspense>
      <Matchup/>
    </Suspense>
  );
};

export default MatchupViewer;