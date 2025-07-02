"use client";

import React, { useEffect, useState } from "react";

interface Team {
  id: string;
  name: string;
  // add more properties if you want
}

const TeamViewer = ({ userId }: { userId: string }) => {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch(`/api/getTeams?userId=${userId}`);
        if (!response.ok) throw new Error("Failed to fetch teams");
        const data = await response.json();
        setTeams(data.teams || data); // adjust to your API shape
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError("Unknown error");
      }
    }
    loadTeams();
  }, [userId]);

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
