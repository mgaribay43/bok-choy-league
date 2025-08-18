'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Trophy, Users, Calendar, Award, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useRouter } from 'next/navigation';

let leagueTimeout: NodeJS.Timeout;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLeagueOpen, setIsLeagueOpen] = useState(false);
  const [isNameHovered, setIsNameHovered] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', isOpen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [isOpen]);

  if (loading) return null;

  const userDisplay = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email?.split('@')[0];

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-emerald-700 to-teal-700 shadow-lg transition-all duration-300 w-screen">
      <div className="w-full px-2 sm:px-4 lg:px-0">
        <div className="flex justify-between items-center h-16 lg:h-18">
          {/* Logo */}
          <Link href="/" className="group" onClick={() => setIsOpen(false)}>
            <div className="flex items-center space-x-3">
              <div className="relative">
                {/* Removed hover effect from emoji */}
                <div className="text-3xl">🥬</div>
                {/* Removed the animated background as well */}
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-white group-hover:text-emerald-100 transition-colors duration-200">
                  The Bok Choy League
                </h1>
                <p className="text-xs text-emerald-200 font-medium hidden sm:block">Fantasy Football</p>
              </div>
            </div>
          </Link>

          {!user ? (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-all duration-200 font-medium"
            >
              Sign In
            </Link>
          ) : (
            <>
              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-2">
                <NavLink href="/champions" icon={<Trophy size={18} />} text="Champions" />
                <NavLink href="/rules" icon={<Award size={18} />} text="Rules" />
                <NavLink href="/events" icon={<Calendar size={18} />} text="Events" />
                <NavLink href="/ices" icon={<span className="text-lg">🧊</span>} text="Ices" />

                {/* League Dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => {
                    clearTimeout(leagueTimeout);
                    setIsLeagueOpen(true);
                  }}
                  onMouseLeave={() => {
                    leagueTimeout = setTimeout(() => setIsLeagueOpen(false), 100);
                  }}
                >
                  <button
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium"
                    tabIndex={0}
                    aria-haspopup="true"
                    aria-expanded={isLeagueOpen}
                  >
                    <Users size={18} />
                    <span>League</span>
                    <ChevronUp size={16} className={`${isLeagueOpen ? 'rotate-180' : ''} transition-transform duration-200`} />
                  </button>
                  <div
                    className={`absolute right-0 top-full mt-2 w-56 transition-all duration-200 transform ${
                      isLeagueOpen
                        ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                        : 'opacity-0 invisible translate-y-2 pointer-events-none'
                    }`}
                  >
                    <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden backdrop-blur-sm">
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-emerald-100">
                        <p className="text-sm font-semibold text-emerald-800">League</p>
                      </div>
                      <div className="py-2">
                        <DropdownLink href="/standings" icon={<Trophy size={16} className="text-yellow-600" />} text="Standings" bg="bg-yellow-100" />
                        <DropdownLink href="/draft" icon={<span className="text-purple-600 text-sm font-bold">📋</span>} text="Draft Results" bg="bg-purple-100" />
                        <DropdownLink href="/keepers" icon={<span className="text-orange-600 text-sm font-bold">🔒</span>} text="Keeper Utility" bg="bg-orange-100" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Name */}
                <div
                  className="ml-6 px-4 py-2 rounded-xl text-white font-semibold relative cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setIsNameHovered(true)}
                  onMouseLeave={() => setIsNameHovered(false)}
                >
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isNameHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                  >
                    <button
                      onClick={async () => {
                        await signOut(auth);
                        router.replace('/login');
                      }}
                      className="flex items-center justify-center px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-all duration-200 whitespace-nowrap min-w-[90px]"
                    >
                      Sign Out
                    </button>
                  </div>
                  <span
                    className={`transition-opacity duration-300 ${isNameHovered ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
                  >
                    {userDisplay}
                  </span>
                </div>
              </div>

              {/* Mobile Hamburger */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden relative w-10 h-10 flex items-center justify-center transition-all duration-200"
                aria-label="Toggle Menu"
              >
                <div className="relative w-6 h-6">
                  <span className={`block absolute left-0 w-6 h-0.5 bg-white rounded transition-transform transition-opacity duration-300 ${isOpen ? 'rotate-45 translate-y-3' : 'rotate-0 translate-y-1'}`} />
                  <span className={`block absolute left-0 w-6 h-0.5 bg-white rounded transition-opacity transition-transform duration-300 ${isOpen ? 'opacity-0' : 'opacity-100 translate-y-3'}`} />
                  <span className={`block absolute left-0 w-6 h-0.5 bg-white rounded transition-transform transition-opacity duration-300 ${isOpen ? '-rotate-45 translate-y-3' : 'rotate-0 translate-y-5'}`} />
                </div>
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        {user && (
          <div className={`md:hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen opacity-100 pb-6' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl mt-4 overflow-hidden border border-white/20">
              <div className="px-4 py-4 text-white font-bold text-lg border-b border-white/10 bg-emerald-700/80">{userDisplay}</div>
              
              {/* League Section - moved to top */}
              <div className="border-b border-white/10">
                <button
                  onClick={() => setIsLeagueOpen(!isLeagueOpen)}
                  className="flex items-center justify-between w-full px-4 py-4 text-white hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Users size={20} />
                    <span className="font-medium">League</span>
                  </div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isLeagueOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`transition-all duration-200 ${isLeagueOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden py-0`}>
                  <div className="flex flex-col">
                    <Link
                      href="/standings"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-white hover:bg-white/20 transition-colors border-b border-white/10"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-yellow-500/20 rounded">
                        <Trophy size={16} />
                      </div>
                      <span className="font-medium">Standings</span>
                    </Link>
                    <Link
                      href="/draft"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-white hover:bg-white/20 transition-colors border-b border-white/10"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-purple-500/20 rounded">
                        <span className="text-xs">📋</span>
                      </div>
                      <span className="font-medium">Draft Results</span>
                    </Link>
                    <Link
                      href="/keepers"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-white hover:bg-white/20 transition-colors border-b border-white/10"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-orange-500/20 rounded">
                        <span className="text-xs">🔒</span>
                      </div>
                      <span className="font-medium">Keeper Utility</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Other mobile links */}
              <MobileLink href="/champions" icon={<Trophy size={20} className="text-yellow-300" />} text="Hall of Champions" closeMenu={() => setIsOpen(false)} />
              <MobileLink href="/rules" icon={<Award size={20} />} text="Rules" closeMenu={() => setIsOpen(false)} />
              <MobileLink href="/events" icon={<Calendar size={20} />} text="Events" closeMenu={() => setIsOpen(false)} />
              <MobileLink href="/ices" icon={<span className="text-xl">🧊</span>} text="Ices" closeMenu={() => setIsOpen(false)} />

              {/* Sign Out Button (mobile) */}
              <div className="px-4 py-4">
                <button
                  onClick={async () => {
                    await signOut(auth);
                    router.replace('/login');
                  }}
                  className="w-full px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-all duration-200 whitespace-nowrap"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating mobile menu button */}
        <button
          type="button"
          className={`fixed bottom-6 right-6 z-50 md:hidden bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
          aria-label={isOpen ? "Close Menu" : "Open Menu"}
          onClick={() => setIsOpen((prev) => !prev)}
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
        >
          <span className="relative w-6 h-6 flex items-center justify-center">
            {/* Top bar */}
            <span
              className={`absolute w-6 h-0.5 bg-white rounded transition-all duration-300
                ${isOpen ? 'rotate-45 top-2.5' : 'rotate-0 top-1'}
              `}
            />
            {/* Middle bar */}
            <span
              className={`absolute w-6 h-0.5 bg-white rounded transition-all duration-300
                ${isOpen ? 'opacity-0' : 'opacity-100 top-3'}
              `}
            />
            {/* Bottom bar */}
            <span
              className={`absolute w-6 h-0.5 bg-white rounded transition-all duration-300
                ${isOpen ? '-rotate-45 top-2.5' : 'rotate-0 top-5'}
              `}
            />
          </span>
        </button>
      </div>
    </nav>
  );
}

// Desktop NavLink
function NavLink({ href, icon, text }: { href: string; icon: React.ReactNode; text: string }) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium"
    >
      {icon}
      <span>{text}</span>
    </Link>
  );
}

// Desktop Dropdown Link
function DropdownLink({ href, icon, text, bg }: { href: string; icon: React.ReactNode; text: string; bg: string }) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors duration-150"
    >
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
      <span className="font-medium">{text}</span>
    </Link>
  );
}

// Mobile NavLink
function MobileLink({
  href,
  icon,
  text,
  closeMenu,
  extraIconBg,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
  closeMenu: () => void;
  extraIconBg?: string;
}) {
  return (
    <Link
      href={href}
      onClick={closeMenu}
      className="flex items-center space-x-3 px-4 py-4 text-white hover:bg-white/20 transition-colors border-b border-white/10"
    >
      <div className={`w-6 h-6 rounded flex items-center justify-center ${extraIconBg ?? ''}`}>{icon}</div>
      <span className="font-medium">{text}</span>
    </Link>
  );
}