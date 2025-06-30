'use client';

import 'react-responsive-carousel/lib/styles/carousel.min.css';
import React from 'react';
import { Carousel } from 'react-responsive-carousel';
import Image from 'next/image';

const champions = [
  { year: 2017, team: 'The Choy Bois', img: '/images/champions/2017.jpg' },
  { year: 2018, team: 'End My Suffering!', img: '/images/champions/2018.jpg' },
  { year: 2019, team: 'Sandusky Tight Ends', img: '/images/champions/2019.jpg' },
  { year: 2020, team: 'Tossin’ Heat', img: '/images/champions/2020.jpg' },
  { year: 2021, team: 'Tossin’ Heat', img: '/images/champions/2021.jpg' },
  { year: 2022, team: 'Rebuild Year ⏳😈', img: '/images/champions/2022.jpg' },
  { year: 2023, team: `Let's Get *Redacted* in Here`, img: '/images/champions/2023.jpg' },
  { year: 2024, team: 'Bottom of the Pool', img: '/images/champions/2024.jpg' },
];

export default function ChampionsPage() {
  return (
    <div className="min-h-screen bg-green-50 py-12 px-6">
      <h1 className="text-4xl font-extrabold text-green-800 text-center mb-10">
        🏆 Bok Choy League Champions
      </h1>

      <div className="max-w-3xl mx-auto">
        <Carousel
          showThumbs={false}
          showStatus={false}
          infiniteLoop
          useKeyboardArrows
          autoPlay
          interval={5000}
          dynamicHeight={false}
        >
          {champions.map((champ) => (
            <div key={champ.year} className="relative">
              <Image
                src={champ.img}
                alt={`${champ.year} Champion: ${champ.team}`}
                width={800}
                height={500}
                className="rounded-lg object-cover mx-auto"
              />
              <p className="legend text-lg font-semibold">
                {champ.year} – {champ.team}
              </p>
            </div>
          ))}
        </Carousel>
      </div>
    </div>
  );
}
