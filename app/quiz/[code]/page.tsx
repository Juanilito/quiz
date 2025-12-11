'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, realtimeFallback } from '@/lib/supabase';
import { QUIZ_QUESTIONS, TOTAL_QUESTIONS } from '@/lib/quiz-questions';
import RankingDisplay from '@/components/RankingDisplay';
import WinnerDisplay from '@/components/WinnerDisplay';
import ConnectionStatus from '@/components/ConnectionStatus';

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  
  const [session, setSession] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [useRealtime, setUseRealtime] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const timeoutSubmittedRef = useRef(false);
  const sessionChannelRef = useRef<any>(null);
  const answerChannelRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const realtimeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const participantId = localStorage.getItem(`participant_${code}`);
    if (!participantId) {
      router.push(`/join/${code}`);
      return;
    }

    loadParticipant(participantId);
    loadSession();
    const unsubscribe = subscribeToSession();

    return () => {
      if (unsubscribe) unsubscribe();
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
    };
  }, [code]);

  useEffect(() => {
    if (session?.question_start_time && session?.status === 'active') {
      const startTime = new Date(session.question_start_time);
      const questionIndex = session.current_question_index ?? 0;
      
      console.log('⏰ Setting up timer for question', questionIndex, 'at', startTime);
      
      setQuestionStartTime(startTime);
      setHasAnswered(false);
      setSelectedAnswer(null);
      timeoutSubmittedRef.current = false; // Reset timeout flag for new question
      updateTimer(startTime);
      
      const interval = setInterval(() => {
        // Use ref to get latest session state
        const currentSession = sessionRef.current;
        if (currentSession?.question_start_time && currentSession?.status === 'active') {
          const currentStartTime = new Date(currentSession.question_start_time);
          updateTimer(currentStartTime);
        }
      }, 100);
      
      return () => {
        console.log('🧹 Cleaning up timer for question', questionIndex);
        clearInterval(interval);
      };
    } else {
      // Clear timer if session is not active
      setTimeRemaining(0);
    }
  }, [session?.question_start_time, session?.current_question_index, session?.status]);

  useEffect(() => {
    if (session && participant) {
      console.log('🔍 Checking if answered for question', session.current_question_index);
      checkIfAnswered();
      // Subscribe to answer changes for this question
      const unsubscribe = subscribeToAnswers();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [session?.current_question_index, session?.id, participant?.id]);

  const updateTimer = (startTime: Date) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const questionIndex = currentSession.current_question_index ?? 0;
    const timeLimit = QUIZ_QUESTIONS[questionIndex]?.timeLimit ?? 30;
    const remaining = Math.max(0, timeLimit * 1000 - elapsed);
    setTimeRemaining(remaining);

    // Only auto-submit timeout if time is up and hasn't answered yet
    // Check remaining <= 100 to account for timing precision
    // Use ref to prevent multiple submissions
    if (remaining <= 100 && !hasAnswered && !timeoutSubmittedRef.current) {
      timeoutSubmittedRef.current = true; // Mark as submitted
      // Time's up, auto-submit if not answered
      handleAnswer(-1); // -1 means timeout/no answer
    }
  };

  const loadParticipant = async (participantId: string) => {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (error || !data) {
      router.push(`/join/${code}`);
      return;
    }

    setParticipant(data);
  };

  const loadSession = async () => {
    const { data, error } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('session_code', code)
      .single();

    if (error) {
      console.error('Error loading session:', error);
      return;
    }

    sessionRef.current = data;
    setSession(data);
    setIsLoading(false);
  };

  const subscribeToSession = () => {
    console.log('🚀 Participant: Setting up session subscription for code:', code);

    // Clean up existing channel if any
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
    }

    let realtimeWorking = false;
    let pollingActive = false;
    let stopPolling: (() => void) | null = null;

    const channel = supabase
      .channel(`session-participant-${code}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `session_code=eq.${code}`,
        },
        (payload) => {
          if (!realtimeWorking) {
            realtimeWorking = true;
            setUseRealtime(true);
            console.log('✅ Participant: Realtime now working, stopping polling fallback');
            if (stopPolling && pollingActive) {
              stopPolling();
              stopPolling = null;
              pollingActive = false;
            }
          }

          console.log('🔄 Participant: REALTIME session update received:', payload.eventType);

          const newSession = payload.new as any;

          if (!newSession) {
            console.error('❌ Participant: No new session data in payload');
            return;
          }

          // Use functional update to compare with previous state
          setSession((prevSession: any) => {
            console.log('📊 Participant: Realtime - Previous:', {
              status: prevSession?.status,
              questionIndex: prevSession?.current_question_index,
            });
            console.log('📊 Participant: Realtime - New:', {
              status: newSession.status,
              questionIndex: newSession.current_question_index,
            });

            // Reset answer state when question changes
            const questionChanged = newSession.current_question_index !== prevSession?.current_question_index;
            const statusChanged = newSession.status !== prevSession?.status;

            if (questionChanged) {
              console.log('📝 Participant: Realtime - Question changed, resetting answer state');
              setHasAnswered(false);
              setSelectedAnswer(null);
              timeoutSubmittedRef.current = false;
            }

            if (statusChanged) {
              console.log(`📊 Participant: Realtime - Status changed: ${prevSession?.status} → ${newSession.status}`);
              if (newSession.status === 'active' && questionChanged) {
                setHasAnswered(false);
                setSelectedAnswer(null);
                timeoutSubmittedRef.current = false;
              }
            }

            // Update question start time if it changes
            if (newSession.question_start_time) {
              const newStartTime = new Date(newSession.question_start_time);
              console.log('⏰ Participant: Realtime - Updating question start time:', newStartTime);
              setQuestionStartTime(newStartTime);
            }

            // Update ref to keep it in sync
            sessionRef.current = newSession;
            setLastUpdate(new Date());

            return newSession;
          });

          console.log('✅ Participant: Session state updated successfully');
        }
      )
      .subscribe((status) => {
        console.log('📡 Participant: Subscription status changed:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Participant: Successfully subscribed to session updates');
          realtimeWorking = true;
          setUseRealtime(true);
          // Stop polling if it's running
          if (stopPolling && pollingActive) {
            console.log('🔌 Participant: Stopping polling since realtime is working');
            stopPolling();
            stopPolling = null;
            pollingActive = false;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Participant: Channel error - falling back to polling');
          realtimeWorking = false;
          setUseRealtime(false);
          startPollingIfNeeded();
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Participant: Subscription timed out - falling back to polling');
          realtimeWorking = false;
          setUseRealtime(false);
          startPollingIfNeeded();
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Participant: Subscription closed - falling back to polling');
          realtimeWorking = false;
          setUseRealtime(false);
          startPollingIfNeeded();
        } else {
          console.log('📡 Participant: Subscription status:', status);
        }
      });

    sessionChannelRef.current = channel;

    const startPollingIfNeeded = () => {
      if (!pollingActive && !realtimeWorking) {
        console.log('🔄 Participant: Starting polling fallback');
        pollingActive = true;
        stopPolling = realtimeFallback.pollSession(code, (data) => {
          if (!realtimeWorking) { // Only use polling data if realtime isn't working
            console.log('🔄 Participant: Session update received via polling');
            setSession((prevSession: any) => {
              const questionChanged = data.current_question_index !== prevSession?.current_question_index;
              const statusChanged = data.status !== prevSession?.status;

              if (questionChanged) {
                console.log('📝 Participant: Polling - Question changed, resetting answer state');
                setHasAnswered(false);
                setSelectedAnswer(null);
                timeoutSubmittedRef.current = false;
              }

              if (statusChanged) {
                console.log(`📊 Participant: Polling - Status changed: ${prevSession?.status} → ${data.status}`);
                if (data.status === 'active' && questionChanged) {
                  setHasAnswered(false);
                  setSelectedAnswer(null);
                  timeoutSubmittedRef.current = false;
                }
              }

              if (data.question_start_time) {
                const newStartTime = new Date(data.question_start_time);
                console.log('⏰ Participant: Polling - Updating question start time:', newStartTime);
                setQuestionStartTime(newStartTime);
              }

              sessionRef.current = data;
              setLastUpdate(new Date());
              return data;
            });
          }
        });
      }
    };

    // Set up polling fallback after 2 seconds if realtime doesn't work
    const pollingTimeout = setTimeout(() => {
      if (!realtimeWorking) {
        console.log('⚠️ Participant: Realtime not working after 2s, starting polling fallback');
        setUseRealtime(false);
        startPollingIfNeeded();
      }
    }, 2000);

    return () => {
      console.log('🔌 Unsubscribing from session updates (participant)');
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      if (stopPolling) {
        stopPolling();
        stopPolling = null;
        pollingActive = false;
      }
      clearTimeout(pollingTimeout);
    };
  };

  const checkIfAnswered = async () => {
    if (!session || !participant) return;

    const { data } = await supabase
      .from('answers')
      .select('*')
      .eq('session_id', session.id)
      .eq('participant_id', participant.id)
      .eq('question_index', session.current_question_index)
      .maybeSingle();

    if (data) {
      setHasAnswered(true);
      // Handle timeout case where answer is 'timeout'
      if (data.answer === 'timeout') {
        setSelectedAnswer(null);
      } else {
        const parsed = parseInt(data.answer);
        setSelectedAnswer(isNaN(parsed) ? null : parsed);
      }
    } else {
      // Reset if no answer found (new question)
      setHasAnswered(false);
      setSelectedAnswer(null);
      timeoutSubmittedRef.current = false;
    }
  };

  const subscribeToAnswers = () => {
    if (!session || !participant) return;

    // Clean up existing channel if any
    if (answerChannelRef.current) {
      supabase.removeChannel(answerChannelRef.current);
    }

    let realtimeWorking = false;
    let pollingActive = false;
    let stopPolling: (() => void) | null = null;

    const channel = supabase
      .channel(`answers-${code}-${session.id}-${participant.id}-${session.current_question_index}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
          filter: `session_id=eq.${session.id} AND participant_id=eq.${participant.id} AND question_index=eq.${session.current_question_index}`,
        },
        (payload) => {
          if (!realtimeWorking) {
            realtimeWorking = true;
            console.log('✅ Participant: Realtime answers now working, stopping polling');
            if (stopPolling && pollingActive) {
              stopPolling();
              stopPolling = null;
              pollingActive = false;
            }
          }
          console.log('📝 Participant: Realtime answer update received');
          if (payload.new) {
            const answer = payload.new as any;
            setHasAnswered(true);
            if (answer.answer === 'timeout') {
              setSelectedAnswer(null);
            } else {
              const parsed = parseInt(answer.answer);
              setSelectedAnswer(isNaN(parsed) ? null : parsed);
            }
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Participant: Realtime answers subscription successful');
          realtimeWorking = true;
          // Stop polling if it's running
          if (stopPolling && pollingActive) {
            console.log('🔌 Participant: Stopping answers polling since realtime is working');
            stopPolling();
            stopPolling = null;
            pollingActive = false;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Participant: Realtime answers channel error, falling back to polling');
          realtimeWorking = false;
          startPollingIfNeeded();
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Participant: Answers subscription timed out - falling back to polling');
          realtimeWorking = false;
          startPollingIfNeeded();
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Participant: Answers subscription closed - falling back to polling');
          realtimeWorking = false;
          startPollingIfNeeded();
        } else {
          console.log('📡 Participant: Answer subscription status:', status);
        }
      });

    answerChannelRef.current = channel;

    const startPollingIfNeeded = () => {
      if (!pollingActive && !realtimeWorking) {
        console.log('🔄 Participant: Starting answers polling fallback');
        pollingActive = true;
        stopPolling = realtimeFallback.pollAnswers(
          session.id,
          participant.id,
          session.current_question_index,
          (data) => {
            if (!realtimeWorking) { // Only use polling data if realtime isn't working
              console.log('📝 Participant: Answer update received via polling');
              if (data) {
                setHasAnswered(true);
                if (data.answer === 'timeout') {
                  setSelectedAnswer(null);
                } else {
                  const parsed = parseInt(data.answer);
                  setSelectedAnswer(isNaN(parsed) ? null : parsed);
                }
                setLastUpdate(new Date());
              }
            }
          }
        );
      }
    };

    // Set up polling fallback after 2 seconds if realtime doesn't work
    setTimeout(() => {
      if (!realtimeWorking) {
        console.log('⚠️ Participant: Answers realtime not working after 2s, starting polling');
        startPollingIfNeeded();
      }
    }, 2000);

    return () => {
      console.log('🔌 Participant: Cleaning up answer subscriptions');
      if (answerChannelRef.current) {
        supabase.removeChannel(answerChannelRef.current);
        answerChannelRef.current = null;
      }
      if (stopPolling) {
        stopPolling();
        stopPolling = null;
        pollingActive = false;
      }
    };
  };

  const handleAnswer = async (answerIndex: number) => {
    console.log('handleAnswer called:', {
      answerIndex,
      hasAnswered,
      session: !!session,
      participant: !!participant,
      sessionId: session?.id,
      participantId: participant?.id,
      currentQuestionIndex: session?.current_question_index
    });

    if (!session || !participant || hasAnswered) {
      console.log('Early return from handleAnswer:', {
        noSession: !session,
        noParticipant: !participant,
        alreadyAnswered: hasAnswered
      });
      return;
    }

    // Allow timeout even if selectedAnswer is null (for timeout case)
    const isTimeout = answerIndex === -1;
    if (!isTimeout && selectedAnswer !== null) {
      console.log('Already selected answer, ignoring');
      return;
    }

    // Handle timeout case (-1 means no answer submitted)
    
    setSelectedAnswer(isTimeout ? null : answerIndex);
    setHasAnswered(true);

    const questionIndex = session.current_question_index;
    const question = QUIZ_QUESTIONS[questionIndex];

    if (!question) {
      console.error('Question not found:', { questionIndex, totalQuestions: QUIZ_QUESTIONS.length });
      return;
    }

    // If timeout, mark as incorrect; otherwise check if answer is correct
    const isCorrect = isTimeout ? false : answerIndex === question.correctAnswer;
    
    const responseTime = questionStartTime
      ? new Date().getTime() - questionStartTime.getTime()
      : 0;

    try {
      console.log('Submitting answer:', {
        sessionId: session.id,
        participantId: participant.id,
        questionIndex,
        answerIndex,
        isTimeout,
        isCorrect
      });

      // For timeout, use a special value
      const answerValue = isTimeout ? 'timeout' : answerIndex.toString();

      // Check if answer already exists
      console.log('Checking for existing answer...');
      const { data: existing, error: checkError } = await supabase
        .from('answers')
        .select('id')
        .eq('session_id', session.id)
        .eq('participant_id', participant.id)
        .eq('question_index', questionIndex)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing answer:', checkError);
      }
      console.log('Existing answer check result:', { existing, checkError });

      let error;
      let data;

      if (existing) {
        console.log('Updating existing answer:', existing.id);
        // Update existing answer
        const result = await supabase
          .from('answers')
          .update({
            answer: answerValue,
            is_correct: isCorrect,
            response_time_ms: responseTime,
            points_awarded: 0,
          })
          .eq('id', existing.id)
          .select();
        error = result.error;
        data = result.data;
        console.log('Update result:', { error, data });
      } else {
        console.log('Inserting new answer');
        // Insert new answer
        const result = await supabase
          .from('answers')
          .insert({
            session_id: session.id,
            participant_id: participant.id,
            question_index: questionIndex,
            answer: answerValue,
            is_correct: isCorrect,
            response_time_ms: responseTime,
            points_awarded: 0,
          })
          .select();
        error = result.error;
        data = result.data;
        console.log('Insert result:', { error, data });
      }

      if (error) {
        console.error('Error submitting answer:', {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        // Don't show alert for timeout cases, just log
        if (!isTimeout) {
          alert(`Failed to submit answer: ${error?.message || 'Unknown error'}`);
        }
      } else {
        console.log('Answer submitted successfully:', data);
      }
    } catch (error: any) {
      console.error('Error submitting answer (catch):', {
        error,
        message: error?.message,
        stack: error?.stack,
      });
      // Don't show alert for timeout cases
      if (!isTimeout) {
        alert(`Failed to submit answer: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  if (isLoading || !session || !participant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-200 via-pink-200 to-yellow-200">
        <div className="text-2xl font-bold text-purple-800">Loading...</div>
      </div>
    );
  }

  const isFinished = session.status === 'finished';
  const isShowingResults = session.status === 'showing_results';
  const isWaiting = session.status === 'waiting';
  const isActive = session.status === 'active';

  if (isFinished) {
    return <WinnerDisplay sessionId={session.id} code={code} />;
  }

  if (isShowingResults) {
    return (
      <RankingDisplay
        sessionId={session.id}
        code={code}
        onContinue={() => {}}
        isHost={false}
      />
    );
  }

  if (isWaiting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-200 via-pink-200 to-yellow-200">
        <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-8 text-center shadow-2xl border-4 border-purple-400">
          <h2 className="mb-4 text-3xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 bg-clip-text text-transparent">⏳ Waiting for Quiz to Start</h2>
          <p className="mb-2 text-xl font-bold text-purple-800">Hello, {participant.name}! 👋</p>
          <p className="text-lg font-semibold text-purple-700">The host will start the quiz soon.</p>
        </div>
      </div>
    );
  }

  const questionIndex = session.current_question_index ?? 0;
  const question = QUIZ_QUESTIONS[questionIndex];
  const timeLimit = question?.timeLimit ?? 30;
  const progress = questionStartTime
    ? Math.min(100, (timeLimit * 1000 - timeRemaining) / (timeLimit * 1000) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-pink-200 to-yellow-200 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent md:text-3xl">
            👤 {participant.name}
          </h1>
          <div className="flex flex-col items-end gap-1">
            <div className="text-base font-mono font-extrabold text-purple-700 bg-yellow-200 px-3 py-1 rounded-lg border-2 border-purple-400 md:text-lg">
              {code}
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus isRealtime={useRealtime} lastUpdate={lastUpdate} />
              <button
                onClick={() => {
                  console.log('🔄 Manual refresh triggered');
                  loadSession();
                  setLastUpdate(new Date());
                }}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 shadow-2xl border-4 border-purple-300 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-lg font-bold text-purple-700">
              Question {questionIndex + 1} of {TOTAL_QUESTIONS}
            </span>
            <span className="text-2xl font-mono font-extrabold text-pink-600 bg-yellow-200 px-4 py-2 rounded-xl border-2 border-pink-400">
              ⏱️ {Math.ceil(timeRemaining / 1000)}s
            </span>
          </div>
          
          <div className="mb-6 h-4 w-full overflow-hidden rounded-full bg-pink-200 border-2 border-pink-400">
            <div
              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <h2 className="mb-6 text-2xl font-extrabold text-purple-900 md:text-3xl">
            {question.question}
          </h2>
          
          <div className="space-y-4">
            {question.options.map((option, idx) => {
              const isSelected = selectedAnswer === idx;
              const isCorrect = idx === question.correctAnswer;
              const showResult = hasAnswered && isCorrect;
              
              let bgGradient = 'bg-gradient-to-r from-purple-100 to-pink-100';
              let borderColor = 'border-purple-300';
              let textColor = 'text-purple-900';
              
              if (isSelected && !hasAnswered) {
                bgGradient = 'bg-gradient-to-r from-pink-300 to-purple-300';
                borderColor = 'border-pink-500';
                textColor = 'text-purple-900';
              } else if (isSelected && hasAnswered) {
                if (isCorrect) {
                  bgGradient = 'bg-gradient-to-r from-green-300 to-emerald-300';
                  borderColor = 'border-green-500';
                  textColor = 'text-green-900';
                } else {
                  bgGradient = 'bg-gradient-to-r from-red-300 to-pink-300';
                  borderColor = 'border-red-500';
                  textColor = 'text-red-900';
                }
              } else if (showResult) {
                bgGradient = 'bg-gradient-to-r from-green-300 to-emerald-300';
                borderColor = 'border-green-500';
                textColor = 'text-green-900';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={hasAnswered}
                  className={`w-full rounded-xl border-4 p-5 text-left text-lg font-bold transition-all duration-200 ${
                    hasAnswered ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105 hover:shadow-lg transform'
                  } ${bgGradient} ${borderColor} ${textColor}`}
                >
                  <span className="font-extrabold">{String.fromCharCode(65 + idx)}. </span>
                  {option}
                  {isSelected && hasAnswered && (
                    <span className="ml-3 text-xl">
                      {isCorrect ? '✓ Correct!' : '✗ Wrong'}
                    </span>
                  )}
                  {showResult && !isSelected && (
                    <span className="ml-3 text-xl text-green-700">✓ Correct Answer</span>
                  )}
                </button>
              );
            })}
          </div>

          {hasAnswered && (
            <div className="mt-6 rounded-xl bg-gradient-to-r from-purple-200 to-pink-200 p-5 text-center border-4 border-purple-400">
              <p className="text-xl font-bold text-purple-900">
                {selectedAnswer === null
                  ? '⏰ Time\'s up! No answer submitted. Waiting for next question...'
                  : selectedAnswer === question.correctAnswer
                  ? '🎉 Great job! Waiting for other participants...'
                  : '✅ Answer submitted. Waiting for next question...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
