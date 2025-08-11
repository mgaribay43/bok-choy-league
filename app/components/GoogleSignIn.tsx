'use client'; // This ensures this file is treated as a Client Component

import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig'; // Firebase auth instance
import { useRouter } from 'next/navigation';

const GoogleSignIn = () => {
    const router = useRouter();
    const whitelist = [
        'mikeyjordan43@gmail.com',
    ];

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user.email is not null and if it's in the whitelist
            if (user.email && whitelist.includes(user.email)) {
                // Redirect to the home page if email is whitelisted
                router.push('/');
            } else {
                // Log out the user if their email is not whitelisted
                await auth.signOut();
                alert('You are not a member of The Bok Choy League');
                router.push('/login'); // Optionally, redirect to login again
            }
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
