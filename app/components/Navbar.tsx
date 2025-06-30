'use client';

import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-green-700 text-white shadow-md">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold cursor-default">🥬 The Bok Choy League</h1>
        <ul className="flex space-x-6 text-lg">
          <li>
            <a href="#about" className="hover:underline">About</a>
          </li>
          <li>
            <Link href="/teams" className="hover:underline">Teams</Link>
          </li>
          <li>
            <Link href="/record-book" className="hover:underline">Record Book</Link>
          </li>
          <li>
            <a href="#contact" className="hover:underline">Contact</a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
