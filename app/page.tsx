import React from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import Footer from './components/Footer';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-green-50">
      <Navbar />
      <HeroSection />
      <Footer />
    </div>
  );
}
