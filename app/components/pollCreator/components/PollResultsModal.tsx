'use client';
import React from "react";
import { onSnapshot, collection, getFirestore } from "firebase/firestore";
import { getTotalVotes, getVotePercentage, getSortedOptionsByPoints } from "../utils/helpers";

export default function PollResultsModal({
  pollResults,
  setPollResults,
  modalState,
  setModalState,
  onEditPoll,
}: {
  pollResults: any[];
  setPollResults: React.Dispatch<React.SetStateAction<any[]>>;
  modalState: any;
  setModalState: React.Dispatch<React.SetStateAction<any>>;
  onEditPoll: (poll: any) => void;
}) {
  React.useEffect(() => {
    if (modalState.showResults) {
      const db = getFirestore();
      const pollsCollection = collection(db, "Polls");
      const unsubscribe = onSnapshot(pollsCollection, (snapshot) => {
        const pollsData = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
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
  }, [modalState.showResults, setPollResults]);

  if (!modalState.showResults) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      onClick={() => setModalState((prev: any) => ({ ...prev, showResults: false }))}
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
              onClick={() => setModalState((prev: any) => ({ ...prev, showResults: false }))}
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
              {pollResults.map((poll) => {
                const totalVotes = getTotalVotes(poll);
                const responseCount = poll.responses ? Object.keys(poll.responses).length : 0;
                const showParticipants = !!modalState.showParticipants;
                const showResponses = !!modalState.showResponses;

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
                                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 01-6-6z" />
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
                            (() => {
                              const sortedOptions = getSortedOptionsByPoints(poll);
                              const maxPoints = Math.max(...sortedOptions.map((opt: any) => opt.calculatedPoints));
                              return sortedOptions.map((option: any) => (
                                <div key={option.id} className={`bg-slate-600/50 rounded-lg p-4 border border-slate-500/50 ${option.calculatedPoints === maxPoints && maxPoints > 0 ? 'border-yellow-400' : ''}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-medium truncate flex-1 mr-4">
                                      {option.text}
                                      {option.calculatedPoints === maxPoints && maxPoints > 0 && (
                                        <span className="ml-2 text-yellow-300 font-bold flex items-center gap-1">
                                          <span>🏆</span> Winner
                                        </span>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="text-blue-300 font-semibold">
                                        {option.calculatedPoints} pts
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-700 rounded-full h-2.5">
                                    <div
                                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                                      style={{ width: `${maxPoints ? (option.calculatedPoints) / maxPoints * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              ));
                            })()
                          ) : (
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
                            onClick={() => setModalState((prev: any) => ({ ...prev, showParticipants: !prev.showParticipants }))}
                          >
                            <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 01-6-6z" />
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
                            onClick={() => setModalState((prev: any) => ({ ...prev, showResponses: !prev.showResponses }))}
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
                                    {poll.maxSelections > 1 ? (
                                      <div className="text-white font-medium mb-1">
                                        Voted:
                                        <div className="flex flex-col ml-2">
                                          {Array.isArray((responseData as any).selectedOptions) && (responseData as any).selectedOptions.length > 0
                                            ? (responseData as any).selectedOptions.map((id: number, idx: number) => {
                                              const optionObj = poll.options.find((opt: any) => opt.id === id);
                                              let rankNum = "";
                                              if (poll.rankedVoting && Array.isArray((responseData as any).rankings)) {
                                                const rankIdx = (responseData as any).rankings.indexOf(id);
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
                                        Voted: {(responseData as any).optionText}
                                      </div>
                                    )}
                                    {(responseData as any).response && (
                                      <div className="text-gray-200 text-sm italic bg-slate-800/50 p-2 rounded mt-2">
                                        "{(responseData as any).response}"
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

                    {/* Edit Poll Button */}
                    <div className="p-6 border-t border-slate-600">
                      <button
                        onClick={() => onEditPoll(poll)}
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
            onClick={() => setModalState((prev: any) => ({ ...prev, showResults: false }))}
            className="w-full px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg"
          >
            Close Results
          </button>
        </div>
      </div>
    </div>
  );
}