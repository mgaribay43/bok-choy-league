'use client';

import React, { useEffect, useRef } from "react";
import VideoCard from "./VideoCard";
import { IceVideo } from "../hooks/hooks";

export default function SeasonCollapse({ isCollapsed, videos, expandedVideo, setExpandedVideo }: {
  isCollapsed: boolean;
  videos: IceVideo[];
  expandedVideo: string | null;
  setExpandedVideo: (id: string) => void;
}) {
  const collapseRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const collapseEl = collapseRef.current;
    const gridEl = gridRef.current;
    if (!collapseEl || !gridEl) return;

    // Function to update maxHeight based on grid content
    const updateHeight = () => {
      if (!isCollapsed) {
        collapseEl.style.maxHeight = gridEl.scrollHeight + "px";
      }
    };

    // Set initial height
    if (!isCollapsed) {
      collapseEl.style.maxHeight = gridEl.scrollHeight + "px";
    } else {
      collapseEl.style.maxHeight = "0px";
    }

    // Observe grid for size changes
    let resizeObserver: ResizeObserver | null = null;
    if (!isCollapsed) {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(gridEl);
    }

    // Cleanup
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [isCollapsed, videos.length, expandedVideo]);

  return (
    <div
      ref={collapseRef}
      className={`overflow-hidden transition-all duration-500 ease-in-out w-full ${!isCollapsed ? "opacity-100" : "opacity-0"}`}
      style={{ transitionProperty: "max-height, opacity", marginBottom: "32px", minHeight: "1px" }}
    >
      <div
        ref={gridRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
      >
        {[...videos].reverse().map((video, idx) =>
          <VideoCard key={(video.id?.trim() || "") + idx} video={video} expandedVideo={expandedVideo} setExpandedVideo={setExpandedVideo} />
        )}
      </div>
    </div>
  );
}