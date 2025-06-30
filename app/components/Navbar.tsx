'use client';

import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-green-700 text-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <a href="/"><h1 className="text-2xl font-bold">🥬 The Bok Choy League</h1></a>
        <ul className="flex space-x-6 text-lg">
          <li><a href="/teams" className="hover:underline">Teams</a></li>
          <li><a href="/record-book" className="hover:underline">Record Book</a></li>
          <li><a href="/champions" className="hover:underline">Hall of Champions</a></li>
        </ul>
      </div>
    </nav>
  );
}

