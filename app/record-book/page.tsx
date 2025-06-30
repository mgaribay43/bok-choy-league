'use client';

import React from 'react';

const leagueRecords = [
  {
    year: 2021,
    records: [
      {
        title: '🏆 Largest Margin of Victory',
        value: '85.4 points',
        details: 'Leaf Me Alone defeated Sack Choy 142.6 – 57.2 in Week 9',
      },
      {
        title: '🔥 Most Points in a Matchup',
        value: '289.1 points',
        details: 'Kale’d It (146.3) vs Bok ‘n’ Roll (142.8) – Week 6',
      },
      {
        title: '📉 Lowest Scoring Win',
        value: '66.4 points',
        details: 'Fantasy Salad edged Choyzilla 66.4 – 65.9 in Week 2',
      },
    ],
  },
  {
    year: 2021,
    records: [
      {
        title: '🏆 Largest Margin of Victory',
        value: '74.8 points',
        details: 'The Green Machine defeated Turnip the Heat 130.2 – 55.4 in Week 12',
      },
      {
        title: '🔥 Most Points in a Matchup',
        value: '294.0 points',
        details: 'Brocc the Vote (148.6) vs Team Crunchy (145.4) – Week 4',
      },
      {
        title: '📈 Highest Season Average',
        value: '131.9 points/game',
        details: 'Choyzilla across 14 regular-season games',
      },
    ],
  },
  {
    year: 2022,
    records: [
      {
        title: '🔥 Most Points in a Matchup',
        value: '303.7 points',
        details: 'Sack Choy (152.8) vs Kale’d It (150.9) – Week 7',
      },
      {
        title: '🏆 Largest Margin of Victory',
        value: '89.1 points',
        details: 'Turnip the Heat defeated Fantasy Salad 137.3 – 48.2 in Week 11',
      },
      {
        title: '📉 Lowest Scoring Win',
        value: '61.9 points',
        details: 'Leaf Me Alone beat Team Crunchy 61.9 – 61.2 in Week 10',
      },
    ],
  },
];

export default function RecordBookPage() {
  return (
    <div className="min-h-screen bg-green-50 px-6 py-12">
      <h1 className="text-4xl font-extrabold text-center text-green-800 mb-10">
        📖 Bok Choy League Record Book
      </h1>

      <div className="max-w-6xl mx-auto space-y-12">
        {leagueRecords.map((season) => (
          <div key={season.year}>
            <h2 className="text-2xl font-bold text-green-700 mb-4">{season.year} Season</h2>

            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full bg-white border border-green-200">
                <thead className="bg-green-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-green-800 font-semibold">Record</th>
                    <th className="text-left px-4 py-3 text-green-800 font-semibold">Value</th>
                    <th className="text-left px-4 py-3 text-green-800 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {season.records.map((record, idx) => (
                    <tr key={idx} className="border-t hover:bg-green-50">
                      <td className="px-4 py-3 font-medium text-green-900">{record.title}</td>
                      <td className="px-4 py-3 text-gray-800">{record.value}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
