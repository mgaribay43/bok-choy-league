'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function OAuthStatusHandler() {
    const searchParams = useSearchParams();
    const [status] = useState('Exchanging authorization code...');

    useEffect(() => {
  const authCode = "7dme4pqzqauczm28y5jd7kekk5rp6q4h";

  if (authCode) {
    fetch('https://us-central1-YOUR_PROJECT.cloudfunctions.net/exchangeYahooCode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode }),
    })
      .then(res => res.json())
      .then(data => console.log('Yahoo Tokens:', data))
      .catch(err => console.error(err));
  }
}, [searchParams]);

    return <p>{status}</p>;
}

export default function OAuthCallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-green-50">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold mb-4">OAuth Callback</h1>
                <Suspense fallback={<p>Loading...</p>}>
                    <OAuthStatusHandler />
                </Suspense>
            </div>
        </div>
    );
}