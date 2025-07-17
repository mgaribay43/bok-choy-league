'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLeagueOpen, setIsLeagueOpen] = useState(false); // Submenu toggle for mobile

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => {
    setIsOpen(false);
    setIsLeagueOpen(false);
  };

  return (
    <nav className="bg-green-700 text-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" onClick={closeMenu}>
          <h1 className="text-2xl font-bold">🥬 The Bok Choy League</h1>
        </Link>

        {/* Hamburger Toggle */}
        <div className="md:hidden">
          <button onClick={toggleMenu} aria-label="Toggle Menu">
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Nav Links */}
        <ul
          className={`${isOpen ? 'block' : 'hidden'
            } md:flex md:space-x-6 text-lg absolute md:static top-full left-0 w-full md:w-auto bg-green-700 md:bg-transparent px-6 md:px-0 py-4 md:py-0`}
        >
          {/* Other Links */}
          <li>
            <Link href="/champions" onClick={closeMenu} className="hover:underline block py-2 md:py-0">
              Hall of Champions
            </Link>
          </li>
          <li>
            <Link href="/rules" onClick={closeMenu} className="hover:underline block py-2 md:py-0">
              Rules
            </Link>
          </li>
          <li>
            <Link href="/events" onClick={closeMenu} className="hover:underline block py-2 md:py-0">
              Events
            </Link>
          </li>
          <li>
            <Link href="/ices" onClick={closeMenu} className="hover:underline block py-2 md:py-0">
              Ices
            </Link>
          </li>

          {/* League Dropdown */}
          <li className="relative group">
            <button
              className="flex items-center gap-1 hover:underline py-2 md:py-0"
              onClick={() => setIsLeagueOpen(!isLeagueOpen)}
            >
              League <ChevronDown size={16} />
            </button>

            <ul
              className={`pl-4 md:absolute md:left-0 md:top-full md:bg-green-800 md:rounded md:shadow-md md:min-w-[160px] ${isLeagueOpen || isOpen ? 'block' : 'hidden'
                } md:group-hover:block`}
            >
              <li>
                <Link
                  href="/standings"
                  onClick={closeMenu}
                  className="block px-4 py-2 hover:bg-green-600"
                >
                  Standings
                </Link>
              </li>
              <li>
                <Link
                  href="/matchups"
                  onClick={closeMenu}
                  className="block px-4 py-2 hover:bg-green-600"
                >
                  Matchups
                </Link>
              </li>
              <li>
                <Link
                  href="/draft"
                  onClick={closeMenu}
                  className="block px-4 py-2 hover:bg-green-600"
                >
                  Draft Results
                </Link>
              </li>
              <li>
                <Link
                  href="/keepers"
                  onClick={closeMenu}
                  className="block px-4 py-2 hover:bg-green-600"
                >
                  Keepers
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  );
}
