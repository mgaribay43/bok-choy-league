'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, getFirestore, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// --- Helpers ---
const calculateTimeLeft = (deadline: string) => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const timeLeft = deadlineDate.getTime() - now.getTime();
  if (timeLeft <= 0) return 'Expired';
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const getUserName = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  const email = user?.email || '';
  const dbInstance = getFirestore();
  let fetchedUserName = email;
  try {
    const querySnapshot = await getDocs(collection(dbInstance, "Login_ID's"));
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.email === email) {
        fetchedUserName = data.name || email;
      }
    });
  } catch (error) {
    console.error('Error fetching user name:', error);
  }
  return fetchedUserName;
};

// --- Custom Hooks ---
function usePolls() {
  const [polls, setPolls] = useState<any[]>([]);
  const [expiredPolls, setExpiredPolls] = useState<any[]>([]);
  const [timeLeftMap, setTimeLeftMap] = useState<{ [pollId: string]: string }>({});

  useEffect(() => {
    const dbInstance = getFirestore();
    const pollsCollection = collection(dbInstance, 'Polls');
    const unsubscribe = onSnapshot(pollsCollection, (querySnapshot) => {
      const fetchedPolls = querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      setPolls(fetchedPolls.filter((poll) => !poll.isExpired));
      setExpiredPolls(fetchedPolls.filter((poll) => poll.isExpired));
      setTimeLeftMap(
        fetchedPolls.reduce((acc: { [key: string]: string }, poll: any) => {
          acc[poll.id] = calculateTimeLeft(poll.pollDuration);
          return acc;
        }, {})
      );
    });
    return () => unsubscribe();
  }, []);

  // Expire polls if needed
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMap((prevTimeLeftMap) => {
        const updatedTimeLeftMap: { [key: string]: string } = {};
        polls.forEach((poll) => {
          const timeLeft = calculateTimeLeft(poll.pollDuration);
          updatedTimeLeftMap[poll.id] = timeLeft;
          if (timeLeft === 'Expired' && !poll.isExpired) {
            const dbInstance = getFirestore();
            const pollDoc = doc(dbInstance, 'Polls', poll.id);
            setDoc(pollDoc, {
              ...poll,
              isExpired: true,
              expirationDate: new Date().toISOString(),
              responses: poll.responses || {},
            }).catch((error) => {
              console.error('Error updating poll expiration:', error);
            });
          }
        });
        return updatedTimeLeftMap;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [polls]);

  return { polls, expiredPolls, timeLeftMap };
}

// --- Main Component ---
const Poll: React.FC<{ ActivePolls?: boolean }> = ({ ActivePolls = false }) => {
  // --- State ---
  const { polls, expiredPolls, timeLeftMap } = usePolls();
  const [showExpired, setShowExpired] = useState(false);
  const [textboxResponses, setTextboxResponses] = useState<{ [pollId: string]: string }>({});
  const [userName, setUserName] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<{ [pollId: string]: number[] }>({});
  const [rankings, setRankings] = useState<{ [pollId: string]: number[] }>({});
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingPollId, setEditingPollId] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    getUserName().then(setUserName);
  }, []);

  // Sync textbox responses with polls
  useEffect(() => {
    if (!userName) return;
    setTextboxResponses((prev) => {
      const updated: { [pollId: string]: string } = { ...prev };
      polls.forEach((poll) => {
        if (poll.responses && poll.responses[userName]?.response !== undefined) {
          updated[poll.id] = poll.responses[userName].response || "";
        }
      });
      return updated;
    });
  }, [polls, userName]);

  // Sync selected options and rankings with polls
  useEffect(() => {
    if (!userName) return;
    setSelectedOptions((prev) => {
      const updated: { [pollId: string]: number[] } = { ...prev };
      polls.forEach((poll) => {
        if (poll.id !== editingPollId) {
          if (
            poll.responses &&
            poll.responses[userName] &&
            JSON.stringify(poll.responses[userName].selectedOptions) !== JSON.stringify(prev[poll.id])
          ) {
            if (poll.maxSelections > 1 && Array.isArray(poll.responses[userName].selectedOptions)) {
              updated[poll.id] = poll.responses[userName].selectedOptions;
            } else {
              updated[poll.id] = [];
            }
          }
        }
      });
      return updated;
    });
    setRankings((prev) => {
      const updated: { [pollId: string]: number[] } = { ...prev };
      polls.forEach((poll) => {
        if (poll.id !== editingPollId) {
          if (
            poll.rankedVoting &&
            poll.responses &&
            poll.responses[userName] &&
            JSON.stringify(poll.responses[userName].rankings) !== JSON.stringify(prev[poll.id])
          ) {
            updated[poll.id] = poll.responses[userName].rankings;
          }
        }
      });
      return updated;
    });
  }, [polls, userName, editingPollId]);

  // --- Handlers ---
  const handleResponseChange = useCallback((pollId: string, value: string) => {
    setTextboxResponses((prevResponses) => ({ ...prevResponses, [pollId]: value }));
  }, []);

  const handleVote = useCallback(async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return;
    const maxSelections = poll.maxSelections || 1;
    let selections: number[] = [];
    if (poll.rankedVoting && maxSelections > 1) {
      selections = rankings[pollId] || [];
    } else {
      selections = selectedOptions[pollId] || [];
    }
    if (selections.length !== maxSelections) {
      setErrorMessage(`Please select ${maxSelections} option${maxSelections > 1 ? 's' : ''} before submitting.`);
      setShowErrorPopup(true);
      return;
    }
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setErrorMessage('You must be logged in to vote.');
      setShowErrorPopup(true);
      return;
    }
    const email = user.email || '';
    let userName = email;
    try {
      const querySnapshot = await getDocs(collection(getFirestore(), "Login_ID's"));
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email === email) {
          userName = data.name || email;
        }
      });
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
    // Update votes for selected options
    const updatedOptions = poll.options.map((option: any) => {
      let updatedOption = { ...option };
      const idx = selections.indexOf(option.id);
      if (poll.rankedVoting && maxSelections > 1 && Array.isArray(selections)) {
        if (idx === 0) {
          updatedOption.votes = option.votes + 1;
        }
        let scoreToAdd = 0;
        if (idx !== -1) {
          scoreToAdd = maxSelections - idx;
          if (scoreToAdd < 1) scoreToAdd = 1;
          updatedOption.score = (option.score || 0) + scoreToAdd;
        }
      } else {
        if (idx !== -1) {
          updatedOption.votes = option.votes + 1;
        }
      }
      return updatedOption;
    });
    const updatedVoters = [...(poll.voters || []), userName];
    const responseObj: any = {
      response: textboxResponses[pollId] || null,
    };
    if (maxSelections > 1) {
      responseObj.selectedOptions = selections;
      if (poll.rankedVoting) {
        responseObj.rankings = selections;
      }
    } else {
      const selectedOptionObj = poll.options.find((option: any) => option.id === selections[0]);
      responseObj.optionText = selectedOptionObj ? selectedOptionObj.text : "";
    }
    const updatedResponses = {
      ...(poll.responses || {}),
      [userName]: responseObj,
    };
    await setDoc(doc(getFirestore(), 'Polls', pollId), {
      ...poll,
      options: updatedOptions,
      voters: updatedVoters,
      responses: updatedResponses,
    });
    setEditingPollId(null);
  }, [polls, rankings, selectedOptions, textboxResponses]);

  const handleEditResponse = useCallback(async (pollId: string) => {
    const dbInstance = getFirestore();
    const pollDocRef = doc(dbInstance, 'Polls', pollId);
    let poll;
    try {
      const pollSnap = await getDoc(pollDocRef);
      if (!pollSnap.exists()) return;
      poll = pollSnap.data();
    } catch (error) {
      console.error('Error fetching latest poll:', error);
      return;
    }
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const email = user.email || '';
    let userName = email;
    try {
      const querySnapshot = await getDocs(collection(dbInstance, "Login_ID's"));
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email === email) {
          userName = data.name || email;
        }
      });
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
    const voters = poll.voters || [];
    const updatedVoters = voters.filter((voter: string) => voter !== userName);
    const userResponse = poll.responses?.[userName];
    let updatedOptions;
    if (poll.maxSelections > 1 && Array.isArray(userResponse?.selectedOptions)) {
      updatedOptions = poll.options.map((option: any) => {
        let updatedOption = { ...option };
        if (userResponse.selectedOptions.includes(option.id)) {
          updatedOption.votes = Math.max(option.votes - 1, 0);
          if (poll.rankedVoting && Array.isArray(userResponse.rankings)) {
            const rankIdx = userResponse.rankings.indexOf(option.id);
            let scoreToRemove = poll.maxSelections - rankIdx;
            if (scoreToRemove < 1) scoreToRemove = 1;
            if (rankIdx !== -1) {
              updatedOption.score = Math.max((option.score || 0) - scoreToRemove, 0);
            }
          }
        }
        return updatedOption;
      });
    } else {
      updatedOptions = poll.options.map((option: any) => {
        let updatedOption = { ...option };
        if (option.text === userResponse?.optionText) {
          updatedOption.votes = Math.max(option.votes - 1, 0);
        }
        return updatedOption;
      });
    }
    const updatedResponses = { ...(poll.responses || {}) };
    delete updatedResponses[userName];
    setTextboxResponses((prev) => ({
      ...prev,
      [pollId]: userResponse?.response || "",
    }));
    await setDoc(pollDocRef, {
      ...poll,
      options: updatedOptions,
      voters: updatedVoters,
      responses: updatedResponses,
    });
    setEditingPollId(pollId);
    setSelectedOptions(prev => ({
      ...prev,
      [pollId]: Array.isArray(userResponse?.selectedOptions) ? userResponse.selectedOptions : [],
    }));
    setRankings(prev => ({
      ...prev,
      [pollId]: Array.isArray(userResponse?.rankings) ? userResponse.rankings : [],
    }));
  }, []);

  // --- Render ---
  const renderPollCard = (poll: any, isExpired: boolean, userHasVoted: boolean, timeLeft: string) => {
    const isEditing = editingPollId === poll.id;
    let ranksArray: number[] = [];
    if (isEditing) {
      ranksArray = poll.rankedVoting && poll.maxSelections > 1
        ? rankings[poll.id] || []
        : selectedOptions[poll.id] || [];
    } else if (userHasVoted && poll.responses && poll.responses[userName]) {
      if (poll.rankedVoting && poll.maxSelections > 1 && Array.isArray(poll.responses[userName].rankings)) {
        ranksArray = poll.responses[userName].rankings;
      } else if (poll.maxSelections > 1 && Array.isArray(poll.responses[userName].selectedOptions)) {
        ranksArray = poll.responses[userName].selectedOptions;
      } else if (poll.responses[userName].optionText) {
        const selectedOption = poll.options.find((opt: any) => opt.text === poll.responses[userName].optionText);
        ranksArray = selectedOption ? [selectedOption.id] : [];
      }
    } else {
      ranksArray = poll.rankedVoting && poll.maxSelections > 1
        ? rankings[poll.id] || []
        : selectedOptions[poll.id] || [];
    }

    return (
      <div key={poll.id} className="w-full max-w-lg bg-[#232323] border border-[#333] rounded-xl p-6 shadow-lg relative px-4 md:px-6 mx-auto">
        <span className="absolute top-4 left-4 text-sm text-emerald-300 font-medium">
          Total Votes: {Array.isArray(poll.voters) ? poll.voters.length : 0}
        </span>
        <h1 className="text-2xl font-extrabold text-emerald-200 mb-6 mt-6 text-center">{poll.question}</h1>
        {poll.rankedVoting && poll.maxSelections > 1 && (
          <h2 className="text-lg font-semibold text-green-300 mb-4 text-center">
            Rank your top {poll.maxSelections}
          </h2>
        )}
        {!poll.rankedVoting && poll.maxSelections > 1 && (
          <h2 className="text-lg font-semibold text-green-300 mb-4 text-center">
            Select your top {poll.maxSelections}
          </h2>
        )}
        <span className="absolute top-4 right-4 text-sm text-emerald-300 font-medium">{timeLeft}</span>
        {userHasVoted && !isEditing && (
          <p className="text-center text-green-500 font-medium mb-4">Your Vote Has Been Cast</p>
        )}
        <ul className="flex flex-col gap-4">
          {poll.options.map((option: any, index: number) => {
            const isSelected = ranksArray.includes(option.id);
            const rankIdx = ranksArray.indexOf(option.id);
            return (
              <li key={`${poll.id}-option-${index}`} className="relative">
                {poll.rankedVoting && isSelected && (
                  <span
                    className="absolute top-2 left-2 text-lg font-bold px-2 py-1 rounded bg-blue-900 text-yellow-300 z-10"
                    style={{ minWidth: 32, textAlign: "center" }}
                  >
                    {rankIdx + 1}
                  </span>
                )}
                <button
                  type="button"
                  disabled={(!isEditing && userHasVoted) || isExpired}
                  className={`w-full py-2 px-4 rounded-lg font-semibold text-lg transition-all
  ${isSelected
                      ? "bg-blue-900 text-white border-2 border-blue-400"
                      : ((!isEditing && userHasVoted) || isExpired)
                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-800"}
`}
                  onClick={() => {
                    if ((!isEditing && userHasVoted) || isExpired) return;
                    if (poll.rankedVoting && poll.maxSelections > 1) {
                      let ranks = rankings[poll.id] || [];
                      if (isSelected) {
                        ranks = ranks.filter(id => id !== option.id);
                      } else if (ranks.length < poll.maxSelections) {
                        ranks = [...ranks, option.id];
                      }
                      setRankings(prev => ({ ...prev, [poll.id]: ranks }));
                    } else {
                      let selections: number[] = selectedOptions[poll.id] || [];
                      if (poll.maxSelections > 1) {
                        if (isSelected) {
                          selections = selections.filter(id => id !== option.id);
                        } else if (selections.length < (poll.maxSelections || 1)) {
                          selections = [...selections, option.id];
                        }
                      } else {
                        selections = [option.id];
                      }
                      setSelectedOptions(prev => ({ ...prev, [poll.id]: selections }));
                    }
                  }}
                >
                  {option.text}
                </button>
              </li>
            );
          })}
        </ul>
        {poll.allowTextboxResponse && (
          <div className="mt-4">
            <label className="block text-emerald-300 font-medium mb-2">Additional Message (optional)</label>
            <textarea
              value={textboxResponses[poll.id] || ''}
              onChange={(e) => handleResponseChange(poll.id, e.target.value)}
              disabled={(!isEditing && userHasVoted) || isExpired}
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${(!isEditing && userHasVoted) || isExpired
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#333] text-emerald-100 border-[#444]'
                }`}
              rows={4}
              placeholder="Type your response here..."
            />
          </div>
        )}
        {userHasVoted && !isExpired && !isEditing && (
          <button
            onClick={() => handleEditResponse(poll.id)}
            className="mt-4 w-full py-2 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
          >
            Edit Response
          </button>
        )}
        <button
          onClick={() => handleVote(poll.id)}
          disabled={(!isEditing && userHasVoted) || isExpired}
          className={`mt-4 w-full py-2 px-4 rounded-lg font-semibold transition
            ${(!isEditing && userHasVoted) || isExpired
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
        >
          Submit Vote
        </button>
      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className={`flex flex-col items-center justify-start gap-4 ${polls.length > 0 ? 'pt-4' : ''} px-6`}>
      {ActivePolls && polls.length > 0 && (
        <div className="w-full max-w-lg mx-auto">
          <h2 className="text-5xl font-extrabold text-emerald-200 mb-6 text-center">Active Polls</h2>
          <div className="space-y-6">
            {polls.map((poll) => {
              const userHasVoted = poll.voters && poll.voters.includes(userName);
              const timeLeft = timeLeftMap[poll.id];
              const isExpired = timeLeft === 'Expired';
              return renderPollCard(poll, isExpired, userHasVoted, timeLeft);
            })}
          </div>
        </div>
      )}
      {!ActivePolls && (
        <>
          {polls.map((poll) => {
            const userHasVoted = poll.voters && poll.voters.includes(userName);
            const timeLeft = timeLeftMap[poll.id];
            const isExpired = timeLeft === 'Expired';
            return renderPollCard(poll, isExpired, userHasVoted, timeLeft);
          })}
          <div className="w-full max-w-lg mx-auto">
            <button
              onClick={() => setShowExpired(!showExpired)}
              className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              {showExpired ? 'Hide Expired Polls' : 'Show Expired Polls'}
            </button>
            {showExpired && expiredPolls.length > 0 && (
              <div className="space-y-6 mt-4">
                {expiredPolls.map((poll) => (
                  <div key={poll.id} className="w-full max-w-lg bg-[#232323] border border-[#333] rounded-xl p-6 shadow-lg relative px-4 md:px-6 mx-auto">
                    <h1 className="text-2xl font-extrabold text-emerald-200 mb-6 mt-6 text-center">{poll.question}</h1>
                    <p className="text-sm text-gray-400 text-center">
                      Expired on: {poll.expirationDate ? new Date(poll.expirationDate).toLocaleString() : new Date(poll.pollDuration).toLocaleString()}
                    </p>
                    <ul className="flex flex-col gap-4">
                      {poll.options.map((option: any, index: number) => (
                        <li key={`${poll.id}-option-${index}`}>
                          <span className={`block mt-2 text-center font-medium ${option.votes === Math.max(...poll.options.map((o: any) => o.votes)) ? 'text-yellow-400 font-bold' : 'text-emerald-300'}`}>
                            {option.text}: {option.votes} votes
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {showErrorPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-slate-800 border border-red-500 rounded-xl shadow-2xl px-8 py-6 flex flex-col items-center">
            <svg className="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
            </svg>
            <span className="text-red-400 font-bold text-lg mb-2">Submission Error</span>
            <span className="text-white mb-4 text-center">{errorMessage}</span>
            <button
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
              onClick={() => setShowErrorPopup(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Poll;