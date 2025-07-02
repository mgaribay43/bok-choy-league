"use client";

import React, { useEffect, useState } from "react";

interface Team {
  id: string;
  name: string;
  // add more properties if needed
}

const TeamViewer = () => {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);

  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch("https://getteams-4mkk4ype2a-uc.a.run.app");
        if (!response.ok) throw new Error("Failed to fetch teams");
        const data = await response.json();
        setTeams(data.teams || data); // adjust if your API returns { teams: [...] }
      } catch (err: any) {
        console.error("Fetch error:", err);

        setError(err.message || "An error occurred");
        setErrorDetails({
          stack: err.stack || null,
          raw: err,
        });
      }
    }

    loadTeams();
  }, []);

  if (error) return <p>Error: {error}</p>;
  if (!teams) return <p>Loading...</p>;

  return (
    <div>
      <h2>Your Yahoo Teams</h2>
      <pre>{JSON.stringify(teams, null, 2)}</pre>
    </div>
  );
};

export default TeamViewer;
