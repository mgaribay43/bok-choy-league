'use client';

import React from "react";

export default function StandingsHeader({
  year,
  onYearChange,
}: {
  year: string;
  onYearChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl shadow-xl mb-8 p-6 sm:p-8">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-emerald-100 mb-2">
          🏈 Bok Choy League Standings
        </h1>
        <p className="text-emerald-300 text-lg font-medium mb-6">
          {year} Season Rankings
        </p>
        <div className="flex justify-center">
          <div className="relative">
            <select
              value={year}
              onChange={onYearChange}
              className="appearance-none bg-[#232323] text-emerald-100 border border-[#333] rounded-xl px-6 py-3 pr-12 font-medium text-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <option value="2025" className="text-emerald-100 bg-[#232323]">
                2025 Season
              </option>
              {Array.from({ length: 2024 - 2017 + 1 }, (_, i) => (2024 - i).toString()).map((y) => (
                <option key={y} value={y} className="text-emerald-100 bg-[#232323]">
                  {y} Season
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}