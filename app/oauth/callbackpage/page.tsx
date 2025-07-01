'use client';
// this page accepts the callback from yahoo and receives the code in the URL
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function OAuthCallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Exchanging authorization code...');

  useEffect(() => {
    const code = searchParams.get('code');

    if (code) {
        // Send to your backend or Firebase function to exchange for tokens
      fetch('https://yahoooauth-4mkk4ype2a-uc.a.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((data) => {
          setStatus('Authorization successful ✅');
          console.log('Yahoo OAuth tokens:', data);
        })
        .catch((err) => {
          console.error(err);
          setStatus('Error exchanging token ❌');
        });
    } else {
      setStatus('No authorization code found ❌');
    }
  }, [searchParams]);

  return <p>{status}</p>;
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">OAuth Callback</h1>
        <Suspense fallback={<p>Loading...</p>}>
          <OAuthCallbackInner />
        </Suspense>
      </div>
    </div>
  );
}
