import React, { useEffect, useState } from "react";
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, collection, getDocs } from "firebase/firestore";

// Scroll lock hook (same as pollCreator)
function useBodyScrollLock(isLocked: boolean) {
    useEffect(() => {
        if (!isLocked) return;

        const scrollY = window.scrollY;
        const prev = {
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            overflow: document.body.style.overflow,
        };

        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";

        return () => {
            const topVal = document.body.style.top;
            document.body.style.position = prev.position;
            document.body.style.top = prev.top;
            document.body.style.width = prev.width;
            document.body.style.overflow = prev.overflow;

            const y = Math.abs(parseInt(topVal || "0", 10)) || scrollY;
            window.scrollTo(0, y);
        };
    }, [isLocked]);
}

function EditIceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    useBodyScrollLock(open);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 2023 + 1 }, (_, i) => (2023 + i).toString()).reverse();

    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [entries, setEntries] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [form, setForm] = useState({
        date: "",
        flavor: "",
        id: "",
        manager: "",
        player: "",
        week: "",
        year: year,
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [leagueMembers, setLeagueMembers] = useState<string[]>([]);

    // Fetch league members from login_id db
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const db = getFirestore();
                const snapshot = await getDocs(collection(db, "Login_ID's"));
                const names = snapshot.docs
                    .map(doc => doc.data().name)
                    .filter(name => typeof name === "string" && name.trim().length > 0);
                setLeagueMembers(names);
            } catch {
                setLeagueMembers([]);
            }
        };
        if (open) fetchMembers();
    }, [open]);

    // Fetch entries when year changes
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setEntries([]);
        setSelectedId("");
        setForm({
            date: "",
            flavor: "",
            id: "",
            manager: "",
            player: "",
            week: "",
            year: year,
        });
        const fetchEntries = async () => {
            try {
                const db = getFirestore();
                const docRef = doc(db, "Ices", year);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setEntries(docSnap.data().entries || []);
                } else {
                    setEntries([]);
                }
            } catch {
                setEntries([]);
            }
            setLoading(false);
        };
        fetchEntries();
    }, [year, open]);

    // Fill form when entry selected
    useEffect(() => {
        if (!selectedId) return;
        const [selWeek, selManager, selPlayer, selDate] = selectedId.split("|");
        const ice = entries.find(
            (entry: any) =>
                entry.week === selWeek &&
                entry.manager === selManager &&
                entry.player === selPlayer &&
                entry.date === selDate
        );
        if (ice) {
            let date = ice.date || "";
            if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
                const [mm, dd, yyyy] = date.split("-");
                date = `${yyyy}-${mm}-${dd}`;
            }
            setForm({
                date,
                flavor: ice.flavor || "",
                id: ice.id || "",
                manager: ice.manager || "",
                player: ice.player || "",
                week: ice.week || "",
                year,
            });
            setMessage("");
        }
    }, [selectedId, entries, year]);

    // Save edited ice data
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        try {
            const db = getFirestore();
            const docRef = doc(db, "Ices", year);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                let entriesArr = docSnap.data().entries || [];
                const [selWeek, selManager, selPlayer, selDate] = selectedId.split("|");
                const idx = entriesArr.findIndex(
                    (entry: any) =>
                        entry.week === selWeek &&
                        entry.manager === selManager &&
                        entry.player === selPlayer &&
                        entry.date === selDate
                );
                if (idx !== -1) {
                    entriesArr[idx] = { ...form };
                    await updateDoc(docRef, { entries: entriesArr });
                    setMessage("Ice entry updated!");
                    onClose();
                } else {
                    setMessage("No ice found with that selection.");
                }
            }
        } catch (err: any) {
            setMessage("Error saving ice data.");
        }
        setLoading(false);
    };

    useEffect(() => {
        if (open) setMessage("");
    }, [open]);

    return open ? (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto flex flex-col">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 border-b border-slate-600 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">
                        Edit Ice Entry
                    </h2>
                    <button
                        className="text-white hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-white/10 text-xl"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>
                <div className="p-6 pb-0 flex-1 overflow-y-auto">
                    <div className="mb-4 flex gap-4">
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Year
                            </label>
                            <select
                                value={year}
                                onChange={e => setYear(e.target.value)}
                                className="px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading}
                            >
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-emerald-300 font-medium mb-2">
                                Select Ice Entry
                            </label>
                            <select
                                value={selectedId}
                                onChange={e => setSelectedId(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || entries.length === 0}
                            >
                                <option value="">-- Select --</option>
                                {entries.map((entry: any) => (
                                    <option
                                        key={`${entry.week}|${entry.manager}|${entry.player}|${entry.date}`}
                                        value={`${entry.week}|${entry.manager}|${entry.player}|${entry.date}`}
                                    >
                                        {entry.week} | {entry.manager} | {entry.player}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <form onSubmit={handleSave} className="space-y-4" id="edit-ice-form">
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Date
                            </label>
                            <input
                                type="date"
                                name="date"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || !selectedId}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Flavor
                            </label>
                            <input
                                type="text"
                                name="flavor"
                                value={form.flavor}
                                onChange={e => setForm({ ...form, flavor: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || !selectedId}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Manager
                            </label>
                            <select
                                name="manager"
                                value={form.manager}
                                onChange={e => setForm({ ...form, manager: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || !selectedId}
                                required
                            >
                                <option value="">Select manager</option>
                                {leagueMembers.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Player
                            </label>
                            <input
                                type="text"
                                name="player"
                                value={form.player}
                                onChange={e => setForm({ ...form, player: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || !selectedId}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Video ID
                            </label>
                            <input
                                type="text"
                                name="id"
                                placeholder="Paste YouTube link or ID"
                                value={form.id}
                                onChange={e => {
                                    const extracted = extractYouTubeId(e.target.value);
                                    setForm({ ...form, id: extracted || e.target.value });
                                }}
                                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || !selectedId}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-emerald-300 font-medium mb-2">
                                Week
                            </label>
                            <select
                                name="week"
                                value={form.week}
                                onChange={e => setForm({ ...form, week: e.target.value })}
                                className="w-full px-4 py-2 mb-6 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                                disabled={loading || !selectedId}
                                required
                            >
                                <option value="">Select week</option>
                                {Array.from({ length: 17 }, (_, i) => (
                                    <option key={i + 1} value={(i + 1).toString()}>
                                        {`${i + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {message && <div className="text-red-400 mt-2">{message}</div>}
                    </form>
                </div>
                {/* Sticky Footer */}
                <div className="sticky bottom-0 bg-gradient-to-br from-slate-800 to-slate-900 border-t border-slate-600 px-6 py-4 flex justify-end gap-4 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-ice-form"
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                        disabled={loading || !selectedId}
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    ) : null;
}

function extractYouTubeId(input: string): string {
    // Try to match common YouTube URL patterns, including shorts
    const patterns = [
        /(?:v=|\/embed\/|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/, // v=, embed, v/, youtu.be/, shorts
        /^([a-zA-Z0-9_-]{11})$/ // direct ID
    ];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    // If not matched, return the input (so user can edit freely)
    return input;
}

export default function AddIces() {
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        date: "",
        flavor: "",
        id: "",
        manager: "",
        player: "",
        week: "",
        year: new Date().getFullYear().toString(),
    });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [showEditModal, setShowEditModal] = useState(false);
    const [leagueMembers, setLeagueMembers] = useState<string[]>([]);

    useBodyScrollLock(showModal);

    // Fetch league members for Add modal
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const db = getFirestore();
                const snapshot = await getDocs(collection(db, "Login_ID's"));
                const names = snapshot.docs
                    .map(doc => doc.data().name)
                    .filter(name => typeof name === "string" && name.trim().length > 0);
                setLeagueMembers(names);
            } catch {
                setLeagueMembers([]);
            }
        };
        if (showModal) fetchMembers();
    }, [showModal]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        if (name === "id") {
            const extracted = extractYouTubeId(value);
            // Only auto-extract if a valid ID is found, otherwise use the raw value
            setForm({ ...form, id: extracted || value });
        } else {
            setForm({ ...form, [name]: value });
        }
    };

    const handleOpen = () => {
        setShowModal(true);
        setMessage(""); // Clear message when opening
    };

    const handleClose = () => {
        setShowModal(false);
        setForm({
            date: "",
            flavor: "",
            id: "",
            manager: "",
            player: "",
            week: "",
            year: new Date().getFullYear().toString(),
        });
        setMessage(""); // Clear message when closing
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");

        const { date, flavor, id, manager, player, week, year } = form;
        if (!date || !flavor || !manager || !player || !week || !year) {
            setMessage("Please fill out all fields.");
            setSubmitting(false);
            return;
        }

        try {
            const db = getFirestore();
            const docRef = doc(db, "Ices", year);
            await updateDoc(docRef, {
                entries: arrayUnion({ date, flavor, id, manager, player, week }),
            });
            setMessage("Ice entry added!");
            handleClose();
        } catch (error: any) {
            setMessage(error.message || "Failed to add ice entry.");
        }
        setSubmitting(false);
    };

    const modalClassName =
        "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto flex flex-col";

    return (
        <>
            <div className="w-full flex flex-col items-center gap-4">
                <button
                    className="w-48 px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition text-lg"
                    onClick={handleOpen}
                >
                    Add Ice
                </button>
                <button
                    className="w-48 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition text-lg"
                    onClick={() => setShowEditModal(true)}
                >
                    Edit Ice
                </button>
            </div>
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className={modalClassName}>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 border-b border-slate-600 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-white">
                                Add Ice Entry ({form.year})
                            </h2>
                            <button
                                className="text-white hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-white/10 text-xl"
                                onClick={handleClose}
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6 pb-0 flex-1 overflow-y-auto">
                            <form onSubmit={handleSubmit} className="space-y-4" id="ice-form">
                                <div>
                                    <label className="block text-emerald-300 font-medium mb-2">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={form.date}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        disabled={submitting}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-emerald-300 font-medium mb-2">
                                        Flavor
                                    </label>
                                    <input
                                        type="text"
                                        name="flavor"
                                        placeholder="Flavor"
                                        value={form.flavor}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        disabled={submitting}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-emerald-300 font-medium mb-2">
                                        Video ID
                                    </label>
                                    <input
                                        type="text"
                                        name="id"
                                        placeholder="Paste YouTube link or ID"
                                        value={form.id}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        disabled={submitting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-emerald-300 font-medium mb-2">
                                        Manager
                                    </label>
                                    <select
                                        name="manager"
                                        value={form.manager}
                                        onChange={e => setForm({ ...form, manager: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        disabled={submitting}
                                        required
                                    >
                                        <option value="">Select manager</option>
                                        {leagueMembers.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-emerald-300 font-medium mb-2">
                                        Player
                                    </label>
                                    <input
                                        type="text"
                                        name="player"
                                        placeholder="Player"
                                        value={form.player}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        disabled={submitting}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-emerald-300 font-medium mb-2">
                                        Week
                                    </label>
                                    <select
                                        name="week"
                                        value={form.week}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 mb-6 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        disabled={submitting}
                                        required
                                    >
                                        <option value="">Select week</option>
                                        {Array.from({ length: 17 }, (_, i) => (
                                            <option key={i + 1} value={(i + 1).toString()}>
                                                {`${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {message && <div className="text-red-400 mt-2">{message}</div>}
                            </form>
                        </div>
                        {/* Sticky Footer */}
                        <div className="sticky bottom-0 bg-gradient-to-br from-slate-800 to-slate-900 border-t border-slate-600 px-6 py-4 flex justify-end gap-4 z-10">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="ice-form"
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                                disabled={submitting}
                            >
                                {submitting ? "Submitting..." : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <EditIceModal open={showEditModal} onClose={() => setShowEditModal(false)} />
        </>
    );
}