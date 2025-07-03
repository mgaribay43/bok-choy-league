'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react'; // Optional: install lucide-react for icons

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="bg-green-700 text-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" onClick={closeMenu}>
          <h1 className="text-2xl font-bold">🥬 The Bok Choy League</h1>
        </Link>

        {/* Hamburger Toggle for Mobile */}
        <div className="md:hidden">
          <button onClick={toggleMenu} aria-label="Toggle Menu">
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Navigation Links */}
        <ul
          className={`${
            isOpen ? 'block' : 'hidden'
          } md:flex md:space-x-6 text-lg absolute md:static top-full left-0 w-full md:w-auto bg-green-700 md:bg-transparent px-6 md:px-0 py-4 md:py-0`}
        >
          <li><Link href="/standings" onClick={closeMenu} className="hover:underline block py-2 md:py-0">Standings</Link></li>
          <li><Link href="/ices" onClick={closeMenu} className="hover:underline block py-2 md:py-0">Ices</Link></li>
          <li><Link href="/champions" onClick={closeMenu} className="hover:underline block py-2 md:py-0">Hall of Champions</Link></li>
          <li><Link href="/keepers" onClick={closeMenu} className="hover:underline block py-2 md:py-0">Keepers</Link></li>
          <li><Link href="/rules" onClick={closeMenu} className="hover:underline block py-2 md:py-0">Rules</Link></li>
          <li><Link href="/events" onClick={closeMenu} className="hover:underline block py-2 md:py-0">Events</Link></li>
        </ul>
      </div>
    </nav>
  );
}
