'use client';

import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-green-700 text-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/"><h1 className="text-2xl font-bold">🥬 The Bok Choy League</h1></Link>
        <ul className="flex space-x-6 text-lg">
          <li><Link href="/teams" className="hover:underline">Teams</Link></li>
          <li><Link href="/record-book" className="hover:underline">Record Book</Link></li>
          <li><Link href="/champions" className="hover:underline">Hall of Champions</Link></li>
        </ul>
      </div>
    </nav>
  );
}

