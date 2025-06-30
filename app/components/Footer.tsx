'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-green-700 text-white text-center py-6 mt-auto">
      <p>&copy; {new Date().getFullYear()} The Bok Choy League. All rights reserved.</p>
    </footer>
  );
}
