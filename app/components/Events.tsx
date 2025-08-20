"use client";

import React, { useState, useEffect } from "react";
import eventsData from "../data/League_Events.json";
import Image from "next/image";
import { doc, getDoc, getFirestore } from "firebase/firestore";

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

  // Track manual change to reset timer
  const [timerKey, setTimerKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrent((prevIdx) => (prevIdx + 1) % events.length);
        setIsFading(false);
      }, 700);
    }, 10000);
    return () => clearInterval(interval);
  }, [events.length, timerKey]);

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
          setTimerKey((k) => k + 1); // Reset timer on swipe
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
      <header className="text-center mb-6 mt-2">
        <a href="/events" className="inline-block">
          <h1 className="text-5xl font-extrabold text-emerald-200 tracking-tight hover:underline transition">
            Upcoming Events
          </h1>
        </a>
      </header>
      <div className="flex flex-col items-center">
        <div className="w-full max-w-2xl bg-[#232323] shadow-lg border border-[#333] rounded-xl mb-8 overflow-hidden">
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
            <div className={`absolute bottom-0 left-0 w-full bg-[#181818]/80 text-emerald-100 px-6 py-4 transition-opacity duration-700 ${isFading ? "opacity-0" : "opacity-100"}`}>
              <h2 className="text-2xl font-bold mb-1 text-emerald-200">{event.name}</h2>
              <p className="text-base mb-1">
                <strong>Date:</strong> <span className="text-emerald-300">{event.date}</span>
              </p>
              <EventLocation location={event.location} eventId={event.id} />
              <p className="text-sm mt-2 text-emerald-400">{event.description}</p>
            </div>
            <a
              href={`/calendar/${event.name.replace(/\s+/g, "_")}.ics`}
              download={`${event.name.replace(/\s+/g, "_")}.ics`}
              className="absolute top-4 right-4 md:hidden bg-emerald-900 text-emerald-100 rounded-full p-2 shadow-lg hover:bg-emerald-700 transition"
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
        <div className="flex justify-center mt-[-18px] mb-4">
          <div className="flex gap-1">
            {events.map((_, idx) => (
              <button
                key={idx}
                className={`w-2 h-2 rounded-full ${idx === current ? "bg-emerald-600" : "bg-emerald-900"}`}
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
        </div>
      </div>
    </div>
  );
}

function EventLocation({ location, eventId }: { location: string; eventId: number }) {
  const [address, setAddress] = useState<string | null>(null);

  // Detect mobile device
  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const fetchAddress = async () => {
      if (location === "true") {
        try {
          const dbInstance = getFirestore();
          const addressDoc = doc(dbInstance, "Events_Addresses", "Addresses");
          const addressSnap = await getDoc(addressDoc);
          if (addressSnap.exists()) {
            setAddress(addressSnap.data()[String(eventId)] || null);
          }
        } catch (error) {
          setAddress(null);
        }
      }
    };
    fetchAddress();
  }, [location, eventId]);

  if (location === "N/A" || location === "") return null;
  if (location === "true") {
    if (!address) return null;
    const mapsUrl = isMobile
      ? `https://maps.apple.com/?q=${encodeURIComponent(address)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    return (
      <p className="text-sm mb-1">
        <strong>Location:</strong>{" "}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-emerald-300 hover:text-emerald-400"
        >
          {address}
        </a>
      </p>
    );
  }
  return (
    <p className="text-sm mb-1">
      <strong>Location:</strong> <span className="text-emerald-300">{location}</span>
    </p>
  );
}

export default function Events({ soonestOnly = false, eventsSlideshow = false }: EventsProps) {
  const events: Event[] = eventsData.Events;
  const today = new Date();
  const upcomingEvents = events.filter(event => {
    const [month, day, year] = event.date.split("-");
    const eventDate = new Date(`${year}-${month}-${day}T00:00:00`);
    return eventDate >= today;
  });

  if (eventsSlideshow) {
    return <EventsSlideshow events={upcomingEvents} />;
  }

  const eventsToRender = soonestOnly
    ? getSoonestEvent(upcomingEvents)
      ? [getSoonestEvent(upcomingEvents)!]
      : []
    : upcomingEvents;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-0">
      <header className="text-center mb-8 mt-8">
        <h1 className="text-4xl font-extrabold text-emerald-200 mb-2 tracking-tight">
          Upcoming Events
        </h1>
        {!soonestOnly && (
          <p className="text-base text-emerald-400">
            Stay up to date with all upcoming league activities and deadlines.
          </p>
        )}
      </header>
      <div className="flex flex-col items-center gap-8">
        {eventsToRender.map((event) => (
          <div
            key={event.id}
            className="w-full max-w-2xl bg-[#232323] shadow-lg border border-[#333] rounded-xl mb-2 overflow-hidden"
          >
            <div className="relative h-[400px]">
              <Image
                src={event.image ? event.image : placeholderImage}
                alt={event.name}
                fill
                className="object-cover block"
                sizes="100vw"
              />
              <div className="absolute bottom-0 left-0 w-full bg-[#181818]/80 text-emerald-100 px-6 py-4">
                <h2 className="text-2xl font-bold mb-1 text-emerald-200">{event.name}</h2>
                <p className="text-base mb-1">
                  <strong>Date:</strong> <span className="text-emerald-300">{event.date}</span>
                </p>
                <EventLocation location={event.location} eventId={event.id} />
                <p className="text-sm mt-2 text-emerald-400">{event.description}</p>
              </div>
              <a
                href={`/calendar/${event.name.replace(/\s+/g, "_")}.ics`}
                download={`${event.name.replace(/\s+/g, "_")}.ics`}
                className="absolute top-4 right-4 md:hidden bg-emerald-900 text-emerald-100 rounded-full p-2 shadow-lg hover:bg-emerald-700 transition"
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
        ))}
      </div>
    </div>
  );
}