"use client";

import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';

const PollCreator: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [showCheckResultsModal, setShowCheckResultsModal] = useState(false);
  const [pollId, setPollId] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowTextboxResponse, setAllowTextboxResponse] = useState(false);
  const [pollResults, setPollResults] = useState<any[]>([]);
  const [pollDuration, setPollDuration] = useState('');
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    const fetchAuthorizationStatus = async () => {
      if (!user) {
        router.push('/');
        return;
      }

      const email = user.email || '';
      const dbInstance = getFirestore();

      try {
        const querySnapshot = await getDocs(collection(dbInstance, "Login_ID's"));
        let authorized = false;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.email === email && data.is_commissioner === 'true') {
            authorized = true;
          }
        });

        setIsAuthorized(authorized);

        if (!authorized) {
          router.push('/');
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        router.push('/');
      }
    };

    fetchAuthorizationStatus();
  }, [router]);

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  const handleCreatePoll = async () => {
    if (!pollId.trim() || !question.trim() || options.some((option) => !option.trim()) || !pollDuration) {
      alert('Please fill out the poll ID, question, all options, and set a poll duration.');
      return;
    }

    try {
      const dbInstance = getFirestore();
      const pollDoc = doc(dbInstance, 'Polls', pollId);
      await setDoc(pollDoc, {
        question,
        options: options.map((text, index) => ({ id: index + 1, text, votes: 0 })),
        voters: [],
        allowTextboxResponse,
        pollDuration, // Include the new field in the poll document
      });
      alert('Poll created successfully!');
      setPollId('');
      setQuestion('');
      setOptions(['', '']);
      setAllowTextboxResponse(false); // Reset the checkbox
      setPollDuration(''); // Reset the poll duration
      setShowCreatePollModal(false); // Close the modal
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll. Please try again.');
    }
  };

  const fetchPollResults = async () => {
    try {
      const dbInstance = getFirestore();
      const pollsCollection = collection(dbInstance, 'Polls');
      const pollsSnapshot = await getDocs(pollsCollection);
      const pollsData = pollsSnapshot.docs.map((doc: any) => {
        const data = doc.data();
        console.log('Poll data:', data); // Debugging log to verify poll data structure
        return {
          id: doc.id,
          question: data.question,
          options: data.options,
          voters: data.voters || [],
          responses: data.responses || {}, // Ensure responses field is included and defaults to an empty object if missing
        };
      });
      setPollResults(pollsData);
    } catch (error) {
      console.error('Error fetching poll results:', error);
      alert('Failed to fetch poll results. Please try again.');
    }
  };

  useEffect(() => {
    if (showCheckResultsModal) {
      fetchPollResults();
    }
  }, [showCheckResultsModal]);

  // Add a scroll lock hook to disable scrolling on the page underneath the modal
  function useBodyScrollLock(isLocked: boolean) {
    React.useEffect(() => {
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

  // Apply the scroll lock hook to the modals
  useBodyScrollLock(showCreatePollModal || showCheckResultsModal);

  // Adjust modal container to ensure it is positioned below the navbar
  const modalClassName = "bg-[#232323] border border-[#333] rounded-xl p-6 shadow-lg w-full max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto mt-16";

  if (!isAuthorized) {
    return null; // Optionally, show a loading spinner here
  }

  return (
    <div className="min-h-screen flex items-start justify-center">
      <div className="w-full max-w-4xl border border-[#333] rounded-xl p-6 shadow-lg">

        {/* Default Buttons */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setShowCreatePollModal(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
          >
            Create Poll
          </button>
          <button
            onClick={() => setShowCheckResultsModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Check Results
          </button>
        </div>

        {/* Create Poll Modal */}
        {showCreatePollModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className={modalClassName}>
              <h2 className="text-2xl font-bold text-emerald-200 mb-4">Create a New Poll</h2>
              <div className="mb-4">
                <label className="block text-emerald-300 font-medium mb-2">Poll ID</label>
                <input
                  type="text"
                  value={pollId}
                  onChange={(e) => setPollId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-emerald-300 font-medium mb-2">Poll Question</label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-emerald-300 font-medium mb-2">Poll Options</label>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ))}
                <button
                  onClick={handleAddOption}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  Add Option
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-emerald-300 font-medium mb-2">Poll Duration (YYYY-MM-DD HH:mm)</label>
                <input
                  type="datetime-local"
                  value={pollDuration}
                  onChange={(e) => setPollDuration(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 text-emerald-300 font-medium">
                  <input
                    type="checkbox"
                    checked={allowTextboxResponse}
                    onChange={(e) => setAllowTextboxResponse(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  Allow users to provide a textbox response with their vote
                </label>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowCreatePollModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePoll}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                >
                  Create Poll
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Check Results Modal */}
        {showCheckResultsModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
            onClick={() => setShowCheckResultsModal(false)}
          >
            <div
              className={modalClassName}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
              <h2 className="text-2xl font-bold text-blue-200 mb-4">Check Poll Results</h2>
              {pollResults.length > 0 ? (
                <div className="space-y-4">
                  {pollResults.map((poll) => (
                    <div key={poll.id} className="bg-gradient-to-r from-blue-900 to-blue-700 p-6 rounded-lg shadow-lg">
                      <h3 className="text-2xl font-bold text-white mb-4">{poll.question}</h3>
                      <ul className="mb-4 space-y-2">
                        {poll.options.map((option: any) => (
                          <li key={option.id} className="text-lg text-blue-200 flex justify-between">
                            <span>{option.text}</span>
                            <span className="font-semibold">{option.votes} votes</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mb-4">
                        <h4 className="text-xl font-semibold text-white mb-2">Responses:</h4>
                        {poll.responses && Object.keys(poll.responses).length > 0 ? (
                          <ul className="space-y-2">
                            {Object.entries(poll.responses).map(([email, responseData]: [string, any]) => (
                              <li key={email} className="text-blue-200">
                                <span className="font-medium">{email}:</span> {responseData.optionText}
                                {responseData.response && (
                                  <span className="italic">, Response: {responseData.response}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-blue-300">No responses available.</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-semibold text-white mb-2">Voters:</h4>
                        {poll.voters.length > 0 ? (
                          <ul className="space-y-1">
                            {poll.voters.map((voter: any, index: number) => (
                              <li key={index} className="text-blue-200">{voter}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-blue-300">No voters available.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-blue-400">No polls available.</p>
              )}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowCheckResultsModal(false)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollCreator;