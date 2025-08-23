'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, getFirestore, setDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

type PollOption = {
  id: number;
  text: string;
  votes: number;
};

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
  const [textboxResponses, setTextboxResponses] = useState<{ [pollId: string]: string }>({});
  const [timeLeftMap, setTimeLeftMap] = useState<{ [pollId: string]: string }>({});
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const dbInstance = getFirestore();
        const pollsCollection = collection(dbInstance, 'Polls');
        const querySnapshot = await getDocs(pollsCollection);
        const fetchedPolls = querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

        setPolls((prevPolls) => {
          const mergedPolls = fetchedPolls.map((fetchedPoll) => {
            const existingPoll = prevPolls.find((p) => p.id === fetchedPoll.id);
            return existingPoll ? { ...fetchedPoll, responses: existingPoll.responses } : fetchedPoll;
          });
          return mergedPolls;
        });

        const initialTimeLeftMap = fetchedPolls.reduce((acc: { [key: string]: string }, poll: any) => {
          acc[poll.id] = calculateTimeLeft(poll.pollDuration);
          return acc;
        }, {});
        setTimeLeftMap(initialTimeLeftMap);
      } catch (error) {
        console.error('Error fetching polls:', error);
      }
    };

    fetchPolls();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMap((prevTimeLeftMap) => {
        const updatedTimeLeftMap = { ...prevTimeLeftMap };
        polls.forEach((poll) => {
          updatedTimeLeftMap[poll.id] = calculateTimeLeft(poll.pollDuration);
        });
        return updatedTimeLeftMap;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [polls]);

  useEffect(() => {
    const fetchUserName = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      const email = user?.email || '';

      const dbInstance = getFirestore();
      let fetchedUserName = email; // Default to email if name is not found
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

    // Fetch the user's name from the Login_ID's collection
    const dbInstance = getFirestore();
    let userName = email; // Default to email if name is not found
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

    if (poll.voters && poll.voters.includes(userName)) {
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
          response: textboxResponses[pollId] || null, // Include the textbox response if it exists
        },
      };

      await setDoc(pollDoc, {
        ...poll,
        options: updatedOptions,
        voters: updatedVoters,
        responses: updatedResponses, // Save the updated responses
      });

      setPolls((prevPolls) =>
        prevPolls.map((p) =>
          p.id === pollId
            ? { ...p, options: updatedOptions, voters: updatedVoters, responses: updatedResponses }
            : p
        )
      );
    } catch (error) {
      console.error('Error updating poll data:', error);
    }
  };

  const handleResponseChange = (pollId: string, value: string) => {
    setTextboxResponses((prevResponses) => ({ ...prevResponses, [pollId]: value }));
  };

  const handleEditResponse = async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return;

    try {
      const dbInstance = getFirestore();
      const pollDoc = doc(dbInstance, 'Polls', pollId);

      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const email = user.email || '';

        // Fetch the user's name from the Login_ID's collection
        let userName = email; // Default to email if name is not found
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

        // Identify the option the user voted for and decrement its vote count
        const userResponseOptionText = poll.responses?.[userName]?.optionText;
        const updatedOptions = poll.options.map((option: any) => {
          if (option.text === userResponseOptionText) {
            return { ...option, votes: Math.max(option.votes - 1, 0) }; // Ensure votes don't go below 0
          }
          return option;
        });

        const updatedResponses = { ...(poll.responses || {}) };
        delete updatedResponses[userName]; // Remove the user's response

        await setDoc(pollDoc, {
          ...poll,
          options: updatedOptions,
          voters: updatedVoters,
          responses: updatedResponses,
        });

        setPolls((prevPolls) =>
          prevPolls.map((p) =>
            p.id === pollId
              ? { ...p, options: updatedOptions, voters: updatedVoters, responses: updatedResponses }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error editing response:', error);
    }
  };

  // Only render polls if there are active ones
  if (ActivePolls && polls.length === 0) {
    return null;
  }

  // Ensure no gap is rendered if there are no polls
  if (polls.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center justify-start gap-4 ${polls.length > 0 ? 'pt-4' : ''} px-6`}>
      {ActivePolls && polls.length > 0 && (
        <div className="w-full max-w-lg mx-auto">
          <h2 className="text-5xl font-extrabold text-emerald-200 mb-6 text-center">Active Polls</h2>
          {polls.map((poll) => {
            const userHasVoted = poll.voters && poll.voters.includes(userName);
            const timeLeft = timeLeftMap[poll.id];
            const isExpired = timeLeft === 'Expired';

            const pollCard = (
              <div key={poll.id} className="w-full max-w-lg bg-[#232323] border border-[#333] rounded-xl p-6 shadow-lg relative px-4 md:px-6 mx-auto">
                <span className="absolute top-4 left-4 text-sm text-emerald-300 font-medium">Total Votes: {poll.options.reduce((total: number, option: { votes: number }) => total + option.votes, 0)}</span>
                <h1 className="text-2xl font-extrabold text-emerald-200 mb-6 mt-6 text-center">{poll.question}</h1>
                <span className="absolute top-4 right-4 text-sm text-emerald-300 font-medium">{timeLeft}</span>
                {userHasVoted && (
                  <p className="text-center text-green-500 font-medium mb-4">Your Vote Has Been Cast</p>
                )}
                <ul className="flex flex-col gap-4">
                  {poll.options.map((option: any, index: number) => (
                    <li key={`${poll.id}-option-${index}`}>
                      <button
                        onClick={() => handleVote(poll.id, option.id)}
                        disabled={userHasVoted || isExpired}
                        className={`w-full py-2 px-4 rounded-lg font-semibold text-lg transition-all ${
                          userHasVoted || isExpired
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {option.text}
                      </button>
                      {isExpired && (
                        <span className="block mt-2 text-center text-emerald-300 font-medium">{option.votes} votes</span>
                      )}
                    </li>
                  ))}
                </ul>
                {poll.allowTextboxResponse && (
                  <div className="mt-4">
                    <label className="block text-emerald-300 font-medium mb-2">Additional Message (optional)</label>
                    <textarea
                      value={textboxResponses[poll.id] || ''}
                      onChange={(e) => handleResponseChange(poll.id, e.target.value)}
                      disabled={userHasVoted || isExpired} // Disable the textbox if the poll is expired
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        userHasVoted || isExpired
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-[#333] text-emerald-100 border-[#444]'
                      }`}
                      rows={4}
                    />
                  </div>
                )}
                {userHasVoted && (
                  <button
                    onClick={() => handleEditResponse(poll.id)}
                    className="mt-4 w-full py-2 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                  >
                    Edit Response
                  </button>
                )}
              </div>
            );

            return ActivePolls ? (
              <div className="w-full max-w-lg mx-auto" key={`active-poll-${poll.id}`}>
                {/* Added unique key for ActivePolls render */}
                {pollCard}
              </div>
            ) : (
              <div key={`poll-wrapper-${poll.id}`} className="w-full max-w-lg mx-auto">
                {/* Ensured unique key for individual poll cards */}
                {pollCard}
              </div>
            );
          })}
        </div>
      )}
      {!ActivePolls && polls.map((poll) => {
        const userHasVoted = poll.voters && poll.voters.includes(userName);
        const timeLeft = timeLeftMap[poll.id];
        const isExpired = timeLeft === 'Expired';

        const pollCard = (
          <div key={poll.id} className="w-full max-w-lg bg-[#232323] border border-[#333] rounded-xl p-6 shadow-lg relative px-4 md:px-6 mx-auto">
            <span className="absolute top-4 left-4 text-sm text-emerald-300 font-medium">Total Votes: {poll.options.reduce((total: number, option: { votes: number }) => total + option.votes, 0)}</span>
            <h1 className="text-2xl font-extrabold text-emerald-200 mb-6 mt-6 text-center">{poll.question}</h1>
            <span className="absolute top-4 right-4 text-sm text-emerald-300 font-medium">{timeLeft}</span>
            {userHasVoted && (
              <p className="text-center text-green-500 font-medium mb-4">Your Vote Has Been Cast</p>
            )}
            <ul className="flex flex-col gap-4">
              {poll.options.map((option: any, index: number) => (
                <li key={`${poll.id}-option-${index}`}>
                  <button
                    onClick={() => handleVote(poll.id, option.id)}
                    disabled={userHasVoted || isExpired}
                    className={`w-full py-2 px-4 rounded-lg font-semibold text-lg transition-all ${
                      userHasVoted || isExpired
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {option.text}
                  </button>
                  {isExpired && (
                    <span className="block mt-2 text-center text-emerald-300 font-medium">{option.votes} votes</span>
                  )}
                </li>
              ))}
            </ul>
            {poll.allowTextboxResponse && (
              <div className="mt-4">
                <label className="block text-emerald-300 font-medium mb-2">Additional Message (optional)</label>
                <textarea
                  value={textboxResponses[poll.id] || ''}
                  onChange={(e) => handleResponseChange(poll.id, e.target.value)}
                  disabled={userHasVoted || isExpired} // Disable the textbox if the poll is expired
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    userHasVoted || isExpired
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-[#333] text-emerald-100 border-[#444]'
                  }`}
                  rows={4}
                />
              </div>
            )}
            {userHasVoted && (
              <button
                onClick={() => handleEditResponse(poll.id)}
                className="mt-4 w-full py-2 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
              >
                Edit Response
              </button>
            )}
          </div>
        );

        return ActivePolls ? (
          <div className="w-full max-w-lg mx-auto" key={`active-poll-${poll.id}`}>
            {/* Added unique key for ActivePolls render */}
            {pollCard}
          </div>
        ) : (
          <div key={`poll-wrapper-${poll.id}`} className="w-full max-w-lg mx-auto">
            {/* Ensured unique key for individual poll cards */}
            {pollCard}
          </div>
        );
      })}
    </div>
  );
};

export default Poll;