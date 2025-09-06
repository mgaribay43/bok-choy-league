'use client';

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { IceVideo } from "../hooks/hooks";
import { getManagerKeyFromDisplayName } from "../utils/helpers";

export default function VideoCard({ video, expandedVideo, setExpandedVideo }: {
  video: IceVideo, expandedVideo: string | null, setExpandedVideo: (id: string) => void
}) {
  const videoId = video.id?.trim() ?? "";
  const isExpanded = expandedVideo === videoId;
  return (
    <div
      className="rounded-xl shadow-lg border border-[#444] flex flex-col items-center p-4 transition-transform hover:-translate-y-1 hover:shadow-emerald-900"
      style={{
        backgroundColor: "#272828",
        minHeight: 340,
        width: "100%",
        maxWidth: 400, // Changed from 520 to 400
      }}
    >
      <div className="w-full mb-3">
        {/* Thumbnail or embedded video */}
        {videoId ? (
          !isExpanded ? (
            <Image
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt={`Thumbnail for ${video.player}`}
              width={400}
              height={220}
              className="rounded-lg w-full cursor-pointer"
              style={{ objectFit: "cover" }}
              onClick={() => setExpandedVideo(videoId)}
              loading="lazy"
            />
          ) : (
            <iframe
              width="400"
              height="220"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`Ice video: ${video.player}`}
              frameBorder="0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg w-full"
            ></iframe>
          )
        ) : (
          <div className="w-full h-[220px] flex items-center justify-center bg-[#232323] rounded-lg text-emerald-400 font-bold text-xl">
            No Video
          </div>
        )}
      </div>
      {/* Player and manager info */}
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
      <div className="flex justify-center gap-2 text-xs text-emerald-400 mb-2">
        {video.week && (
          <span className="bg-emerald-900 text-emerald-100 px-2 py-0.5 rounded-full font-semibold">Week {video.week}</span>
        )}
        <span>{video.date}</span>
      </div>
      {/* Penalty badge */}
      {video["24_hr_penalty"] && (
        <span className="mt-2 px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-xs">24 HR PENALTY</span>
      )}
      {/* Flavor badges */}
      {video.flavor && video.flavor !== "Standard" && (
        video.flavor.toLowerCase() === "red, white & berry" ? (
          <span
            className="mt-2 px-3 py-1 rounded-full font-bold text-xs"
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
            className="mt-2 px-3 py-1 rounded-full font-bold text-xs"
            style={{
              background: "#ab2308",
              color: "#ffffffff",
              border: "1px solid #ddd"
            }}
          >
            {video.flavor}
          </span>
        ) : video.flavor.toLowerCase() === "screwdriver" ? (
          <span
            className="mt-2 px-3 py-1 rounded-full font-bold text-xs"
            style={{
              background: "#ffbc13ff",
              color: "#ffffffff",
              border: "1px solid #ddd"
            }}
          >
            {video.flavor}
          </span>
        ) : (
          <span className="mt-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
            {video.flavor}
          </span>
        )
      )}
    </div>
  );
}