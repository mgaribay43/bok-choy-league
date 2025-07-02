"use client";

import React, { useEffect, useState } from "react";

const TeamViewer = ({ userId }: { userId: string }) => {
  const [teams, setTeams] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch(
          `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/getYahooTeam?userId=${encodeURIComponent(userId)}`
        );

        if (!res.ok) throw new Error("Failed to fetch team data");

        const data = await res.json();
        setTeams(data);
      } catch (err: any) {
        setError(err.message);
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
