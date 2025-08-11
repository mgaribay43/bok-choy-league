'use client';

import './globals.css';
import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const AuthCheck = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!user && !loading && !hasRedirected) {
      const currentPath = window.location.pathname;
      setHasRedirected(true);
      router.push(`/login?redirect=${currentPath}`);
    }
  }, [user, loading, hasRedirected, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
        <p className="text-slate-600 text-lg mt-6 font-medium">Loading BokChoyLeague...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthCheck>
            <div className="flex flex-col min-h-screen bg-green-50">
              <Navbar />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
          </AuthCheck>
        </AuthProvider>
      </body>
    </html>
  );
}
