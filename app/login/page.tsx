'use client';

import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation'; // For retrieving query params
import GoogleSignIn from '../components/GoogleSignIn';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/'; // Default to home if no redirect

    const handleLoginSuccess = () => {
        router.push(redirectTo); // Redirect to the original page after login
    };

    return (
        <div className="min-h-screen bg-green-50 flex items-center justify-center">
            <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-8 space-y-6">
                <h1 className="text-3xl font-semibold text-center text-gray-800">Welcome Back!</h1>
                <p className="text-center text-gray-600">Please sign in to continue to the application</p>

                <GoogleSignIn onSuccess={handleLoginSuccess} /> {/* Pass success callback */}

                <div className="text-center">
                    <p className="text-sm text-gray-600">By signing in, you agree to our <a href="#" className="text-blue-600">Terms & Conditions</a>.</p>
                </div>
            </div>
        </div>
    );
}
