'use client';

import React from 'react';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <main className=" container mx-auto px-6 pt-16 pb-8 text-center">
      <h2 className="text-5xl font-extrabold text-green-900 mb-6 drop-shadow">
        Welcome to the Bok Choy League
      </h2>
      <p className="max-w-3xl mx-auto text-green-800 text-lg md:text-xl mb-12">
        The Bok Choy League is where fantasy football gets serious — and fun. Each week, teams go
        head-to-head in a battle of strategy, luck, and bragging rights. Dive in, track your team,
        relive the highlights, and celebrate every win with the Bok Choy crew.
      </p>

      <Link
        href="/standings"
        className="inline-block bg-green-700 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg hover:bg-green-800 transition"
      >
        Current Standings
      </Link>
    </main>
  );
}
