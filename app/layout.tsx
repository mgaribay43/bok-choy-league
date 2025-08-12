'use client';

import './globals.css';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthCheck from './components/AuthCheck'; // Move AuthCheck to its own file for clarity

const UNPROTECTED_ROUTES = ['/login'];

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isUnprotected = UNPROTECTED_ROUTES.includes(pathname);

  return (
    <html>
      <body>
        <AuthProvider>
          {isUnprotected ? (
            <div className="flex flex-col min-h-screen bg-green-50">
              <Navbar />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
          ) : (
            <AuthCheck>
              <div className="flex flex-col min-h-screen bg-green-50">
                <Navbar />
                <main className="flex-grow">{children}</main>
                <Footer />
              </div>
            </AuthCheck>
          )}
        </AuthProvider>
      </body>
    </html>
  );
}