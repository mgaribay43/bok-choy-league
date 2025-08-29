'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, getFirestore, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

const Poll: React.FC<{ ActivePolls?: boolean }> = ({ ActivePolls = false }) => {
  const [polls, setPolls] = useState<any[]>([]);
  const [expiredPolls, setExpiredPolls] = useState<any[]>([]);
  const [showExpired, setShowExpired] = useState(false);
  const [textboxResponses, setTextboxResponses] = useState<{ [pollId: string]: string }>({});
  const [timeLeftMap, setTimeLeftMap] = useState<{ [pollId: string]: string }>({});
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const dbInstance = getFirestore();
    const pollsCollection = collection(dbInstance, 'Polls');

    // Listen for real-time updates
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

  // Update time left every second, expire polls if needed
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMap((prevTimeLeftMap) => {
        const updatedTimeLeftMap = { ...prevTimeLeftMap };
        polls.forEach(async (poll) => {
          const timeLeft = calculateTimeLeft(poll.pollDuration);
          updatedTimeLeftMap[poll.id] = timeLeft;

          if (timeLeft === 'Expired' && !poll.isExpired) {
            try {
              const dbInstance = getFirestore();
              const pollDoc = doc(dbInstance, 'Polls', poll.id);
              await setDoc(pollDoc, {
                ...poll,
                isExpired: true,
                expirationDate: new Date().toISOString(),
                responses: poll.responses || {},
              });
            } catch (error) {
              console.error('Error updating poll expiration:', error);
            }
          }
        });
        return updatedTimeLeftMap;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [polls]);

  // Fetch user name once
  useEffect(() => {
    const fetchUserName = async () => {
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
      setUserName(fetchedUserName);
    };
    fetchUserName();
  }, []);

  // When polls are fetched, populate textboxResponses with previous user responses
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

  const handleVote = async (pollId: string, optionId: number) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert('You must be logged in to vote.');
      return;
    }
    const email = user.email || '';
    const dbInstance = getFirestore();
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

    const userHasVoted =
      (poll.voters && poll.voters.includes(userName)) ||
      (poll.responses && poll.responses[userName]);

    if (userHasVoted) {
      alert('You have already voted.');
      return;
    }

    const updatedOptions = poll.options.map((option: any) =>
      option.id === optionId ? { ...option, votes: option.votes + 1 } : option
    );
    const selectedOption = poll.options.find((option: any) => option.id === optionId)?.text || '';

    try {
      const pollDoc = doc(dbInstance, 'Polls', pollId);
      const updatedVoters = [...(poll.voters || []), userName];
      const updatedResponses = {
        ...(poll.responses || {}),
        [userName]: {
          optionText: selectedOption,
          response: textboxResponses[pollId] || null,
        },
      };
      await setDoc(pollDoc, {
        ...poll,
        options: updatedOptions,
        voters: updatedVoters,
        responses: updatedResponses,
      });
      await refetchPolls();
    } catch (error) {
      console.error('Error updating poll data:', error);
    }
  };

  const handleResponseChange = (pollId: string, value: string) => {
    setTextboxResponses((prevResponses) => ({ ...prevResponses, [pollId]: value }));
  };

  const handleEditResponse = async (pollId: string) => {
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

    const userResponseOptionText = poll.responses?.[userName]?.optionText;
    const updatedOptions = poll.options.map((option: any) => {
      if (option.text === userResponseOptionText) {
        return { ...option, votes: Math.max(option.votes - 1, 0) };
      }
      return option;
    });

    const updatedResponses = { ...(poll.responses || {}) };
    delete updatedResponses[userName];

    // Populate textbox with previous response
    setTextboxResponses((prev) => ({
      ...prev,
      [pollId]: poll.responses?.[userName]?.response || "",
    }));

    await setDoc(pollDocRef, {
      ...poll,
      options: updatedOptions,
      voters: updatedVoters,
      responses: updatedResponses,
    });
    await refetchPolls();
  };

  const refetchPolls = async () => {
    const dbInstance = getFirestore();
    try {
      const pollsCollection = collection(dbInstance, 'Polls');
      const querySnapshot = await getDocs(pollsCollection);
      const fetchedPolls = querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      setPolls(fetchedPolls.filter((poll) => !poll.isExpired));
      setExpiredPolls(fetchedPolls.filter((poll) => poll.isExpired));
      setTimeLeftMap(
        fetchedPolls.reduce((acc: { [key: string]: string }, poll: any) => {
          acc[poll.id] = calculateTimeLeft(poll.pollDuration);
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Error fetching polls:', error);
    }
  };

  // Only return null if there are no polls at all
  if (ActivePolls && polls.length === 0 && expiredPolls.length === 0) {
    return null;
  }

  const renderPollCard = (poll: any, isExpired: boolean, userHasVoted: boolean, timeLeft: string) => {
    // Find user's selected option
    const userSelection = poll.responses?.[userName]?.optionText;

    return (
      <div key={poll.id} className="w-full max-w-lg bg-[#232323] border border-[#333] rounded-xl p-6 shadow-lg relative px-4 md:px-6 mx-auto">
        <span className="absolute top-4 left-4 text-sm text-emerald-300 font-medium">
          Total Votes: {poll.options.reduce((total: number, option: { votes: number }) => total + option.votes, 0)}
        </span>
        <h1 className="text-2xl font-extrabold text-emerald-200 mb-6 mt-6 text-center">{poll.question}</h1>
        <span className="absolute top-4 right-4 text-sm text-emerald-300 font-medium">{timeLeft}</span>
        {userHasVoted && (
          <p className="text-center text-green-500 font-medium mb-4">Your Vote Has Been Cast</p>
        )}
        <ul className="flex flex-col gap-4">
          {poll.options.map((option: any, index: number) => {
            const isUserSelection = userSelection === option.text;
            return (
              <li key={`${poll.id}-option-${index}`}>
                <button
                  onClick={() => handleVote(poll.id, option.id)}
                  disabled={userHasVoted || isExpired}
                  className={`w-full py-2 px-4 rounded-lg font-semibold text-lg transition-all
                  ${userHasVoted || isExpired
                    ? `bg-gray-700 text-gray-400 cursor-not-allowed ${isUserSelection ? "bg-green-700 border-2 border-emerald-400" : ""}`
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {option.text}
                </button>
                {isExpired && (
                  <span className="block mt-2 text-center text-emerald-300 font-medium">{option.votes} votes</span>
                )}
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
              disabled={userHasVoted || isExpired}
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${userHasVoted || isExpired
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#333] text-emerald-100 border-[#444]'
                }`}
              rows={4}
              placeholder="Type your response here..."
            />
          </div>
        )}
        {userHasVoted && !isExpired && (
          <button
            onClick={() => handleEditResponse(poll.id)}
            className="mt-4 w-full py-2 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
          >
            Edit Response
          </button>
        )}
      </div>
    );
  };

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
    </div>
  );
};

export default Poll;