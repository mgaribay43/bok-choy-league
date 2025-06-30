'use client';

import React from 'react';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <main className="flex-grow container mx-auto px-6 py-16 text-center">
      <h2 className="text-5xl font-extrabold text-green-900 mb-6 drop-shadow">
        Welcome to The Bok Choy League
      </h2>
      <p className="max-w-3xl mx-auto text-green-800 text-lg md:text-xl mb-12">
        The ultimate fantasy football league where strategy meets passion. Join us as we battle
        weekly to crown the best team in the league. Track your progress, view records, and
        celebrate your victories with fellow Bok Choy enthusiasts!
      </p>

      <Link
        href="../teams.tsx"
        className="inline-block bg-green-700 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg hover:bg-green-800 transition"
      >
        Explore Teams
      </Link>
    </main>
  );
}
