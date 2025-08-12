'use client';

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, getFirestore, query, where, getDocs } from 'firebase/firestore';
import { auth } from '../../firebase';

export default function GoogleSignIn({ onSuccess }: { onSuccess: () => void }) {
    const [message, setMessage] = useState<string | null>(null);

    const handleSignIn = async () => {
        setMessage(null);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const email = result.user.email;
            if (!email) {
                setMessage('No email found in your Google account.');
                await auth.signOut();
                return;
            }
            const dbInstance = getFirestore();
            const q = query(
                collection(dbInstance, "Login_ID's"),
                where("email", "==", email)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                onSuccess();
            } else {
                setMessage('You are not a member of The Bok Choy League. If you believe this is an error, please contact the league administrator.');
                await auth.signOut();
            }
        } catch (error) {
            setMessage('Sign in failed.');
        }
    };

    return (
        <div className="space-y-4">
            {message && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center">
                    {message}
                </div>
            )}
            <button
                onClick={handleSignIn}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
                Sign in with Google
            </button>
        </div>
    );
}
