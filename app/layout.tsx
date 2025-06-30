import './globals.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'The Bok Choy League',
  description: 'Fantasy football with flavor',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-green-50">
        <Navbar />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
