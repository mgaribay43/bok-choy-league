'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full bg-gradient-to-r from-[#181818] to-[#232323] text-emerald-100 text-center py-6 mt-auto shadow-lg border-t border-[#232323] dark:bg-gradient-to-r dark:from-[#181818] dark:to-[#232323] dark:text-emerald-100">
      <p className="text-sm font-medium tracking-wide">
        &copy; {new Date().getFullYear()} The Bok Choy League. All rights reserved.
      </p>
    </footer>
  );
}
