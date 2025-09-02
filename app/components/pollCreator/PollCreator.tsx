'use client';

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

import CreatePollModal from "./components/CreatePollModal";
import PollResultsModal from "./components/PollResultsModal";
import EditPollModal from "./components/EditPollModal";
import { useBodyScrollLock } from "./utils/helpers";

const PollCreator: React.FC = () => {
  // --- State ---
  const [authState, setAuthState] = useState({ isAuthorized: false, user: null as any });
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

  // --- Handlers copied 1:1 where needed ---
  const handleEditPollClick = (poll: any) => setEditingPoll(poll);

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

      {/* Modals */}
      {modalState.showCreate && (
        <CreatePollModal
          pollForm={pollForm}
          setPollForm={setPollForm}
          onClose={() => setModalState((prev) => ({ ...prev, showCreate: false }))}
        />
      )}

      {modalState.showResults && (
        <PollResultsModal
          pollResults={pollResults}
          setPollResults={setPollResults}
          modalState={modalState}
          setModalState={setModalState}
          onEditPoll={handleEditPollClick}
        />
      )}

      {editingPoll && (
        <EditPollModal
          editingPoll={editingPoll}
          setEditingPoll={setEditingPoll}
          editForm={editForm}
          setEditForm={setEditForm}
          modalState={modalState}
          setModalState={setModalState}
          onDeleteVote={handleDeleteVote}
        />
      )}
    </>
  );
};

export default PollCreator;