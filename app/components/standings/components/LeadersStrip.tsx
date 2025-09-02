'use client';

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamEntry } from "../utils/standingsUtils";
import { getTrophyUrl } from "../utils/standingsUtils";

export default function LeadersStrip({
  year,
  teams,
  error,
  loading,
}: {
  year: string;
  teams: TeamEntry[];
  error: string | null;
  loading: boolean;
}) {
  const displayTeams = teams.slice(0, 3);

  return (
    <div className="w-full bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-5xl font-extrabold text-emerald-200 mb-8 text-center">
          <Link href={`/standings?year=${year}`} className="hover:underline transition">
            Leaders
          </Link>
        </h1>
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-900 border border-red-700 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-red-200 mb-2">Unable to Load Standings</h3>
              <p className="text-red-300">{error}</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          </div>
        )}
        {!loading && !error && (
          <div className="flex flex-row justify-center gap-4">
            {displayTeams.map((team, idx) => (
              <div key={team.id} className="group block">
                <div className={`flex flex-col items-center justify-center text-center bg-[#232323] rounded-xl shadow-md border px-4 py-6 min-w-[120px] max-w-[160px] h-auto min-h-[250px] transition-all duration-200 hover:shadow-lg hover:-translate-y-1
                  ${idx === 0 ? "border-yellow-400" : idx === 1 ? "border-slate-400" : "border-amber-700"}`}>
                  {/* Trophy Image - only show if year is not 2025 */}
                  {year !== "2025" && (
                    <div className="mb-2">
                      <Image
                        src={getTrophyUrl(idx + 1, year) ?? ""}
                        alt={`${idx + 1} Place Trophy`}
                        width={36}
                        height={36}
                        className="mx-auto"
                      />
                    </div>
                  )}
                  {/* Team Logo */}
                  <div className="mb-2">
                    <Link href={`/roster?year=${year}&teamId=${team.id}`}>
                      <Image
                        src={team.logo}
                        alt={`${team.name} logo`}
                        width={56}
                        height={56}
                        className="rounded-full object-cover border border-[#333] mx-auto"
                      />
                    </Link>
                  </div>
                  {/* Team Name */}
                  <h3 className={`text-sm font-semibold text-center break-words whitespace-normal
                    ${idx === 0 ? "text-yellow-300" : idx === 1 ? "text-emerald-200" : "text-amber-300"} mb-1`}
                    style={{ wordBreak: "break-word", whiteSpace: "normal" }}
                  >
                    <Link href={`/roster?year=${year}&teamId=${team.id}`}>
                      {team.name}
                    </Link>
                  </h3>
                  {/* Manager */}
                  <p
                    className="text-xs text-emerald-400 text-center break-words whitespace-normal w-full"
                    style={{ wordBreak: "break-word", whiteSpace: "normal" }}
                  >
                    <span
                      className="underline text-emerald-300 hover:text-emerald-400 transition cursor-pointer"
                      onClick={() => window.location.href = `/manager?name=${encodeURIComponent(team.realManager)}`}
                    >
                      {team.manager}
                    </span>
                  </p>
                  {/* Record */}
                  <div className="text-emerald-400 text-base font-normal mt-1">{team.record}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}