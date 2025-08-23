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
  const [showParticipants, setShowParticipants] = useState(true); // State for participants section
  const [showResponses, setShowResponses] = useState(true); // State for detailed responses section
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
  const modalClassName = "bg-[#232323] border border-[#333] rounded-xl shadow-lg w-full max-w-2xl mx-4 sm:mx-auto max-h-[80vh] mt-8 flex flex-col";

  // Calculate total votes for a poll
  const getTotalVotes = (options: any[]) => {
    return options.reduce((total, option) => total + (option.votes || 0), 0);
  };

  // Get percentage for vote visualization
  const getVotePercentage = (votes: number, totalVotes: number) => {
    return totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
  };

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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-[#232323] border border-[#333] rounded-xl shadow-lg w-full max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-emerald-200 mb-6">Create a New Poll</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-emerald-300 font-medium mb-2">Poll ID</label>
                    <input
                      type="text"
                      value={pollId}
                      onChange={(e) => setPollId(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-300 font-medium mb-2">Poll Question</label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-300 font-medium mb-2">Poll Options</label>
                    <div className="space-y-2">
                      {options.map((option, index) => (
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
                  <div>
                    <label className="block text-emerald-300 font-medium mb-2">Poll Duration</label>
                    <input
                      type="datetime-local"
                      value={pollDuration}
                      onChange={(e) => setPollDuration(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-[#333] text-emerald-100 border border-[#444] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
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
                  
                  <div className="flex justify-end gap-4 pt-4 border-t border-[#444] mt-6">
                    <button
                      onClick={() => setShowCreatePollModal(false)}
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
          </div>
        )}

        {/* Enhanced Check Results Modal */}
        {showCheckResultsModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            onClick={() => setShowCheckResultsModal(false)}
          >
            <div
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[calc(100vh-40px)] overflow-hidden" /* Adjusted max height */
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 border-b border-slate-600"> {/* Increased padding */}
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-white flex items-center gap-4"> {/* Updated icon */}
                    <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"> {/* New icon */}
                      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
                    </svg>
                    Poll Results
                  </h2>
                  <button
                    onClick={() => setShowCheckResultsModal(false)}
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
                      const totalVotes = getTotalVotes(poll.options);
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
                              <div className="bg-white/10 px-3 py-1 rounded-full">
                                <span className="text-xs font-medium text-white">Poll #{pollIndex + 1}</span>
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
                                {poll.options.map((option: any) => {
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
                                })}
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                              {/* Detailed Responses */}
                              {poll.responses && Object.keys(poll.responses).length > 0 && (
                                <div className="bg-slate-600/30 rounded-lg p-3 border border-slate-500/30">
                                  <h4
                                    className="text-lg font-semibold text-white flex items-center gap-2 cursor-pointer"
                                    onClick={() => setShowResponses(!showResponses)}
                                  >
                                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                                    </svg>
                                    Detailed Responses
                                    <svg
                                      className={`w-5 h-5 text-gray-400 transition-transform ${showResponses ? 'rotate-180' : ''}`}
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M5.293 9.293a1 1 0 011.414 0L10 12.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                    </svg>
                                  </h4>
                                  {showResponses && (
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                      {Object.entries(poll.responses).map(([email, responseData]: [string, any]) => (
                                        <div key={email} className="bg-slate-700/50 rounded-lg p-3 border-l-4 border-green-400">
                                          <div className="text-sm text-gray-300 mb-1">{email}</div>
                                          <div className="text-white font-medium mb-1">
                                            Voted: {responseData.optionText}
                                          </div>
                                          {responseData.response && (
                                            <div className="text-gray-200 text-sm italic bg-slate-800/50 p-2 rounded mt-2">
                                              "{responseData.response}"
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Voter List */}
                              <div className="bg-slate-600/30 rounded-lg p-3 border border-slate-500/30"> {/* Reduced padding */}
                                <h4
                                  className="text-lg font-semibold text-white flex items-center gap-2 cursor-pointer"
                                  onClick={() => setShowParticipants(!showParticipants)}
                                >
                                  <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1a1 1 0 102 0V7zM12 7a1 1 0 112 0v1a1 1 0 11-2 0V7z" />
                                  </svg>
                                  Participants ({poll.voters.length})
                                  <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${showParticipants ? 'rotate-180' : ''}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M5.293 9.293a1 1 0 011.414 0L10 12.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                  </svg>
                                </h4>
                                {showParticipants && (
                                  poll.voters.length > 0 ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
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
                                  )
                                )}
                              </div>
                            </div>
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
                  onClick={() => setShowCheckResultsModal(false)}
                  className="w-full px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg"
                >
                  Close Results
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