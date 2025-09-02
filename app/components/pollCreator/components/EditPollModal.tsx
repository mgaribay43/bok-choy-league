'use client';
import React from "react";
import { doc, setDoc, getFirestore } from "firebase/firestore";

export default function EditPollModal({
  editingPoll,
  setEditingPoll,
  editForm,
  setEditForm,
  modalState,
  setModalState,
  onDeleteVote,
}: {
  editingPoll: any;
  setEditingPoll: React.Dispatch<React.SetStateAction<any>>;
  editForm: any;
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  modalState: any;
  setModalState: React.Dispatch<React.SetStateAction<any>>;
  onDeleteVote: (user: string, optionText: string) => Promise<void>;
}) {
  if (!editingPoll) return null;

  const handleEditOptionChange = (index: number, value: string) => {
    setEditForm((prev: any) => {
      const updated = [...prev.options];
      updated[index] = value;
      return { ...prev, options: updated };
    });
  };

  const handleEditPollSubmit = async () => {
    if (!editingPoll) return;
    const db = getFirestore();
    const updatedOptions = editForm.options.map((text: string, idx: number) => ({
      id: idx + 1,
      text,
      votes: editingPoll.options[idx]?.votes || 0,
    }));

    let expirationDate = editingPoll.expirationDate || null;
    if (editForm.isExpired && !editingPoll.isExpired) {
      expirationDate = new Date().toISOString();
    } else if (!editForm.isExpired) {
      expirationDate = null;
    }

    await setDoc(doc(db, "Polls", editingPoll.id), {
      ...editingPoll,
      question: editForm.question,
      options: updatedOptions,
      allowTextboxResponse: !!editForm.allowTextbox,
      pollDuration: editForm.duration || "",
      isExpired: !!editForm.isExpired,
      maxSelections: editForm.maxSelections,
      rankedVoting: editForm.rankedVoting,
      expirationDate,
    });
    setEditingPoll(null);
  };

  return (
    <div key={editingPoll.id} className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-[#232323] border border-[#333] rounded-xl shadow-lg w-full max-w-xl mx-auto p-6 max-h-[80vh] overflow-y-auto">
        {editForm.modalReady ? (
          <div className="space-y-4">
            <div>
              <label className="block text-emerald-300 font-medium mb-2">Poll Question</label>
              <input
                type="text"
                value={editForm.question}
                onChange={e => setEditForm((prev: any) => ({ ...prev, question: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-emerald-300 font-medium mb-2">Poll Options</label>
              {editForm.options.map((option: string, idx: number) => (
                <div key={idx} className="flex items-center mb-2">
                  {editForm.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setEditForm((prev: any) => ({ ...prev, options: prev.options.filter((_: any, i: number) => i !== idx) }))}
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
                onClick={() => setEditForm((prev: any) => ({ ...prev, options: [...prev.options, ''] }))}
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
                onChange={e => setEditForm((prev: any) => ({ ...prev, duration: e.target.value }))}
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
                  setEditForm((prev: any) => ({ ...prev, maxSelections: value }));
                  if (value <= 1) setEditForm((prev: any) => ({ ...prev, rankedVoting: false }));
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
                    onChange={e => setEditForm((prev: any) => ({ ...prev, rankedVoting: e.target.checked }))}
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
                  onChange={e => setEditForm((prev: any) => ({ ...prev, allowTextbox: e.target.checked }))}
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
                  onChange={e => setEditForm((prev: any) => ({ ...prev, isExpired: e.target.checked }))}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                Mark poll as expired
              </label>
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setModalState((prev: any) => ({ ...prev, showEditResponses: !prev.showEditResponses }))}
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
                          {editingPoll.maxSelections > 1 ? (
                            <span className="ml-2 text-emerald-300">
                              Voted:&nbsp;
                              {Array.isArray((response as any).selectedOptions) && (response as any).selectedOptions.length > 0
                                ? (response as any).selectedOptions.map((id: number, idx: number) => {
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
                            <span className="ml-2 text-emerald-300">Voted: {(response as any).optionText}</span>
                          )}
                          {(response as any).response && (
                            <span className="ml-2 text-gray-300 italic">"{(response as any).response}"</span>
                          )}
                        </div>
                        <button
                          onClick={() => onDeleteVote(user, editingPoll.maxSelections > 1
                            ? (Array.isArray((response as any).selectedOptions) && (response as any).selectedOptions.length > 0
                                ? editingPoll.options.find((opt: any) => opt.id === (response as any).selectedOptions[0])?.text
                                : "")
                            : (response as any).optionText
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
                  onClick={() => setModalState((prev: any) => ({ ...prev, showEditResponses: false }))}
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
  );
}