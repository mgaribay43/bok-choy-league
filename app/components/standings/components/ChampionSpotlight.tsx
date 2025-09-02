'use client';

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamEntry } from "../utils/standingsUtils";
import { getTrophyUrl } from "../utils/standingsUtils";

export default function ChampionSpotlight({
  year,
  teams,
}: {
  year: string;
  teams: TeamEntry[];
}) {
  const champion = teams[0];
  if (!champion || year === "2025") return null;
  return (
    <div className="mb-12">
      {/* Champion Card */}
      <div className="relative bg-gradient-to-br from-yellow-900 via-yellow-800 to-amber-900 border-2 border-yellow-700 rounded-3xl shadow-2xl p-8 max-w-lg mx-auto transform hover:scale-105 transition-all duration-300 overflow-hidden">
        {/* Trophy in top left */}
        <div className="absolute top-4 left-4 z-20">
          <Image
            src={getTrophyUrl(1, year) ?? ""}
            alt="Champion Trophy"
            width={96}
            height={96}
            className="mx-auto"
          />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-700 to-yellow-900 p-2 shadow-2xl mb-4">
            <Image
              src={champion.logo}
              alt={`${champion.name} logo`}
              width={112}
              height={112}
              className="w-full h-full rounded-full object-cover border-4 border-[#232323] shadow-lg"
            />
          </div>
          <Link
            href={`/roster?year=${year}&teamId=${champion.id}`}
            className="text-2xl font-bold text-yellow-300 mb-2 underline hover:text-yellow-200 transition-colors"
          >
            {champion.name}
          </Link>
          <div className="text-yellow-200 text-lg font-normal mt-1">{champion.record}</div>
          <p className="text-yellow-200 font-medium">
            Champion:{" "}
            <Link
              href={`/manager?name=${encodeURIComponent(champion.realManager)}`}
              className="font-bold text-yellow-100 underline hover:text-emerald-300 transition"
            >
              {champion.manager}
            </Link>
          </p>
        </div>
      </div>

      {/* Runner-up & Third Place Cards */}
      <div className="flex flex-col sm:flex-row justify-center gap-8 mt-8">
        {/* Runner-up (2nd place) */}
        {teams[1] && (
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-slate-700 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto sm:mx-0 transform hover:scale-105 transition-all duration-300 overflow-hidden">
            {/* Trophy in top left */}
            <div className="absolute top-4 left-4 z-20">
              <Image
                src={getTrophyUrl(2, year) ?? ""}
                alt="Runner-up Trophy"
                width={84}
                height={84}
                className="mx-auto"
              />
            </div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 p-2 shadow-xl mb-2">
                <Image
                  src={teams[1].logo}
                  alt={`${teams[1].name} logo`}
                  width={80}
                  height={80}
                  className="w-full h-full rounded-full object-cover border-4 border-[#232323] shadow-lg"
                />
              </div>
              <Link
                href={`/roster?year=${year}&teamId=${teams[1].id}`}
                className="text-xl font-bold text-emerald-200 mb-1 underline hover:text-emerald-100 transition-colors"
              >
                {teams[1].name}
              </Link>
              <div className="text-emerald-400 text-base font-normal mt-1">{teams[1].record}</div>
              <p className="text-emerald-300 font-medium">
                Runner-up:{" "}
                <Link
                  href={`/manager?name=${encodeURIComponent(teams[1].realManager)}`}
                  className="font-bold underline text-emerald-100 hover:text-yellow-200 transition"
                >
                  {teams[1].manager}
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Third Place (3rd place) */}
        {teams[2] && (
          <div className="relative bg-gradient-to-br from-amber-900 via-yellow-900 to-yellow-800 border-2 border-amber-700 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto sm:mx-0 transform hover:scale-105 transition-all duration-300 overflow-hidden">
            {/* Trophy in top left */}
            <div className="absolute top-4 left-4 z-20">
              <Image
                src={getTrophyUrl(3, year) ?? ""}
                alt="Third Place Trophy"
                width={84}
                height={84}
                className="mx-auto"
              />
            </div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-700 to-yellow-900 p-2 shadow-xl mb-2">
                <Image
                  src={teams[2].logo}
                  alt={`${teams[2].name} logo`}
                  width={80}
                  height={80}
                  className="w-full h-full rounded-full object-cover border-4 border-[#232323] shadow-lg"
                />
              </div>
              <Link
                href={`/roster?year=${year}&teamId=${teams[2].id}`}
                className="text-xl font-bold text-yellow-200 mb-1 underline hover:text-yellow-100 transition-colors"
              >
                {teams[2].name}
              </Link>
              <div className="text-yellow-200 text-base font-normal mt-1">{teams[2].record}</div>
              <p className="text-yellow-200 font-medium">
                Third Place:{" "}
                <Link
                  href={`/manager?name=${encodeURIComponent(teams[2].realManager)}`}
                  className="font-bold underline text-yellow-100 hover:text-emerald-300 transition"
                >
                  {teams[2].manager}
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}