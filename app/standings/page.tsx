"use client"; // since we want hooks like useState, useEffect

import React from "react";
import StandingsPage from "../components/Standings";

const Standings = () => {
  // For example, get userId from localStorage or context, or hardcode for now
  return (
    <div>
      <StandingsPage/>
    </div>
  );
};

export default Standings;
