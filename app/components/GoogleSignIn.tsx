'use client';

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, getFirestore, query, where, getDocs } from 'firebase/firestore';
import { auth } from '../../firebase';

export default function GoogleSignIn({ onSuccess }: { onSuccess: () => void }) {
    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const email = result.user.email;
            if (!email) {
                alert('No email found in your Google account.');
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
                alert('Your email is not authorized to access this site.');
                await auth.signOut();
            }
        } catch (error) {
            alert('Sign in failed.');
        }
    };

    return (
        <button
            onClick={handleSignIn}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
            Sign in with Google
        </button>
    );
}
