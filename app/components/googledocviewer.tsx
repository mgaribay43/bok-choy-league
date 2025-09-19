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
    <div className="fixed inset-0 w-full h-full z-0 bg-[#181818]">
      {/* View Fullscreen Link */}
      <p className="text-center mb-4 pt-6">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-300 hover:text-emerald-400 font-medium"
        >
          View in fullscreen
        </a>
      </p>

      {/* Centered iframe container with max width */}
      <div className="flex justify-center items-center w-full h-[92vh] bg-[#181818] px-2">
        <div className="w-full max-w-2xl h-full bg-[#181818] flex items-center justify-center">
          <iframe
            key={refreshKey}
            src={embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            style={{
              border: 'none',
              background: '#181818',
              maxWidth: '100%',
              minWidth: 0,
              margin: 0,
              boxShadow: 'none',
              height: '100%',
            }}
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default GoogleDocViewer;
