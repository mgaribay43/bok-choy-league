"use client";

import React, { useEffect, useState } from "react";
import { getLeagueKey } from "./globalUtils/getLeagueKey";

type PlayerData = {
    player_id: string;
    name: { full: string };
    editorial_team_abbr: string;
    display_position: string;
    transaction_data: any;
};

type Transaction = {
    transaction_id: string;
    type: string;
    status: string;
    timestamp: string;
    players: PlayerData[];
};

function parseTransactions(json: any): Transaction[] {
    const txnsObj = json?.fantasy_content?.league?.[1]?.transactions || {};
    const txns: Transaction[] = [];
    Object.values(txnsObj)
        .filter((v: any) => v && v.transaction)
        .forEach((txnObj: any) => {
            const txnArr = txnObj.transaction;
            const meta = txnArr[0];
            if (meta.type === "commish") return; // Ignore commish transactions
            const playersObj = txnArr[1]?.players || {};
            const players: PlayerData[] = [];
            Object.values(playersObj)
                .filter((p: any) => p && p.player)
                .forEach((p: any) => {
                    const arr = p.player;
                    const info = arr[0];
                    let data = arr[1]?.transaction_data;
                    if (Array.isArray(data)) data = data[0];
                    players.push({
                        player_id: info?.find((x: any) => x.player_id)?.player_id ?? "",
                        name: info?.find((x: any) => x.name)?.name ?? { full: "" },
                        editorial_team_abbr: info?.find((x: any) => x.editorial_team_abbr)?.editorial_team_abbr ?? "",
                        display_position: info?.find((x: any) => x.display_position)?.display_position ?? "",
                        transaction_data: data,
                    });
                });
            txns.push({
                transaction_id: meta.transaction_id,
                type: meta.type,
                status: meta.status,
                timestamp: meta.timestamp,
                players,
            });
        });
    return txns.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}

function formatDate(ts: string) {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).replace(",", "");
}

const PlusIcon = () => (
    <span className="text-green-500 font-bold text-lg mr-2">+</span>
);

const MinusIcon = () => (
    <span className="text-red-500 font-bold text-lg mr-2">−</span>
);

function getInitial(name: string, position: string) {
    if (position === "DEF") return name; // Do not abbreviate for DEF
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0][0] + ".";
    return parts[0][0] + ". " + (parts[1] || "");
}

function getSourceAbbr(p: PlayerData) {
    if (p.transaction_data?.source_type === "freeagents") return "FA";
    if (p.transaction_data?.source_type === "waivers") return "W";
    return "";
}

function getDestAbbr(p: PlayerData) {
    if (p.transaction_data?.destination_type === "waivers") return "W";
    if (p.transaction_data?.destination_type === "team") return "T";
    return "";
}

const TransactionsBox: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        async function fetchTransactions() {
            setLoading(true);
            const year = new Date().getFullYear();
            const url = `https://us-central1-bokchoyleague.cloudfunctions.net/yahooAPI?type=transactions&year=${year}`;
            const res = await fetch(url);
            const json = await res.json();
            setTransactions(parseTransactions(json));
            setLoading(false);
        }
        fetchTransactions();
    }, []);

    function renderTransactionPlayers(players: PlayerData[]) {
        const adds = players.filter((p) => p.transaction_data?.type === "add");
        const drops = players.filter((p) => p.transaction_data?.type === "drop");
        return (
            <div className="mt-2">
                {adds.map((p) => (
                    <div key={p.player_id} className="flex items-center mb-1">
                        <PlusIcon />
                        <span className="font-bold text-white text-base mr-2">
                            {getInitial(p.name.full, p.display_position)}
                        </span>
                        <span className="text-gray-300 text-base mr-2">{p.display_position}</span>
                        <span className="text-gray-400 text-base mr-2">{`(${getSourceAbbr(p)})`}</span>
                    </div>
                ))}
                {drops.map((p) => (
                    <div key={p.player_id} className="flex items-center mb-1">
                        <MinusIcon />
                        <span className="font-bold text-white text-base mr-2">
                            {getInitial(p.name.full, p.display_position)}
                        </span>
                        <span className="text-gray-300 text-base mr-2">{p.display_position}</span>
                        <span className="text-gray-400 text-base mr-2">{`(${getDestAbbr(p)})`}</span>
                    </div>
                ))}
            </div>
        );
    }

    function renderTransactionRow(txn: Transaction) {
        let teamName = "";
        for (const p of txn.players) {
            if (p.transaction_data?.destination_team_name) {
                teamName = p.transaction_data.destination_team_name;
                break;
            }
            if (p.transaction_data?.source_team_name) {
                teamName = p.transaction_data.source_team_name;
                break;
            }
        }

        // Responsive font size: shrink if team name is long
        const isLong = teamName.length > 18;
        const teamNameClass = isLong
            ? "font-bold text-base sm:text-lg text-white truncate max-w-[48vw] sm:max-w-none"
            : "font-bold text-lg text-white truncate max-w-[60vw] sm:max-w-none";

        return (
            <li
                key={txn.transaction_id}
                className="rounded-xl bg-[#101214] mb-3 px-4 py-3 flex flex-col"
            >
                <div className="flex flex-row items-center justify-between flex-nowrap">
                    <span className={teamNameClass}>{teamName}</span>
                    <span className="text-gray-300 text-sm ml-2 whitespace-nowrap flex-shrink-0">{formatDate(txn.timestamp)}</span>
                </div>
                {renderTransactionPlayers(txn.players)}
            </li>
        );
    }

    return (
        <>
            {/* Header outside the card */}
            <div className="mb-2">
                <h2 className="text-5xl font-extrabold text-center text-[#a7f3d0] hover:underline">
                    Transactions
                </h2>
            </div>
            <div className="bg-[#18191b] rounded-2xl shadow-lg p-4 w-full max-w-lg mx-auto mb-10">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-emerald-300">Latest Transactions</h3>
                    <button
                        className="text-blue-400 font-semibold flex items-center gap-1 text-base"
                        onClick={() => setShowModal(true)}
                    >
                        View All <span className="text-blue-400 text-xl">&rarr;</span>
                    </button>
                </div>
                {loading ? (
                    <div className="text-gray-400 py-8 text-center">Loading...</div>
                ) : transactions.length === 0 ? (
                    <div className="text-gray-400 py-8 text-center">No transactions found.</div>
                ) : (
                    <ul>
                        {transactions.slice(0, 5).map(renderTransactionRow)}
                    </ul>
                )}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-[#23252b] rounded-xl shadow-xl w-full max-w-lg mx-2 p-4 relative">
                            <button
                                className="absolute top-3 right-3 text-gray-400 hover:text-emerald-400 text-2xl font-bold"
                                onClick={() => setShowModal(false)}
                                aria-label="Close"
                            >
                                &times;
                            </button>
                            <h3 className="text-xl font-bold text-emerald-300 mb-4 text-center">All Transactions</h3>
                            <div className="max-h-[70vh] overflow-y-auto">
                                <ul>
                                    {transactions.map(renderTransactionRow)}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default TransactionsBox;