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
    <div className="fixed inset-0 w-full h-full bg-white z-0">
      {/* View Fullscreen Link */}
      <p className="text-center mb-4 pt-6">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-700 hover:text-green-900 font-medium"
        >
          View in fullscreen
        </a>
      </p>

      {/* Iframe container without refresh button */}
      <div className="relative w-full h-[92vh]">
        {/* Embedded Google Doc */}
        <iframe
          key={refreshKey}
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full rounded-md border-0"
          allowFullScreen
          style={{ border: 'none' }}
        ></iframe>
      </div>
    </div>
  );
};

export default GoogleDocViewer;
