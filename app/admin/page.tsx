"use client";

import PollCreator from '@/app/components/pollCreator';

export default function AdminPage() {
    return (
        <div className="min-h-screen py-10 px-6">
            <h1 className="text-3xl font-bold text-center text-green-800 mb-6">Admin Page</h1>
            <p className="text-emerald-400 text-lg text-center mb-6">Welcome, Commissioner!</p>
            <PollCreator />
        </div>
    );
}