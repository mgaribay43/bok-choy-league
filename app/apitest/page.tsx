'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function OAuthCallback() {
    const searchParams = useSearchParams();
    const code = searchParams.get('code');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        if (!code) return;

        const exchangeCode = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `https://us-central1-bokchoyleague.cloudfunctions.net/exchangeYahooCode?code=${encodeURIComponent(code)}`,
                    {
                        method: 'GET',
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to exchange code');
                }

                const data = await response.json();
                setAccessToken(data.access_token);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError(String(err));
                }
            }
        };

        exchangeCode();
    }, [code]);

    if (!code) return <p>No authorization code found in URL.</p>;

    if (loading) return <p>Exchanging authorization code...</p>;

    if (error) return <p>Error: {error}</p>;

    return (
        <div>
            <h1>Yahoo OAuth Token Received</h1>
            <p>Access Token: {accessToken}</p>
            {/* Here you can store the token or continue your app logic */}
        </div>
    );
}
