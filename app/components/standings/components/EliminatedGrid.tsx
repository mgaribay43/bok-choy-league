'use client';

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamEntry } from "../utils/standingsUtils";

export default function EliminatedGrid({
  year,
  teams,
}: {
  year: string;
  teams: TeamEntry[];
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-red-400 mb-4 text-center">Eliminated Teams</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
        {teams.map(team => (
          <div
            key={team.id}
            className="relative bg-[#232323] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-red-700 overflow-hidden p-6 text-center"
          >
            {/* Rank Badge */}
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r from-red-700 to-red-900 text-red-100">
                #{team.rank}
              </span>
            </div>
            {/* Team Logo */}
            <div className="mx-auto mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 p-2 shadow-lg mx-auto">
                <Image
                  src={team.logo}
                  alt={`${team.name} logo`}
                  width={80}
                  height={80}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            {/* Team Name */}
            <Link
              href={`/roster?year=${year}&teamId=${team.id}`}
              className="block text-lg font-bold text-red-300 underline hover:text-red-100 transition mb-1"
            >
              {team.name}
            </Link>
            <div className="text-red-400 text-base font-normal mt-1">{team.record}</div>
            {/* Manager */}
            <p className="text-red-400 font-medium mb-2">
              <span className="text-red-300">Manager:</span>{" "}
              <Link
                href={`/manager?name=${encodeURIComponent(team.realManager)}`}
                className="underline text-red-200 hover:text-emerald-300 transition"
              >
                {team.manager}
              </Link>
            </p>
            {/* Badge */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-900 text-red-100 border border-red-700">
              Eliminated (#{team.rank})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}