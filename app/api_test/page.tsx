"use client";

import React, { useEffect, useState } from "react";

const leagueKeysByYear: Record<string, string> = {
  "2017": "371.l.912608",
  "2018": "380.l.727261",
  "2019": "390.l.701331",
  "2020": "399.l.635829",
  "2021": "406.l.11184",
  "2022": "414.l.548584",
  "2023": "423.l.397633",
  "2024": "449.l.111890",
  "2025": "461.l.128797",
};

const endpoints = ["teams", "standings", "scoreboard", "draftresults", "roster"];

const YahooViewer = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedEndpoint, setSelectedEndpoint] = useState("teams");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(
        `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=${selectedEndpoint}&year=${selectedYear}`
      );

      if (!response.ok) throw new Error("Failed to fetch from Yahoo API");

      const json = await response.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedEndpoint]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-lg"
        >
          {Object.keys(leagueKeysByYear)
            .sort((a, b) => Number(b) - Number(a))
            .map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
        </select>

        <select
          value={selectedEndpoint}
          onChange={(e) => setSelectedEndpoint(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-lg"
        >
          {endpoints.map((ep) => (
            <option key={ep} value={ep}>
              {ep}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      <h2 className="text-xl font-bold text-center mb-4">
        {selectedEndpoint} data for {selectedYear}
      </h2>

      {error && <p className="text-red-500 text-center">{error}</p>}
      {loading && <p className="text-center text-gray-500">Loading...</p>}

      <pre className="bg-gray-100 text-sm p-4 rounded-md overflow-auto max-h-[600px]">
        {data ? JSON.stringify(data, null, 2) : "No data"}
      </pre>
    </div>
  );
};

export default YahooViewer;
