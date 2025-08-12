'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Trophy, Users, Calendar, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLeagueOpen, setIsLeagueOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isNameHovered, setIsNameHovered] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => {
    setIsOpen(false);
    setIsLeagueOpen(false);
  };

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Don't render anything until auth state is resolved
  if (loading) return null;

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled
        ? 'bg-gradient-to-r from-emerald-800/95 to-teal-800/95 backdrop-blur-md shadow-2xl'
        : 'bg-gradient-to-r from-emerald-700 to-teal-700 shadow-lg'
      }`}>
      <div className="container mx-auto px-4 lg:px-6 max-w-none">
        <div className="flex w-full items-center h-16 lg:h-18">
          {/* Logo */}
          <div>
            <Link href="/" onClick={closeMenu} className="group">
              <div className="flex flex-row items-center space-x-3">
                <div className="relative">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-200">
                    🥬
                  </div>
                  <div className="absolute inset-0 bg-white/20 rounded-full scale-0 group-hover:scale-150 transition-transform duration-300 -z-10" />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-white group-hover:text-emerald-100 transition-colors duration-200 whitespace-nowrap">
                    The Bok Choy League
                  </h1>
                  <p className="text-xs text-emerald-200 font-medium hidden sm:block">
                    Fantasy Football
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation and user section */}
          <div className="flex-1 flex items-center justify-end">
            {/* If not logged in, show only Sign In */}
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
                <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
                  {/* Main Links */}
                  <Link
                    href="/champions"
                    className="group flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium"
                  >
                    <Trophy size={18} className="group-hover:text-yellow-300 transition-colors" />
                    <span>Champions</span>
                  </Link>

                  <Link
                    href="/rules"
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium"
                  >
                    <Award size={18} />
                    <span>Rules</span>
                  </Link>

                  <Link
                    href="/events"
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium"
                  >
                    <Calendar size={18} />
                    <span>Events</span>
                  </Link>

                  <Link
                    href="/ices"
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium"
                  >
                    <span className="text-lg">🧊</span>
                    <span>Ices</span>
                  </Link>

                  {/* League Dropdown */}
                  <div className="relative group">
                    <button className="flex items-center space-x-2 px-4 py-2 rounded-xl text-white hover:bg-white/20 hover:text-emerald-100 transition-all duration-200 font-medium">
                      <Users size={18} />
                      <span>League</span>
                      <ChevronDown size={16} className="group-hover:rotate-180 transition-transform duration-200" />
                    </button>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
                      <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden backdrop-blur-sm">
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-emerald-100">
                          <p className="text-sm font-semibold text-emerald-800">League</p>
                        </div>

                        <div className="py-2">
                          <Link
                            href="/standings"
                            className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors duration-150"
                          >
                            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                              <Trophy size={16} className="text-yellow-600" />
                            </div>
                            <span className="font-medium">Standings</span>
                          </Link>

                          <Link
                            href="/draft"
                            className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors duration-150"
                          >
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                              <span className="text-purple-600 text-sm font-bold">📋</span>
                            </div>
                            <span className="font-medium">Draft Results</span>
                          </Link>

                          <Link
                            href="/keepers"
                            className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors duration-150"
                          >
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                              <span className="text-orange-600 text-sm font-bold">🔒</span>
                            </div>
                            <span className="font-medium">Keeper Utility</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* User Name */}
                <div
                  className="ml-6 px-4 py-2 rounded-xl text-white font-semibold relative cursor-pointer transition-all duration-300 hidden md:block"
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
                    {user.displayName 
                      ? user.displayName.split(' ')[0] 
                      : user.email?.split('@')[0]}
                  </span>
                </div>
                {/* Mobile Hamburger */}
                <button
                  onClick={toggleMenu}
                  className="md:hidden relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all duration-200"
                  aria-label="Toggle Menu"
                >
                  <div className="relative">
                    {isOpen ? (
                      <X size={24} className="text-white" />
                    ) : (
                      <Menu size={24} className="text-white" />
                    )}
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && (
          <div className={`md:hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen opacity-100 pb-6' : 'max-h-0 opacity-0 overflow-hidden'
            }`}>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl mt-4 overflow-hidden border border-white/20">
              {/* User Name Header (mobile) */}
              <div className="px-4 py-4 text-white font-bold text-lg border-b border-white/10 bg-emerald-700/80">
                {user.displayName 
                  ? user.displayName.split(' ')[0] 
                  : user.email?.split('@')[0]}
              </div>
              {/* Main Links */}
              <Link
                href="/champions"
                onClick={closeMenu}
                className="flex items-center space-x-3 px-4 py-4 text-white hover:bg-white/20 transition-colors border-b border-white/10"
              >
                <Trophy size={20} className="text-yellow-300" />
                <span className="font-medium">Hall of Champions</span>
              </Link>
              <Link
                href="/rules"
                onClick={closeMenu}
                className="flex items-center space-x-3 px-4 py-4 text-white hover:bg-white/20 transition-colors border-b border-white/10"
              >
                <Award size={20} />
                <span className="font-medium">Rules</span>
              </Link>
              <Link
                href="/events"
                onClick={closeMenu}
                className="flex items-center space-x-3 px-4 py-4 text-white hover:bg-white/20 transition-colors border-b border-white/10"
              >
                <Calendar size={20} />
                <span className="font-medium">Events</span>
              </Link>
              <Link
                href="/ices"
                onClick={closeMenu}
                className="flex items-center space-x-3 px-4 py-4 text-white hover:bg-white/20 transition-colors border-b border-white/10"
              >
                <span className="text-xl">🧊</span>
                <span className="font-medium">Ices</span>
              </Link>
              {/* League Section */}
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
                <div className={`transition-all duration-200 ${isLeagueOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  <div className="bg-white/5 py-2">
                    <Link
                      href="/standings"
                      onClick={closeMenu}
                      className="flex items-center space-x-3 px-8 py-3 text-emerald-100 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <div className="w-6 h-6 bg-yellow-500/20 rounded flex items-center justify-center">
                        <Trophy size={12} />
                      </div>
                      <span>Standings</span>
                    </Link>
                    <Link
                      href="/draft"
                      onClick={closeMenu}
                      className="flex items-center space-x-3 px-8 py-3 text-emerald-100 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                        <span className="text-xs">📋</span>
                      </div>
                      <span>Draft Results</span>
                    </Link>
                    <Link
                      href="/keepers"
                      onClick={closeMenu}
                      className="flex items-center space-x-3 px-8 py-3 text-emerald-100 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <div className="w-6 h-6 bg-orange-500/20 rounded flex items-center justify-center">
                        <span className="text-xs">🔒</span>
                      </div>
                      <span>Keepers</span>
                    </Link>
                  </div>
                </div>
              </div>
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
      </div>
    </nav>
  );
}