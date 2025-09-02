'use client';
import React from "react";
import { setDoc, doc, getFirestore } from "firebase/firestore";

type PollForm = {
  id: string;
  question: string;
  options: string[];
  allowTextbox: boolean;
  duration: string;
  maxSelections: number;
  rankedVoting: boolean;
};

export default function CreatePollModal({
  pollForm,
  setPollForm,
  onClose,
}: {
  pollForm: PollForm;
  setPollForm: React.Dispatch<React.SetStateAction<PollForm>>;
  onClose: () => void;
}) {
  const modalClassName =
    "bg-[#232323] border border-[#333] rounded-2xl shadow-lg w-full max-w-2xl mx-4 sm:mx-auto max-h-[80vh] mt-8 flex flex-col";

  const handlePollFormChange = (field: string, value: any) => {
    setPollForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddOption = () => {
    setPollForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setPollForm((prev) => {
      const updated = [...prev.options];
      updated[index] = value;
      return { ...prev, options: updated };
    });
  };

  const handleRemoveOption = (index: number) => {
    setPollForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
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
      onClose();
    } catch {
      alert("Failed to create poll. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-[#232323] border border-[#333] rounded-xl shadow-lg w-full max-w-xl mx-auto p-6 max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 border-b border-slate-600 flex items-center justify-between rounded-t-xl -mx-6 -mt-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-4">
              <svg className="w-7 h-7 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
              </svg>
              Create a New Poll
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Modal Content */}
          <div className="space-y-4 pt-4">
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
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {pollForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        title="Remove option"
                      >
                        &times;
                      </button>
                    )}
                  </div>
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
                onChange={(e) => handlePollFormChange("maxSelections", Number(e.target.value))}
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
          {/* Footer */}
          <div className="flex justify-end gap-4 pt-4 border-t border-[#444] mt-6">
            <button
              onClick={onClose}
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
    </div>
  );
}