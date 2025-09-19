'use client';

import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import { IceVideo } from "../hooks/hooks";
import { getManagerKeyFromDisplayName } from "../utils/helpers";

export default function VideoCard({ video, expandedVideo, setExpandedVideo }: {
  video: IceVideo, expandedVideo: string | null, setExpandedVideo: (id: string) => void
}) {
  const videoId = video.id?.trim() ?? "";
  const isExpanded = expandedVideo === videoId;

  // Prefer the highest-res thumbnail; gracefully fall back if unavailable
  const THUMBS = ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"] as const;
  const [thumbIndex, setThumbIndex] = useState(0);

  const thumbSrc =
    videoId && thumbIndex < THUMBS.length
      ? `https://img.youtube.com/vi/${videoId}/${THUMBS[thumbIndex]}`
      : "/default-thumb.png"; // Make sure this file exists in your public folder

  return (
    <div
      className="relative rounded-xl shadow-lg border border-[#444] flex flex-col h-full items-center p-4 transition-transform hover:-translate-y-0.5 hover:z-10 hover:shadow-emerald-900"
      style={{ backgroundColor: "#272828", width: "100%" }}
    >
      {/* Media */}
      <div className="w-full mb-3 relative aspect-video rounded-lg overflow-hidden bg-[#232323]">
        {videoId ? (
          !isExpanded ? (
            <Image
              key={thumbSrc}
              src={thumbSrc}
              alt={`Thumbnail for ${video.player}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover cursor-pointer"
              onClick={() => setExpandedVideo(videoId)}
              onError={() => setThumbIndex(i => i + 1)}
              loading="lazy"
            />
          ) : (
            <iframe
              // Ask for highest quality available. Player may still adapt if unsupported.
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&vq=highres`}
              title={`Ice video: ${video.player}`}
              frameBorder="0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-emerald-400 font-bold text-xl">
            No Video
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 w-full flex flex-col items-center">
        <h2 className="text-lg font-bold text-emerald-100 text-center mb-1 w-full">{video.player}</h2>

        <div className="text-sm text-emerald-300 text-center mb-1">
          <span className="font-semibold text-emerald-200">Manager:</span>{" "}
          <Link
            href={`/manager?name=${encodeURIComponent(getManagerKeyFromDisplayName(video.manager))}`}
            className="underline text-emerald-200 hover:text-emerald-400 transition"
          >
            {video.manager}
          </Link>
        </div>

        <div className="flex justify-center gap-2 text-xs text-emerald-400">
          {video.week && (
            <span className="bg-emerald-900 text-emerald-100 px-2 py-0.5 rounded-full font-semibold">Week {video.week}</span>
          )}
          <span>{video.date}</span>
        </div>

        {/* Bottom section pinned to the bottom of the card */}
        <div className="mt-auto pt-2 flex flex-col items-center gap-2">
          {video["24_hr_penalty"] && (
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-xs">24 HR PENALTY</span>
          )}

          {video.flavor && video.flavor !== "Standard" && (
            video.flavor.toLowerCase() === "red, white & berry" ? (
              <span
                className="px-3 py-1 rounded-full font-bold text-xs"
                style={{
                  background: "linear-gradient(90deg, #e53e3e 0%, #fff 50%, #3182ce 100%)",
                  color: "#353535ff",
                  border: "1px solid #141414ff"
                }}
              >
                {video.flavor}
              </span>
            ) : video.flavor.toLowerCase() === "red, white & merry holiday punch" ? (
              <span
                className="px-3 py-1 rounded-full font-bold text-xs"
                style={{ background: "#ab2308", color: "#ffffffff", border: "1px solid #ddd" }}
              >
                {video.flavor}
              </span>
            ) : video.flavor.toLowerCase() === "screwdriver" ? (
              <span
                className="px-3 py-1 rounded-full font-bold text-xs"
                style={{ background: "#ffbc13ff", color: "#ffffffff", border: "1px solid #ddd" }}
              >
                {video.flavor}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                {video.flavor}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}