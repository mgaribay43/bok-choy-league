'use client'; // Ensure this file is treated as a Client Component

import './globals.css';
import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../context/AuthContext'; // Import useAuth
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const AuthCheck = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth(); // Access user state from AuthContext
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false); // To prevent multiple redirects

  useEffect(() => {
    if (!user && !loading && !redirecting) {
      const currentPath = window.location.pathname;
      setRedirecting(true); // Prevent multiple redirects
      router.push(`/login?redirect=${currentPath}`); // Pass the current path as a redirect
    }
  }, [user, loading, redirecting, router]);

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

  return <>{children}</>; // Render the page content if the user is authenticated
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
