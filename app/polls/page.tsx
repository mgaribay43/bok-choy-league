'use client';

import Pollster from '@/app/components/Poll';

export default function LeagueRulesPage() {
  return (
    <div className="min-h-screen py-10 px-6">
      <h1 className="text-4xl font-bold text-center text-[#a7f3d0] mb-6">Bok Choy League Polls</h1>
      <Pollster />
    </div>
  );
}
