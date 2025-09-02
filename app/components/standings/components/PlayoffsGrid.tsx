'use client';

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamEntry } from "../utils/standingsUtils";

export default function PlayoffsGrid({
  year,
  teams,
}: {
  year: string;
  teams: TeamEntry[];
}) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold text-emerald-200 mb-4 text-center">Playoff Teams</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
        {teams.map(team => (
          <div
            key={team.id}
            className="relative bg-[#232323] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-emerald-700 overflow-hidden p-6 text-center"
          >
            {/* Rank Badge */}
            <div className="absolute top-4 left-4 z-10">
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg
                ${team.rank === 2
                  ? "bg-gradient-to-r from-slate-700 to-slate-900 text-emerald-100"
                  : team.rank === 3
                    ? "bg-gradient-to-r from-amber-700 to-yellow-900 text-yellow-100"
                    : "bg-gradient-to-r from-emerald-700 to-emerald-900 text-emerald-100"
              }`}>
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
              className="block text-lg font-bold text-emerald-200 underline hover:text-emerald-100 transition mb-1"
            >
              {team.name}
            </Link>
            <div className="text-emerald-400 text-base font-normal mt-1">{team.record}</div>
            {/* Manager */}
            <p className="text-emerald-400 font-medium mb-2">
              <span className="text-emerald-300">Manager:</span>{" "}
              <Link
                href={`/manager?name=${encodeURIComponent(team.realManager)}`}
                className="underline text-emerald-200 hover:text-emerald-100 transition"
              >
                {team.manager}
              </Link>
            </p>
            {/* Badge */}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
              ${team.rank === 2
                ? "bg-slate-800 text-emerald-100 border border-slate-700"
                : team.rank === 3
                  ? "bg-amber-900 text-yellow-100 border border-amber-700"
                  : "bg-emerald-900 text-emerald-100 border border-emerald-700"
            }`}>
              {team.rank === 2
                ? "🥈 Runner-up"
                : team.rank === 3
                  ? "🥉 Third Place"
                  : `Playoffs (#${team.rank})`
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}