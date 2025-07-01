'use client';

import React from 'react';

type GoogleDocViewerProps = {
  docId: string;
};

const GoogleDocViewer = ({ docId }: GoogleDocViewerProps) => {
  const embedUrl = `https://docs.google.com/document/d/${docId}/preview`;

const viewUrl = `https://docs.google.com/document/d/${docId}/view`;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      {/* Responsive iframe container */}
      <div className="relative w-full h-[90vh] sm:h-[85vh] md:h-[80vh]">
        <iframe
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full rounded-md border border-gray-300"
          allowFullScreen
        ></iframe>
      </div>
      {/* Optional View Fullscreen Link */}
      <p className="text-center mt-4">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-700 underline hover:text-green-900 font-medium"
        >
          📄 View in fullscreen ↗
        </a>
      </p>
    </div>
  );
};

export default GoogleDocViewer;
