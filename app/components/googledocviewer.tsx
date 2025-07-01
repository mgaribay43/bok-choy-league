'use client';

import React from 'react';

type GoogleDocViewerProps = {
  docId: string;
};

const GoogleDocViewer = ({ docId }: GoogleDocViewerProps) => {
  const embedUrl = `https://docs.google.com/document/d/${docId}/preview`;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      <div className="relative w-full pt-[140%] sm:pt-[100%] md:pt-[80%] lg:pt-[65%] xl:pt-[56.25%]">
        <iframe
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full rounded-md border border-gray-300"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default GoogleDocViewer;
