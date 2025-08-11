'use client'; // Ensure this file is treated as a Client Component

import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig'; // Firebase auth instance
import { useRouter } from 'next/navigation';

const GoogleSignIn = ({ onSuccess }: { onSuccess: () => void }) => {
    const router = useRouter();

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            onSuccess(); // Trigger the onSuccess callback after login
        } catch (error) {
            console.error('Error signing in with Google: ', error);
        }
    };

    return (
        <button
            onClick={handleGoogleSignIn}
            className="w-full mt-6 py-3 px-6 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
            <div className="flex items-center justify-center space-x-2">
                <span>Sign in with Google</span>
            </div>
        </button>
    );
};

export default GoogleSignIn;
