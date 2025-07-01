'use client';

import React, { useState } from 'react';

type GoogleDocViewerProps = {
  docId: string;
};

const GoogleDocViewer = ({ docId }: GoogleDocViewerProps) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const embedUrl = `https://docs.google.com/document/d/${docId}/preview`;
  const viewUrl = `https://docs.google.com/document/d/${docId}/view`;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      {/* View Fullscreen Link */}
      <p className="text-center mb-4">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-700 hover:text-green-900 font-medium"
        >
          View in fullscreen
        </a>
      </p>

      {/* Iframe container with floating refresh button */}
      <div className="relative w-full h-[90vh] sm:h-[85vh] md:h-[80vh]">
        {/* 🔄 Floating Refresh Button */}
        <button
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="absolute z-10 top-4 right-4 bg-opacity-80 text-white hover:bg-gray-300 font-bold px-3 py-1 rounded-full shadow transition duration-200"
          title="Refresh Document"
        >
          🔄
        </button>

        {/* Embedded Google Doc */}
        <iframe
          key={refreshKey}
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full rounded-md border border-gray-300"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default GoogleDocViewer;
