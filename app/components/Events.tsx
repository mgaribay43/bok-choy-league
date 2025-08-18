"use client";

import React, { useState, useEffect } from "react";
import eventsData from "../data/League_Events.json";
import Image from "next/image";

type Event = {
  id: number;
  name: string;
  date: string;
  location: string;
  description: string;
  image?: string;
};

const placeholderImage =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";

interface EventsProps {
  soonestOnly?: boolean;
  eventsSlideshow?: boolean;
}

function getSoonestEvent(events: Event[]): Event | undefined {
  // Assumes date is in MM-DD-YYYY format
  return [...events]
    .sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0];
}

// Slideshow component with smooth fade transition and 10s duration
function EventsSlideshow({ events }: { events: Event[] }) {
  const [current, setCurrent] = useState(0);
  const [isFading, setIsFading] = useState(false);

  // Touch state for swipe detection
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrent((prevIdx) => (prevIdx + 1) % events.length);
        setIsFading(false);
      }, 700);
    }, 10000);
    return () => clearInterval(interval);
  }, [events.length]);

  // Swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.changedTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.changedTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchEndX !== null) {
      const distance = touchEndX - touchStartX;
      if (Math.abs(distance) > 50) {
        setIsFading(true);
        setTimeout(() => {
          if (distance < 0) {
            setCurrent((prevIdx) => (prevIdx + 1) % events.length);
          } else {
            setCurrent((prevIdx) => (prevIdx - 1 + events.length) % events.length);
          }
          setIsFading(false);
        }, 700);
      }
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  if (events.length === 0) return null;

  const event = events[current];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-0">
      {/* Events header always rendered */}
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-green-800 mb-2 tracking-tight">
          League Events
        </h1>
        <p className="text-base text-gray-600">
          Stay up to date with all upcoming league activities and deadlines.
        </p>
      </header>
      <div
        className="relative h-[400px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={event.image ? event.image : placeholderImage}
          alt={event.name}
          fill
          className={`object-cover block absolute top-0 left-0 transition-opacity duration-700 ${isFading ? "opacity-0" : "opacity-100"}`}
          sizes="100vw"
        />
        <div className={`absolute bottom-0 left-0 w-full bg-black bg-opacity-70 text-white px-8 py-6 transition-opacity duration-700 ${isFading ? "opacity-0" : "opacity-100"}`}>
          <h2 className="text-3xl font-bold mb-2">{event.name}</h2>
          <p className="text-lg mb-1">
            <strong>Date:</strong> {event.date}
          </p>
          <p className="text-lg mb-1">
            <strong>Location:</strong> {event.location}
          </p>
          <p className="text-base">{event.description}</p>
        </div>
        {/* Centered slideshow dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {events.map((_, idx) => (
            <button
              key={idx}
              className={`w-3 h-3 rounded-full ${idx === current ? "bg-green-600" : "bg-gray-400"}`}
              onClick={() => {
                setIsFading(true);
                setTimeout(() => {
                  setCurrent(idx);
                  setIsFading(false);
                }, 700);
              }}
              aria-label={`Go to event ${idx + 1}`}
            />
          ))}
        </div>
        <a
          href={`/calendar/${event.name.replace(/\s+/g, "_")}.ics`}
          download={`${event.name.replace(/\s+/g, "_")}.ics`}
          className="absolute top-4 right-4 md:hidden bg-black text-white rounded-full p-2 shadow-lg hover:bg-green-800 transition"
          aria-label="Add to Apple Calendar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zm0-13H5V6h14v1z"/>
            <circle cx="7.5" cy="12.5" r="1.5"/>
            <circle cx="12" cy="12.5" r="1.5"/>
            <circle cx="16.5" cy="12.5" r="1.5"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

export default function Events({ soonestOnly = false, eventsSlideshow = false }: EventsProps) {
  const events: Event[] = eventsData.Events;

  if (eventsSlideshow) {
    return <EventsSlideshow events={events} />;
  }

  const eventsToRender = soonestOnly
    ? getSoonestEvent(events)
      ? [getSoonestEvent(events)!]
      : []
    : events;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-0">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-green-800 mb-2 tracking-tight">
          League Events
        </h1>
        {!soonestOnly && (
          <p className="text-base text-gray-600">
            Stay up to date with all upcoming league activities and deadlines.
          </p>
        )}
      </header>
      <div className="flex flex-col items-center gap-8">
        {eventsToRender.map((event) => (
          <div
            key={event.id}
            className="w-full max-w-2xl bg-white shadow-lg border border-gray-200 rounded-none mb-8 overflow-hidden"
          >
            <div className="relative h-[400px]">
              <Image
                src={event.image ? event.image : placeholderImage}
                alt={event.name}
                fill
                className="object-cover block"
                sizes="100vw"
              />
              <div className="absolute bottom-0 left-0 w-full bg-black bg-opacity-70 text-white px-8 py-6">
                <h2 className="text-3xl font-bold mb-2">{event.name}</h2>
                <p className="text-lg mb-1">
                  <strong>Date:</strong> {event.date}
                </p>
                <p className="text-lg mb-1">
                  <strong>Location:</strong> {event.location}
                </p>
                <p className="text-base">{event.description}</p>
              </div>
              {/* Add to Calendar button - only visible on mobile, top right */}
              <a
                href={`/calendar/${event.name.replace(/\s+/g, "_")}.ics`}
                download={`${event.name.replace(/\s+/g, "_")}.ics`}
                className="absolute top-4 right-4 md:hidden bg-green-700 text-white rounded-full p-2 shadow-lg hover:bg-green-800 transition"
                aria-label="Add to Apple Calendar"
              >
                {/* New Calendar SVG Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zm0-13H5V6h14v1z"/>
                  <circle cx="7.5" cy="12.5" r="1.5"/>
                  <circle cx="12" cy="12.5" r="1.5"/>
                  <circle cx="16.5" cy="12.5" r="1.5"/>
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}