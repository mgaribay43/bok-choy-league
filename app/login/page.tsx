'use client';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import GoogleSignIn from '../components/GoogleSignIn';
import { Suspense } from 'react';
import Image from 'next/image';
import image from '../data/images/BokChoyLeagueLogo.jpg'; // Adjust the path as necessary

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/';

    const handleLoginSuccess = () => {
        router.push(redirectTo);
    };

    return (
        <div className="relative overflow-hidden bg-[#181818] min-h-screen">
            {/* Main Content */}
            <div className="relative flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-md">
                    {/* Logo/Brand Section */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-lg mb-6 relative bg-[#232323] border border-[#333]">
                            <Image
                                src={image}
                                alt="Bok Choy League Logo"
                                fill
                                className="object-cover rounded-2xl"
                                sizes="80px"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-emerald-200 mb-2">The Bok Choy League</h1>
                        <p className="text-emerald-400 font-medium">Secure Access Portal</p>
                    </div>

                    {/* Login Card */}
                    <div className="bg-[#232323]/90 backdrop-blur-sm shadow-2xl rounded-3xl border border-[#333] overflow-hidden">
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 px-8 py-6">
                            <h2 className="text-xl font-bold text-emerald-100 text-center">Sign In to Your Account</h2>
                            <p className="text-emerald-300 text-sm text-center mt-1">Sign in to access Bok Choy League data</p>
                        </div>

                        {/* Card Body */}
                        <div className="px-8 py-8 space-y-6">
                            {/* Welcome Message */}
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-emerald-100 mb-2">Welcome Back!</h3>
                                <p className="text-emerald-400 text-sm leading-relaxed">
                                    Please authenticate with your Google account to securely access the Bok Choy League.
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-[#333]"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-[#232323] px-4 text-emerald-400 font-semibold tracking-wider">Secure Authentication</span>
                                </div>
                            </div>

                            {/* Google Sign In */}
                            <div className="space-y-4">
                                <GoogleSignIn onSuccess={handleLoginSuccess} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 text-center space-y-4">
                        <div className="flex items-center justify-center space-x-2 text-xs text-emerald-700 font-medium">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span>Secured by Google</span>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-[#181818] via-[#232323] to-[#181818] flex items-center justify-center">
                <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}