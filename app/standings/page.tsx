"use client"; // since we want hooks like useState, useEffect

import React from "react";
import TeamViewer from "../components/TeamViewer";

const ApiTestPage = () => {
  // For example, get userId from localStorage or context, or hardcode for now
  return (
    <div>
      <TeamViewer/>
    </div>
  );
};

export default ApiTestPage;
