"use client";

import PollCreator from '@/app/components/pollCreator';
import IceCreator from '@/app/components/addIces';

export default function AdminPage() {
    return (
        <div className="min-h-screen py-10 px-6 bg-[#232323]">
            <h1 className="text-3xl font-bold text-center text-green-800 mb-6">Admin Page</h1>
            <p className="text-emerald-400 text-lg text-center mb-6">Welcome, Commissioner!</p>
            <div className="w-full max-w-4xl border border-[#333] rounded-xl p-6 shadow-lg mx-auto flex flex-col gap-8 bg-white/80">
                {/* Poll Section */}
                <section className="w-full">
                    <h2 className="text-xl font-bold text-blue-700 mb-4 text-center">Poll Management</h2>
                    <div className="flex flex-col items-center gap-4">
                        <PollCreator />
                    </div>
                </section>
                {/* Ice Section */}
                <section className="w-full">
                    <h2 className="text-xl font-bold text-emerald-700 mb-4 text-center">Ice Management</h2>
                    <div className="flex flex-col items-center gap-4">
                        <IceCreator />
                    </div>
                </section>
            </div>
        </div>
    );
}