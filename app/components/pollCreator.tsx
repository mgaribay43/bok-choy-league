"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

// --- Helpers ---
const getTotalVotes = (poll: any) =>
  Array.isArray(poll.voters) ? poll.voters.length : 0;

const getVotePercentage = (votes: number, totalVotes: number) =>
  totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);

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

// --- Main Component ---
const PollCreator: React.FC = () => {
  // --- State ---
  const [authState, setAuthState] = useState({
    isAuthorized: false,
    user: null as any,
  });
  const [modalState, setModalState] = useState({
    showCreate: false,
    showResults: false,
    showEditResponses: false,
    showParticipants: false,
    showResponses: false,
  });
  const [pollForm, setPollForm] = useState({
    id: "",
    question: "",
    options: ["", ""],
    allowTextbox: false,
    duration: "",
    maxSelections: 1,
    rankedVoting: false,
  });
  const [pollResults, setPollResults] = useState<any[]>([]);
  const [editingPoll, setEditingPoll] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    question: "",
    options: [] as string[],
    allowTextbox: false,
    duration: "",
    isExpired: false,
    maxSelections: 1,
    rankedVoting: false,
    modalReady: false,
  });

  const router = useRouter();

  // --- Effects ---
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    setAuthState((prev) => ({ ...prev, user }));
    if (!user) {
      router.push("/");
      return;
    }
    const checkAuth = async () => {
      const email = user.email || "";
      const db = getFirestore();
      try {
        const snapshot = await getDocs(collection(db, "Login_ID's"));
        let authorized = false;
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.email === email && data.is_commissioner === "true") {
            authorized = true;
          }
        });
        setAuthState((prev) => ({ ...prev, isAuthorized: authorized }));
        if (!authorized) router.push("/");
      } catch {
        router.push("/");
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (modalState.showResults) {
      const db = getFirestore();
      const pollsCollection = collection(db, "Polls");
      const unsubscribe = onSnapshot(pollsCollection, (snapshot) => {
        const pollsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            question: data.question,
            options: (data.options || []).map((opt: any) => ({
              id: opt.id,
              text: opt.text,
              votes: opt.votes,
              score: opt.score || 0,
            })),
            voters: data.voters || [],
            responses: data.responses || {},
            createdAt: data.createdAt || null,
            allowTextboxResponse: data.allowTextboxResponse ?? false,
            isExpired: data.isExpired ?? false,
            pollDuration: data.pollDuration ?? "",
            maxSelections: data.maxSelections ?? 1,
            rankedVoting: data.rankedVoting ?? false,
            selectedOptions: data.selectedOptions || [],
          };
        });
        pollsData.sort((a, b) =>
          a.createdAt && b.createdAt
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : b.id.localeCompare(a.id)
        );
        setPollResults(pollsData);
      });
      return () => unsubscribe();
    }
  }, [modalState.showResults]);

  useBodyScrollLock(modalState.showCreate || modalState.showResults);

  useEffect(() => {
    if (editingPoll) {
      setEditForm({
        question: editingPoll.question || "",
        options: editingPoll.options ? editingPoll.options.map((opt: any) => opt.text) : [],
        allowTextbox: !!editingPoll.allowTextboxResponse,
        duration: editingPoll.pollDuration ? editingPoll.pollDuration.slice(0, 16) : "",
        isExpired: !!editingPoll.isExpired,
        maxSelections: editingPoll.maxSelections ?? 1,
        rankedVoting: !!editingPoll.rankedVoting,
        modalReady: true,
      });
    } else {
      setEditForm((prev) => ({ ...prev, modalReady: false }));
    }
  }, [editingPoll]);

  // --- Handlers ---
  const handlePollFormChange = useCallback(
    (field: string, value: any) => {
      setPollForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleAddOption = () => {
    setPollForm((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setPollForm((prev) => {
      const updated = [...prev.options];
      updated[index] = value;
      return { ...prev, options: updated };
    });
  };

  const handleCreatePoll = async () => {
    const { id, question, options, allowTextbox, duration, maxSelections, rankedVoting } = pollForm;
    if (!id.trim() || !question.trim() || options.some((o) => !o.trim()) || !duration) {
      alert("Please fill out the poll ID, question, all options, and set a poll duration.");
      return;
    }
    try {
      const db = getFirestore();
      await setDoc(doc(db, "Polls", id), {
        question,
        options: options.map((text, idx) => ({ id: idx + 1, text, votes: 0 })),
        voters: [],
        allowTextboxResponse: allowTextbox,
        pollDuration: duration,
        isExpired: false,
        createdAt: new Date().toISOString(),
        maxSelections,
        rankedVoting,
      });
      alert("Poll created successfully!");
      setPollForm({
        id: "",
        question: "",
        options: ["", ""],
        allowTextbox: false,
        duration: "",
        maxSelections: 1,
        rankedVoting: false,
      });
      setModalState((prev) => ({ ...prev, showCreate: false }));
    } catch {
      alert("Failed to create poll. Please try again.");
    }
  };

  const handleEditPollClick = (poll: any) => {
    setEditingPoll(poll);
  };

  const handleEditOptionChange = (index: number, value: string) => {
    setEditForm((prev) => {
      const updated = [...prev.options];
      updated[index] = value;
      return { ...prev, options: updated };
    });
  };

  const handleEditPollSubmit = async () => {
    if (!editingPoll) return;
    const db = getFirestore();
    const updatedOptions = editForm.options.map((text, idx) => ({
      id: idx + 1,
      text,
      votes: editingPoll.options[idx]?.votes || 0,
    }));
    await setDoc(doc(db, "Polls", editingPoll.id), {
      ...editingPoll,
      question: editForm.question,
      options: updatedOptions,
      allowTextboxResponse: !!editForm.allowTextbox,
      pollDuration: editForm.duration || "",
      isExpired: !!editForm.isExpired,
      maxSelections: editForm.maxSelections,
      rankedVoting: editForm.rankedVoting,
    });
    setEditingPoll(null);
  };

  const handleDeleteVote = async (user: string, optionText: string) => {
    if (!editingPoll) return;
    const db = getFirestore();
    const updatedResponses = { ...(editingPoll.responses || {}) };
    delete updatedResponses[user];
    const updatedVoters = (editingPoll.voters || []).filter((v: string) => v !== user);
    const updatedOptions = (editingPoll.options || []).map((opt: any) =>
      opt.text === optionText ? { ...opt, votes: Math.max((opt.votes || 1) - 1, 0) } : opt
    );
    await setDoc(doc(db, "Polls", editingPoll.id), {
      ...editingPoll,
      options: updatedOptions,
      voters: updatedVoters,
      responses: updatedResponses,
    });
    setEditingPoll({
      ...editingPoll,
      options: updatedOptions,
      voters: updatedVoters,
      responses: updatedResponses,
    });
  };

  // --- Render ---
  if (!authState.isAuthorized) return null;

  // Modal classes
  const modalClassName =
    "bg-[#232323] border border-[#333] rounded-xl shadow-lg w-full max-w-2xl mx-4 sm:mx-auto max-h-[80vh] mt-8 flex flex-col";

  return (
    <>
      {/* Main Buttons */}
      <div className="flex flex-col items-center gap-4 w-full">
        <button
          onClick={() => setModalState((prev) => ({ ...prev, showCreate: true }))}
          className="w-48 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition text-lg"
        >
          Create Poll
        </button>
        <button
          onClick={() => setModalState((prev) => ({ ...prev, showResults: true }))}
          className="w-48 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
        >
          Check Results
        </button>
      </div>

      {/* Create Poll Modal */}
      {modalState.showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={modalClassName}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 border-b border-slate-600 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-4">
                <svg className="w-7 h-7 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
                </svg>
                Create a New Poll
              </h2>
              <button
                onClick={() => setModalState((prev) => ({ ...prev, showCreate: false }))}
                className="text-white hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-white/10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {/* Poll ID */}
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll ID</label>
                  <input
                    type="text"
                    value={pollForm.id}
                    onChange={(e) => handlePollFormChange("id", e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {/* Poll Question */}
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll Question</label>
                  <input
                    type="text"
                    value={pollForm.question}
                    onChange={(e) => handlePollFormChange("question", e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {/* Poll Options */}
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll Options</label>
                  <div className="space-y-2">
                    {pollForm.options.map((option, index) => (
                      <input
                        key={index}
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleAddOption}
                    className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                  >
                    Add Option
                  </button>
                </div>
                {/* Poll Duration */}
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll Duration</label>
                  <input
                    type="datetime-local"
                    value={pollForm.duration}
                    onChange={(e) => handlePollFormChange("duration", e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {/* Number of selections allowed */}
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Number of selections allowed</label>
                  <input
                    type="number"
                    min={1}
                    max={pollForm.options.length}
                    value={pollForm.maxSelections}
                    onChange={(e) =>
                      handlePollFormChange("maxSelections", Number(e.target.value))
                    }
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {/* Allow textbox response */}
                <div>
                  <label className="flex items-center gap-2 text-emerald-300 font-medium">
                    <input
                      type="checkbox"
                      checked={pollForm.allowTextbox}
                      onChange={(e) => handlePollFormChange("allowTextbox", e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    Allow users to provide a textbox response with their vote
                  </label>
                </div>
                {/* Ranked voting */}
                <div>
                  <label className="flex items-center gap-2 text-emerald-300 font-medium">
                    <input
                      type="checkbox"
                      checked={pollForm.rankedVoting}
                      onChange={(e) => handlePollFormChange("rankedVoting", e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    Allow users to rank their selections
                  </label>
                </div>
              </div>
            </div>
            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-slate-800/50 border-t border-slate-600 px-8 py-4 flex justify-end gap-4 z-10">
              <button
                onClick={() => setModalState((prev) => ({ ...prev, showCreate: false }))}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePoll}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Check Results Modal */}
      {modalState.showResults && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          onClick={() => setModalState((prev) => ({ ...prev, showResults: false }))}
        >
          <div
            className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[calc(100vh-40px)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 border-b border-slate-600">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-white flex items-center gap-4">
                  <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
                  </svg>
                  Poll Results
                </h2>
                <button
                  onClick={() => setModalState((prev) => ({ ...prev, showResults: false }))}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              {pollResults.length > 0 ? (
                <div className="space-y-8">
                  {pollResults.map((poll, pollIndex) => {
                    const totalVotes = getTotalVotes(poll);
                    const responseCount = poll.responses ? Object.keys(poll.responses).length : 0;

                    return (
                      <div key={poll.id} className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg border border-slate-600 overflow-hidden">
                        {/* Poll Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-white leading-tight mb-2">
                                {poll.question}
                              </h3>
                              <div className="flex items-center gap-4 text-blue-100 text-sm">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {totalVotes} votes
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1a1 1 0 102 0V7zM12 7a1 1 0 112 0v1a1 1 0 11-2 0V7z" />
                                  </svg>
                                  {poll.voters.length} participants
                                </span>
                                {responseCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                                    </svg>
                                    {responseCount} responses
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          {/* Voting Results */}
                          <div className="mb-8">
                            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                              </svg>
                              Vote Distribution
                            </h4>
                            <div className="space-y-4">
                              {poll.rankedVoting ? (
                                // Sort options by score descending
                                [...poll.options]
                                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                                  .map((option: any, idx: number) => {
                                    const maxScore = Math.max(...poll.options.map((opt: any) => opt.score || 0));
                                    return (
                                      <div key={option.id} className={`bg-slate-600/50 rounded-lg p-4 border border-slate-500/50 ${option.score === maxScore && maxScore > 0 ? 'border-yellow-400' : ''}`}>
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-white font-medium truncate flex-1 mr-4">
                                            {option.text}
                                            {option.score === maxScore && maxScore > 0 && (
                                              <span className="ml-2 text-yellow-300 font-bold">(Winner)</span>
                                            )}
                                          </span>
                                          <div className="flex items-center gap-3 text-sm">
                                            <span className="text-blue-300 font-semibold">
                                              {option.score || 0} pts
                                            </span>
                                          </div>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                                          <div
                                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${maxScore ? (option.score || 0) / maxScore * 100 : 0}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                              ) : (
                                // ...existing vote distribution for non-ranked polls...
                                poll.options.map((option: any) => {
                                  const percentage = getVotePercentage(option.votes, totalVotes);
                                  return (
                                    <div key={option.id} className="bg-slate-600/50 rounded-lg p-4 border border-slate-500/50">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-white font-medium truncate flex-1 mr-4">
                                          {option.text}
                                        </span>
                                        <div className="flex items-center gap-3 text-sm">
                                          <span className="text-blue-300 font-semibold">
                                            {option.votes} votes
                                          </span>
                                          <span className="text-gray-300">
                                            {percentage}%
                                          </span>
                                        </div>
                                      </div>
                                      <div className="w-full bg-slate-700 rounded-full h-2.5">
                                        <div
                                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            {/* Participants Dropdown */}
                            <div className="bg-slate-600/30 rounded-lg p-3 border border-slate-500/30">
                              <h4
                                className="text-lg font-semibold text-white flex items-center gap-2 cursor-pointer"
                                onClick={() => setModalState((prev) => ({ ...prev, showParticipants: !prev.showParticipants }))}
                              >
                                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1a1 1 0 102 0V7zM12 7a1 1 0 112 0v1a1 1 0 11-2 0V7z" />
                                </svg>
                                Participants ({poll.voters.length})
                                <svg
                                  className={`w-5 h-5 text-gray-400 transition-transform ${modalState.showParticipants ? 'rotate-180' : ''}`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M5.293 9.293a1 1 0 011.414 0L10 12.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                </svg>
                              </h4>
                              {modalState.showParticipants && (
                                <div style={{ maxHeight: '16rem', overflowY: 'auto', transition: 'max-height 0.3s' }}>
                                  {poll.voters.length > 0 ? (
                                    <div className="space-y-2">
                                      {poll.voters.map((voter: any, index: number) => (
                                        <div key={index} className="bg-slate-700/50 rounded-lg p-3 border-l-4 border-purple-400">
                                          <div className="text-white text-sm flex items-center gap-2">
                                            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                            {voter}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-8">
                                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                      </svg>
                                      <p className="text-gray-400">No participants yet</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Detailed Responses Dropdown */}
                            <div className="bg-slate-600/30 rounded-lg p-3 border border-slate-500/30">
                              <h4
                                className="text-lg font-semibold text-white flex items-center gap-2 cursor-pointer"
                                onClick={() => setModalState((prev) => ({ ...prev, showResponses: !prev.showResponses }))}
                              >
                                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                                </svg>
                                Detailed Responses
                                <svg
                                  className={`w-5 h-5 text-gray-400 transition-transform ${modalState.showResponses ? 'rotate-180' : ''}`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M5.293 9.293a1 1 0 011.414 0L10 12.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                </svg>
                              </h4>
                              {modalState.showResponses && (
                                <div style={{ maxHeight: '16rem', overflowY: 'auto', transition: 'max-height 0.3s' }}>
                                  <div className="space-y-3">
                                    {Object.entries(poll.responses).map(([email, responseData]: [string, any]) => (
                                      <div key={email} className="bg-slate-700/50 rounded-lg p-3 border-l-4 border-green-400">
                                        <div className="text-sm text-gray-300 mb-1">{email}</div>
                                        {/* Multi-selection and ranking support */}
                                        {poll.maxSelections > 1 ? (
                                          <div className="text-white font-medium mb-1">
                                            Voted:
                                            <div className="flex flex-col ml-2">
                                              {Array.isArray(responseData.selectedOptions) && responseData.selectedOptions.length > 0
                                                ? responseData.selectedOptions.map((id: number, idx: number) => {
                                                  const optionObj = poll.options.find((opt: any) => opt.id === id);
                                                  let rankNum = "";
                                                  if (poll.rankedVoting && Array.isArray(responseData.rankings)) {
                                                    const rankIdx = responseData.rankings.indexOf(id);
                                                    if (rankIdx !== -1) {
                                                      rankNum = `${rankIdx + 1}`;
                                                    }
                                                  } else if (poll.rankedVoting) {
                                                    rankNum = `${idx + 1}`;
                                                  }
                                                  return (
                                                    <span key={id} className="inline-block mb-1 flex items-center gap-2">
                                                      {poll.rankedVoting && (
                                                        <span className="text-yellow-300 font-bold min-w-[1.5em] text-center">{rankNum}</span>
                                                      )}
                                                      <span>{optionObj ? optionObj.text : id}</span>
                                                    </span>
                                                  );
                                                })
                                                : <span>No selection</span>}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-white font-medium mb-1">
                                            Voted: {responseData.optionText}
                                          </div>
                                        )}
                                        {responseData.response && (
                                          <div className="text-gray-200 text-sm italic bg-slate-800/50 p-2 rounded mt-2">
                                            "{responseData.response}"
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Edit Poll Button - Inside each poll result card */}
                        <div className="p-6 border-t border-slate-600">
                          <button
                            onClick={() => handleEditPollClick(poll)}
                            className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                          >
                            Edit Poll
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <svg className="w-20 h-20 text-gray-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">No Polls Available</h3>
                  <p className="text-gray-400">Create your first poll to see results here</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-800/50 border-t border-slate-600 p-4">
              <button
                onClick={() => setModalState((prev) => ({ ...prev, showResults: false }))}
                className="w-full px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Poll Modal - When editing a poll */}
      {editingPoll && (
        <div key={editingPoll.id} className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-[#232323] border border-[#333] rounded-xl shadow-lg w-full max-w-xl mx-auto p-6 max-h-[80vh] overflow-y-auto">
            {editForm.modalReady ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll Question</label>
                  <input
                    type="text"
                    value={editForm.question}
                    onChange={e => setEditForm(prev => ({ ...prev, question: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll Options</label>
                  {editForm.options.map((option, idx) => (
                    <div key={idx} className="flex items-center mb-2">
                      {editForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))}
                          className="mr-2 px-2 py-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition text-xs"
                          aria-label="Remove option"
                        >
                          &times;
                        </button>
                      )}
                      <input
                        type="text"
                        value={option}
                        onChange={e => handleEditOptionChange(idx, e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444]"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setEditForm(prev => ({ ...prev, options: [...prev.options, ''] }))}
                    className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                  >
                    Add Option
                  </button>
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Poll Duration</label>
                  <input
                    type="datetime-local"
                    value={editForm.duration}
                    onChange={e => setEditForm(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-2">Number of selections allowed</label>
                  <input
                    type="number"
                    min={1}
                    max={editForm.options.length}
                    value={editForm.maxSelections}
                    onChange={e => {
                      const value = Number(e.target.value);
                      setEditForm(prev => ({ ...prev, maxSelections: value }));
                      if (value <= 1) setEditForm(prev => ({ ...prev, rankedVoting: false }));
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {editForm.maxSelections > 1 && (
                  <div>
                    <label className="flex items-center gap-2 text-emerald-300 font-medium">
                      <input
                        type="checkbox"
                        checked={editForm.rankedVoting}
                        onChange={e => setEditForm(prev => ({ ...prev, rankedVoting: e.target.checked }))}
                        className="rounded text-emerald-500 focus:ring-emerald-500"
                      />
                      Allow users to rank their selections
                    </label>
                  </div>
                )}
                <div>
                  <label className="flex items-center gap-2 text-emerald-300 font-medium">
                    <input
                      type="checkbox"
                      checked={!!editForm.allowTextbox}
                      onChange={e => setEditForm(prev => ({ ...prev, allowTextbox: e.target.checked }))}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    Allow textbox response
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-emerald-300 font-medium">
                    <input
                      type="checkbox"
                      checked={!!editForm.isExpired}
                      onChange={e => setEditForm(prev => ({ ...prev, isExpired: e.target.checked }))}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    Mark poll as expired
                  </label>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setModalState((prev) => ({ ...prev, showEditResponses: !prev.showEditResponses }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {modalState.showEditResponses ? "Hide Edit Responses" : "Edit Responses"}
                  </button>
                </div>
                {modalState.showEditResponses && editingPoll && (
                  <div className="mt-6 bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <h3 className="text-lg font-bold text-emerald-200 mb-4">Edit Responses</h3>
                    {Object.entries(editingPoll.responses || {}).length === 0 ? (
                      <div className="text-gray-400">No responses to edit.</div>
                    ) : (
                      <ul className="space-y-3">
                        {Object.entries(editingPoll.responses || {}).map(([user, response]: [string, any]) => (
                          <li key={user} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                            <div>
                              <span className="font-semibold text-white">{user}</span>
                              {/* Multi-selection and ranking support */}
                              {editingPoll.maxSelections > 1 ? (
                                <span className="ml-2 text-emerald-300">
                                  Voted:&nbsp;
                                  {Array.isArray(response.selectedOptions) && response.selectedOptions.length > 0
                                    ? response.selectedOptions.map((id: number, idx: number) => {
                                      const optionObj = editingPoll.options.find((opt: any) => opt.id === id);
                                      return (
                                        <span key={id} className="inline-block mr-2">
                                          {optionObj ? optionObj.text : id}
                                          {editingPoll.rankedVoting && (
                                            <span className="ml-1 text-yellow-300 font-bold">
                                              (Rank {idx + 1})
                                            </span>
                                          )}
                                        </span>
                                      );
                                    })
                                    : "No selection"}
                                </span>
                              ) : (
                                <span className="ml-2 text-emerald-300">Voted: {response.optionText}</span>
                              )}
                              {response.response && (
                                <span className="ml-2 text-gray-300 italic">"{response.response}"</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteVote(user, editingPoll.maxSelections > 1
                                ? Array.isArray(response.selectedOptions) && response.selectedOptions.length > 0
                                  ? editingPoll.options.find((opt: any) => opt.id === response.selectedOptions[0])?.text
                                  : ""
                                : response.optionText
                              )}
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs flex items-center justify-center"
                              aria-label="Delete vote"
                            >
                              <span className="font-bold text-base" style={{ lineHeight: 1 }}>×</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => setModalState((prev) => ({ ...prev, showEditResponses: false }))}
                      className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Done
                    </button>
                  </div>
                )}
                {editForm.modalReady && (
                  <div className="flex justify-end gap-4 pt-4 border-t border-[#444] mt-6">
                    <button
                      onClick={() => setEditingPoll(null)}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditPollSubmit}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-emerald-300">Loading...</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PollCreator;