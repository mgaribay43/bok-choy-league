'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Trophy, Users, Calendar, Award, ChevronUp, Clipboard, BarChart2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useRouter } from 'next/navigation';
import Image from "next/image";

let leagueTimeout: NodeJS.Timeout;
let analyzerTimeout: NodeJS.Timeout;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLeagueOpen, setIsLeagueOpen] = useState(false);
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
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
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-[#181818] to-[#232323] shadow-lg transition-all duration-300 w-screen">
      <div className="w-full px-2 sm:px-4 lg:px-0">
        <div className="flex justify-between items-center h-16 lg:h-18">
          {/* Logo */}
          <div className="flex items-center space-x-3 ml-2">
            <div className="relative">
              <a
                href="https://football.fantasysports.yahoo.com/f1/128797"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/yahoo_fantasy.png"
                  alt="Yahoo Fantasy Logo"
                  width={40}
                  height={40}
                  className="rounded-lg shadow"
                />
              </a>
            </div>
            <Link href="/" className="group" onClick={() => setIsOpen(false)}>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-emerald-100 group-hover:text-white transition-colors duration-200">
                  The Bok Choy League
                </h1>
                <p className="text-xs text-emerald-400 font-medium hidden sm:block">Fantasy Football</p>
              </div>
            </Link>
          </div>


          {!user ? (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-emerald-100 bg-emerald-700 hover:bg-emerald-800 transition-all duration-200 font-medium "
            >
              Sign In
            </Link>
          ) : (
            <>
              {/* Desktop Navigation: only show on xl and up */}
              <div className="hidden xl:flex items-center space-x-2">
                <NavLink href="/champions" icon={<Trophy size={18} />} text="Champions" />
                <NavLink href="/rules" icon={<Award size={18} />} text="Rules" />
                {/* Replace Events with Polls */}
                <NavLink href="/polls" icon={<span className="text-lg">📊</span>} text="Polls" />
                <NavLink href="/ices" icon={<span className="text-lg">🧊</span>} text="Ices" />
                {userDisplay === "Michael" && (
                  <NavLink href="/admin" icon={<span className="text-lg">🛡️</span>} text="Admin" />
                )}
                {/* League Analyzer Dropdown (duplicate of League dropdown, label changed) */}
                <div
                  className="relative"
                  onMouseEnter={() => {
                    clearTimeout(analyzerTimeout);
                    setIsAnalyzerOpen(true);
                  }}
                  onMouseLeave={() => {
                    analyzerTimeout = setTimeout(() => setIsAnalyzerOpen(false), 100);
                  }}
                >
                  <button
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-emerald-100 hover:bg-[#232323] hover:text-emerald-200 transition-all duration-200 font-medium"
                    tabIndex={0}
                    aria-haspopup="true"
                    aria-expanded={isAnalyzerOpen}
                  >
                    <Clipboard size={18} />
                    <span>Analysis</span>
                    <ChevronUp size={16} className={`${isAnalyzerOpen ? 'rotate-180' : ''} transition-transform duration-200`} />
                  </button>
                  <div
                    className={`absolute right-0 top-full mt-2 w-72 transition-all duration-200 transform ${isAnalyzerOpen
                      ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                      : 'opacity-0 invisible translate-y-2 pointer-events-none'
                      }`}
                  >
                    <div className="bg-[#232323] rounded-2xl shadow-2xl border border-[#333] overflow-hidden backdrop-blur-sm">
                      <div className="px-4 py-4 text-emerald-100 font-bold text-lg border-b border-[#333] bg-emerald-900/80 flex items-center gap-2">
                        <Clipboard size={20} />
                        League Analysis
                      </div>
                      <div className="flex flex-col">
                        <Link
                          href="/playoffOdds"
                          className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-yellow-900 rounded">
                            <BarChart2 size={16} />
                          </div>
                          <span className="font-medium">Playoff Odds</span>
                        </Link>
                        {/* Polls link removed from Analyzer dropdown */}
                      </div>
                    </div>
                  </div>
                </div>
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
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-emerald-100 hover:bg-[#232323] hover:text-emerald-200 transition-all duration-200 font-medium"
                    tabIndex={0}
                    aria-haspopup="true"
                    aria-expanded={isLeagueOpen}
                  >
                    <Users size={18} />
                    <span>League</span>
                    <ChevronUp size={16} className={`${isLeagueOpen ? 'rotate-180' : ''} transition-transform duration-200`} />
                  </button>
                  <div
                    className={`absolute right-0 top-full mt-2 w-72 transition-all duration-200 transform ${isLeagueOpen
                      ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                      : 'opacity-0 invisible translate-y-2 pointer-events-none'
                      }`}
                  >
                    <div className="bg-[#232323] rounded-2xl shadow-2xl border border-[#333] overflow-hidden backdrop-blur-sm">
                      <div className="px-4 py-4 text-emerald-100 font-bold text-lg border-b border-[#333] bg-emerald-900/80 flex items-center gap-2">
                        <Users size={20} />
                        League
                      </div>
                      <div className="flex flex-col">
                        <Link
                          href="/standings"
                          className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-yellow-900 rounded">
                            <Trophy size={16} />
                          </div>
                          <span className="font-medium">Standings</span>
                        </Link>
                        <Link
                          href="/matchups"
                          className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-cyan-900 rounded">
                            <span className="text-xs">🤝</span>
                          </div>
                          <span className="font-medium">Matchups</span>
                        </Link>
                        <Link
                          href="/draft"
                          className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-purple-900 rounded">
                            <span className="text-xs">📋</span>
                          </div>
                          <span className="font-medium">Draft Results</span>
                        </Link>
                        <Link
                          href="/keepers"
                          className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-orange-900 rounded">
                            <span className="text-xs">🔒</span>
                          </div>
                          <span className="font-medium">Keeper Utility</span>
                        </Link>
                        <Link
                          href="/manager"
                          className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-emerald-900 rounded">
                            <Users size={16} className="text-emerald-100" />
                          </div>
                          <span className="font-medium">Managers</span>
                        </Link>
                        {/* Polls link removed from League dropdown */}
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Name */}
                <div
                  className="ml-6 px-4 py-2 pr-10 rounded-xl text-emerald-100 font-semibold relative cursor-pointer transition-all duration-300"
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
                      className="flex items-center justify-center px-4 py-2 pr-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-all duration-200 whitespace-nowrap min-w-[90px]"
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

              {/* Mobile & Medium Hamburger: show for lg and below */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="xl:hidden relative w-10 h-10 flex items-center justify-center transition-all duration-200"
                aria-label="Toggle Menu"
              >
                <div className="relative w-6 h-6">
                  <span className={`block absolute left-0 w-6 h-0.5 bg-emerald-100 rounded transition-transform transition-opacity duration-300 ${isOpen ? 'rotate-45 translate-y-3' : 'rotate-0 translate-y-1'}`} />
                  <span className={`block absolute left-0 w-6 h-0.5 bg-emerald-100 rounded transition-opacity transition-transform duration-300 ${isOpen ? 'opacity-0' : 'opacity-100 translate-y-3'}`} />
                  <span className={`block absolute left-0 w-6 h-0.5 bg-emerald-100 rounded transition-transform transition-opacity duration-300 ${isOpen ? '-rotate-45 translate-y-3' : 'rotate-0 translate-y-5'}`} />
                </div>
              </button>
            </>
          )}
        </div>

        {/* Mobile & Medium Menu: show for lg and below */}
        {user && (
          <div
            className={`xl:hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen opacity-100 pb-6' : 'max-h-0 opacity-0 overflow-hidden'}`}
            style={{
              overflowY: isOpen ? 'auto' : 'hidden', // Enable vertical scrolling when open
              maxHeight: isOpen ? '80vh' : '0',      // Limit height for landscape screens
              WebkitOverflowScrolling: 'touch',      // Smooth scrolling on mobile
            }}
          >
            <div className="bg-[#232323] backdrop-blur-sm rounded-2xl mt-4 overflow-hidden border border-[#333]">
              <div className="px-4 py-4 text-emerald-100 font-bold text-lg border-b border-[#333] bg-emerald-900/80">{userDisplay}</div>

              {/* League Section - moved to top */}
              <div className="border-b border-[#333]">
                <button
                  onClick={() => setIsLeagueOpen(!isLeagueOpen)}
                  className="flex items-center justify-between w-full px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors"
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
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-yellow-900 rounded">
                        <Trophy size={16} />
                      </div>
                      <span className="font-medium">Standings</span>
                    </Link>
                    <Link
                      href="/matchups"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-cyan-900 rounded">
                        <span className="text-xs">🤝</span>
                      </div>
                      <span className="font-medium">Matchups</span>
                    </Link>
                    <Link
                      href="/draft"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-purple-900 rounded">
                        <span className="text-xs">📋</span>
                      </div>
                      <span className="font-medium">Draft Results</span>
                    </Link>
                    <Link
                      href="/keepers"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-orange-900 rounded">
                        <span className="text-xs">🔒</span>
                      </div>
                      <span className="font-medium">Keeper Utility</span>
                    </Link>
                    <Link
                      href="/manager"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 px-4 pl-8 h-10 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                    >
                      <div className="w-6 h-6 flex items-center justify-center bg-emerald-900 rounded">
                        <Users size={16} className="text-emerald-100" />
                      </div>
                      <span className="font-medium">Managers</span>
                    </Link>
                    {/* Polls link removed from League dropdown */}
                  </div>
                </div>
                {/* League Analyzer mobile section (duplicate of League mobile section) */}
                <div className="border-t border-[#333]">
                  <button
                    onClick={() => setIsAnalyzerOpen(!isAnalyzerOpen)}
                    className="flex items-center justify-between w-full px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Clipboard size={20} />
                      <span className="font-medium">Analysis</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isAnalyzerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`transition-all duration-200 ${isAnalyzerOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden py-0`}>
                    <div className="flex flex-col">
                      <Link
                        href="/playoffOdds"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center space-x-3 px-4 pl-8 h-10 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
                      >
                        <div className="w-6 h-6 flex items-center justify-center bg-yellow-900 rounded">
                          <BarChart2 size={16} />
                        </div>
                        <span className="font-medium">Playoff Odds</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other mobile links */}
              <MobileLink href="/champions" icon={<Trophy size={20} className="text-yellow-300" />} text="Hall of Champions" closeMenu={() => setIsOpen(false)} />
              <MobileLink href="/rules" icon={<Award size={20} />} text="Rules" closeMenu={() => setIsOpen(false)} />
              {/* Replace Events with Polls */}
              <MobileLink href="/polls" icon={<span className="text-xl">📊</span>} text="Polls" closeMenu={() => setIsOpen(false)} />
              <MobileLink href="/ices" icon={<span className="text-xl">🧊</span>} text="Ices" closeMenu={() => setIsOpen(false)} />
              {/* Admin Link for Michael (mobile) */}
              {userDisplay === "Michael" && (
                <MobileLink href="/admin" icon={<span className="text-xl">🛡️</span>} text="Admin" closeMenu={() => setIsOpen(false)} />
              )}

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

        {/* Floating mobile menu button: show for lg and below */}
        <button
          type="button"
          className={`fixed bottom-6 right-6 z-50 xl:hidden bg-[#181818] hover:bg-[#232323] text-emerald-100 rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
          aria-label={isOpen ? "Close Menu" : "Open Menu"}
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 0 16px 4px #34d39988'
          }}
        >
          <span className="relative w-6 h-6 flex items-center justify-center">
            {/* Top bar */}
            <span
              className={`absolute w-6 h-0.5 bg-emerald-400 rounded transition-all duration-300
                ${isOpen ? 'rotate-45 top-2.5' : 'rotate-0 top-1'}
              `}
            />
            {/* Middle bar */}
            <span
              className={`absolute w-6 h-0.5 bg-emerald-400 rounded transition-all duration-300
                ${isOpen ? 'opacity-0' : 'opacity-100 top-3'}
              `}
            />
            {/* Bottom bar */}
            <span
              className={`absolute w-6 h-0.5 bg-emerald-400 rounded transition-all duration-300
                ${isOpen ? '-rotate-45 top-2.5' : 'rotate-0 top-5'}
              `}
            />
          </span>
        </button>
      </div>
    </nav >
  );
}

// Desktop NavLink
function NavLink({ href, icon, text }: { href: string; icon: React.ReactNode; text: string }) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-2 px-4 py-2 rounded-xl text-emerald-100 hover:bg-[#232323] hover:text-emerald-200 transition-all duration-200 font-medium"
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
      className={`flex items-center space-x-3 px-4 py-3 text-emerald-100 hover:bg-emerald-900 hover:text-emerald-200 transition-colors duration-150 ${bg} rounded-lg`}
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
      className="flex items-center space-x-3 px-4 py-4 text-emerald-100 hover:bg-emerald-900 transition-colors border-b border-[#333]"
    >
      <div className={`w-6 h-6 rounded flex items-center justify-center ${extraIconBg ?? ''}`}>{icon}</div>
      <span className="font-medium">{text}</span>
    </Link>
  );
}