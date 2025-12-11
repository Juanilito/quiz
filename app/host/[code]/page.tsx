'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, realtimeFallback, realtimeManager } from '@/lib/supabase';
import { QUIZ_QUESTIONS, TOTAL_QUESTIONS } from '@/lib/quiz-questions';
import RankingDisplay from '@/components/RankingDisplay';
import WinnerDisplay from '@/components/WinnerDisplay';
import ConnectionStatus from '@/components/ConnectionStatus';

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [useRealtime, setUseRealtime] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const sessionChannelRef = useRef<any>(null);
  const participantsChannelRef = useRef<any>(null);
  const realtimeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSession();
    const unsubscribeSession = subscribeToSession();
    return () => {
      if (unsubscribeSession) unsubscribeSession();
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
    };
  }, [code]);

  useEffect(() => {
    if (!session?.id) return;
    const unsubscribeParticipants = subscribeToParticipants();
    return () => {
      if (unsubscribeParticipants) unsubscribeParticipants();
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id || currentQuestion === null) return;
    const unsubscribeAnswers = subscribeToAnswers();
    return () => {
      if (unsubscribeAnswers) unsubscribeAnswers();
    };
  }, [session?.id, currentQuestion]);

  useEffect(() => {
    if (session?.question_start_time) {
      const startTime = new Date(session.question_start_time);
      setQuestionStartTime(startTime);
      updateTimer(startTime);
      const interval = setInterval(() => {
        const currentStartTime = new Date(session.question_start_time);
        updateTimer(currentStartTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [session?.question_start_time, session?.current_question_index]);

  const updateTimer = (startTime: Date) => {
    if (!session) return;
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const questionIndex = session.current_question_index ?? 0;
    const timeLimit = QUIZ_QUESTIONS[questionIndex]?.timeLimit ?? 30;
    const remaining = Math.max(0, timeLimit * 1000 - elapsed);
    setTimeRemaining(remaining);
  };

  const loadSession = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('session_code', code)
        .single();

      if (error) {
        console.error('Error loading session:', error);
        alert(`Error loading session: ${error?.message || 'Unknown error'}`);
        return;
      }

      if (!data) {
        console.error('No session found');
        return;
      }

      setSession(data);
      setIsLoading(false);

      if (data.status === 'active' && data.current_question_index < TOTAL_QUESTIONS) {
        setCurrentQuestion(data.current_question_index);
      }
    } catch (error: any) {
      console.error('Error loading session:', error);
      alert(`Error loading session: ${error?.message || 'Unknown error'}`);
    }
  };

  const subscribeToSession = () => {
    console.log('🚀 Host: Setting up session subscription for code:', code);

    // Clean up existing channel if any
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
    }

    let realtimeWorking = false;
    let pollingActive = false;
    let stopPolling: (() => void) | null = null;

    const channel = supabase
      .channel(`session-host-${code}`, {
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
            console.log('✅ Host: Realtime now working, stopping polling fallback');
            if (stopPolling) {
              stopPolling();
              stopPolling = null;
              pollingActive = false;
            }
          }

          console.log('🔄 Host: Realtime session update received:', payload);

          const newSession = payload.new as any;
          if (!newSession) return;

          setSession((prevSession: any) => {
            console.log('📊 Host: Realtime updating session');
            setLastUpdate(new Date());
            return newSession;
          });

          console.log('✅ Host: Session state updated successfully');

          if (newSession.status === 'active') {
            setCurrentQuestion(newSession.current_question_index);
            if (newSession.question_start_time) {
              setQuestionStartTime(new Date(newSession.question_start_time));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Host: Subscription status changed:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Host: Realtime subscription successful');
          realtimeWorking = true;
          setUseRealtime(true);
          // Stop polling if it's running
          if (stopPolling && pollingActive) {
            console.log('🔌 Host: Stopping polling since realtime is working');
            stopPolling();
            stopPolling = null;
            pollingActive = false;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Host: Realtime channel error, falling back to polling');
          realtimeWorking = false;
          setUseRealtime(false);
          startPollingIfNeeded();
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Host: Subscription timed out - falling back to polling');
          realtimeWorking = false;
          setUseRealtime(false);
          startPollingIfNeeded();
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Host: Subscription closed - falling back to polling');
          realtimeWorking = false;
          setUseRealtime(false);
          startPollingIfNeeded();
        } else {
          console.log('📡 Host: Subscription status:', status);
        }
      });

    sessionChannelRef.current = channel;

    const startPollingIfNeeded = () => {
      if (!pollingActive && !realtimeWorking) {
        console.log('🔄 Host: Starting polling fallback');
        pollingActive = true;
        stopPolling = realtimeFallback.pollSession(code, (data) => {
          if (!realtimeWorking) { // Only use polling data if realtime isn't working
            console.log('🔄 Host: Session update received via polling', {
        status: data.status,
        questionIndex: data.current_question_index
      });

      setSession((prevSession: any) => {
        if (prevSession?.status !== data.status ||
            prevSession?.current_question_index !== data.current_question_index ||
            prevSession?.question_start_time !== data.question_start_time) {
          console.log('📊 Host: Updating session from polling');
                setLastUpdate(new Date());
          return data;
        }
        return prevSession;
      });

      if (data.status === 'active') {
        setCurrentQuestion(data.current_question_index);
        if (data.question_start_time) {
          setQuestionStartTime(new Date(data.question_start_time));
              }
        }
      }
    });
      }
    };

    // Set up polling fallback after 2 seconds if realtime doesn't work
    realtimeTimeoutRef.current = setTimeout(() => {
      if (!realtimeWorking) {
        console.log('⚠️ Host: Realtime not working after 2s, starting polling fallback');
        setUseRealtime(false);
        startPollingIfNeeded();
      }
    }, 2000);

    return () => {
      console.log('🔌 Host: Cleaning up session subscriptions');
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      if (stopPolling) {
      stopPolling();
        stopPolling = null;
        pollingActive = false;
      }
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
    };
  };

  const subscribeToParticipants = () => {
    if (!session?.id) return;

    // Clean up existing channel if any
    if (participantsChannelRef.current) {
      supabase.removeChannel(participantsChannelRef.current);
    }

    let realtimeWorking = false;
    let pollingActive = false;
    let stopPolling: (() => void) | null = null;

    const loadParticipants = async () => {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', session.id)
        .order('total_score', { ascending: false });

      if (data) {
        setParticipants(data);
      }
    };

    loadParticipants();

    const channel = supabase
      .channel(`participants-host-${code}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${session.id}`,
        },
        async (payload) => {
          if (!realtimeWorking) {
          realtimeWorking = true;
            console.log('✅ Host: Realtime participants now working, stopping polling');
            if (stopPolling && pollingActive) {
              stopPolling();
              stopPolling = null;
              pollingActive = false;
            }
          }
          console.log('👥 Host: Realtime participants update received');
          await loadParticipants();
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Host: Realtime participants subscription successful');
          realtimeWorking = true;
          // Stop polling if it's running
          if (stopPolling && pollingActive) {
            console.log('🔌 Host: Stopping participants polling since realtime is working');
            stopPolling();
            stopPolling = null;
            pollingActive = false;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Host: Realtime participants channel error, falling back to polling');
          realtimeWorking = false;
          startPollingIfNeeded();
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Host: Participants subscription timed out - falling back to polling');
          realtimeWorking = false;
          startPollingIfNeeded();
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Host: Participants subscription closed - falling back to polling');
          realtimeWorking = false;
          startPollingIfNeeded();
        }
      });

    participantsChannelRef.current = channel;

    const startPollingIfNeeded = () => {
      if (!pollingActive && !realtimeWorking) {
        console.log('🔄 Host: Starting participants polling fallback');
        pollingActive = true;
        stopPolling = realtimeFallback.pollParticipants(session.id, (data) => {
          if (!realtimeWorking) { // Only use polling data if realtime isn't working
            console.log('👥 Host: Participants update received via polling');
            setParticipants(data);
            setLastUpdate(new Date());
          }
        });
      }
    };

    // Set up polling fallback after 2 seconds if realtime doesn't work
    setTimeout(() => {
      if (!realtimeWorking) {
        console.log('⚠️ Host: Participants realtime not working after 2s, starting polling');
        startPollingIfNeeded();
      }
    }, 2000);

    return () => {
      console.log('🔌 Host: Cleaning up participant subscriptions');
      if (participantsChannelRef.current) {
        supabase.removeChannel(participantsChannelRef.current);
        participantsChannelRef.current = null;
      }
      if (stopPolling) {
      stopPolling();
        stopPolling = null;
        pollingActive = false;
      }
    };
  };

  const subscribeToAnswers = () => {
    if (!session?.id || currentQuestion === null) return;

    console.log('📝 Host: Setting up answers subscription for question:', currentQuestion);

    const answersChannel = supabase
      .channel(`answers-host-${code}-${currentQuestion}`, {
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
          filter: `session_id=eq.${session.id} AND question_index=eq.${currentQuestion}`,
        },
        async (payload) => {
          console.log('📝 Host: Realtime answer update received');
          await loadCurrentAnswers();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Host: Answers subscription successful');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Host: Answers subscription channel error');
        }
      });

    const loadCurrentAnswers = async () => {
      const { data } = await supabase
        .from('answers')
        .select(`
          id,
          participant_id,
          answer,
          is_correct,
          response_time_ms,
          participants (
            id,
            name
          )
        `)
        .eq('session_id', session.id)
        .eq('question_index', currentQuestion);

      if (data) {
        setCurrentAnswers(data);
        setLastUpdate(new Date());
      }
    };

    // Load initial answers
    loadCurrentAnswers();

    return () => {
      console.log('🔌 Host: Cleaning up answers subscriptions');
      supabase.removeChannel(answersChannel);
    };
  };

  const startQuiz = async () => {
    setIsStarting(true);
    try {
      console.log('Starting quiz with code:', code);
      const { data, error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'active', 
          current_question_index: 0,
          question_start_time: new Date().toISOString()
        })
        .eq('session_code', code)
        .select();

      if (error) {
        console.error('Error starting quiz:', error);
        alert(`Failed to start quiz: ${error?.message || 'Unknown error'}`);
        setIsStarting(false);
        return;
      }

      console.log('Quiz started successfully:', data);
      
      // Update local state immediately
      if (data && data.length > 0) {
        setSession(data[0]);
        setCurrentQuestion(0);
        setCurrentAnswers([]); // Clear answers for new quiz
      }

      // Also reload session to ensure we have latest data
      await loadSession();
    } catch (error: any) {
      console.error('Error starting quiz:', error);
      alert(`Failed to start quiz: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  };

  const startNextQuestion = async () => {
    const nextIndex = (session?.current_question_index ?? 0) + 1;
    
    console.log('➡️ Starting next question:', nextIndex);
    
    if (nextIndex >= TOTAL_QUESTIONS) {
      // End quiz
      console.log('🏁 Ending quiz - no more questions');
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ status: 'finished' })
        .eq('session_code', code)
        .select();
      
      if (error) {
        console.error('Error finishing quiz:', error);
      } else {
        console.log('✅ Quiz finished successfully');
      }
      return;
    }

    // Calculate scores for previous question
    await calculateScores(session?.current_question_index ?? 0);

    // Start next question
    const questionStartTime = new Date().toISOString();
    console.log('📝 Updating session:', {
      current_question_index: nextIndex,
      question_start_time: questionStartTime,
      status: 'active',
    });

    // Clear current answers for new question
    setCurrentAnswers([]);
    
    const { data, error } = await supabase
      .from('quiz_sessions')
      .update({
        current_question_index: nextIndex,
        question_start_time: questionStartTime,
        status: 'active',
      })
      .eq('session_code', code)
      .select();

    if (error) {
      console.error('❌ Error starting next question:', error);
      alert('Failed to start next question');
    } else {
      console.log('✅ Next question started successfully:', data);
      // Update local state immediately for host
      if (data && data.length > 0) {
        setSession(data[0]);
        setCurrentQuestion(nextIndex);
        setQuestionStartTime(new Date(questionStartTime));
      }
    }
  };

  const calculateScores = async (questionIndex: number) => {
    if (!session?.id) return;

    // Get all correct answers for this question, ordered by response_time_ms
    const { data: correctAnswers, error } = await supabase
      .from('answers')
      .select('*')
      .eq('session_id', session.id)
      .eq('question_index', questionIndex)
      .eq('is_correct', true)
      .order('response_time_ms', { ascending: true })
      .limit(3);

    if (error) {
      console.error('Error fetching correct answers:', error);
      return;
    }

    if (!correctAnswers || correctAnswers.length === 0) return;

    // Award points: 1st = 10, 2nd = 7, 3rd = 5
    const points = [10, 7, 5];
    
    for (let i = 0; i < correctAnswers.length; i++) {
      const answer = correctAnswers[i];
      const participantId = answer.participant_id;
      const pointsToAward = points[i];

      // Update answer with points
      await supabase
        .from('answers')
        .update({ points_awarded: pointsToAward })
        .eq('id', answer.id);

      // Update participant total score
      const { data: participant } = await supabase
        .from('participants')
        .select('total_score')
        .eq('id', participantId)
        .single();

      if (participant) {
        await supabase
          .from('participants')
          .update({ total_score: (participant.total_score || 0) + pointsToAward })
          .eq('id', participantId);
      }
    }
  };

  const showRankings = async () => {
    await calculateScores(session?.current_question_index ?? 0);
    
    const { error } = await supabase
      .from('quiz_sessions')
      .update({ status: 'showing_results' })
      .eq('session_code', code);

    if (error) {
      console.error('Error showing rankings:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-cyan-400 cyberpunk-flicker">Loading Battle Arena...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="text-6xl mb-4">💀</div>
          <div className="text-2xl font-bold text-red-400 anime-glow">Battle Arena Not Found</div>
          <div className="text-gray-400 mt-2">The quiz session you're looking for doesn't exist</div>
        </div>
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
        onContinue={startNextQuestion}
        isHost={true}
      />
    );
  }

  const questionIndex = session.current_question_index ?? 0;
  const question = QUIZ_QUESTIONS[questionIndex];
  const timeLimit = question?.timeLimit ?? 30;
  const progress = questionStartTime
    ? Math.min(100, (timeLimit * 1000 - timeRemaining) / (timeLimit * 1000) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl anime-float"></div>
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl anime-float" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="mx-auto max-w-4xl relative z-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center anime-glow">
              <span className="text-2xl">👑</span>
            </div>
            <div>
              <h1 className="text-4xl font-black anime-text-gradient">ホストダッシュボード</h1>
              <div className="text-sm text-cyan-400 font-mono">Host Control Center</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="font-mono font-bold text-cyan-300 bg-slate-800/80 px-4 py-2 rounded-xl border border-cyan-400/50 anime-glow-blue backdrop-blur-sm">
              CODE: {code}
              </div>
            <div className="flex items-center gap-3">
              <ConnectionStatus isRealtime={useRealtime} lastUpdate={lastUpdate} />
              <button
                onClick={() => {
                  loadSession();
                  setLastUpdate(new Date());
                }}
                className="text-sm bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 anime-glow-blue border border-blue-400/50"
              >
                <span className="flex items-center gap-1">
                  <span>🔄</span>
                  <span>REFRESH</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl backdrop-blur-xl p-6 border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 107, 157, 0.1)'
             }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-cyan-400">👥</span>
              <span>参戦者</span>
              <span className="text-cyan-400 font-mono">({participants.length})</span>
            </h2>
            <div className="text-lg font-mono text-purple-400">
              <span>📝</span>
              <span>解答: {currentAnswers.length}/{participants.length}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {participants.map((p) => {
              const hasAnswered = currentAnswers.some(a => a.participant_id === p.id);
              const answer = currentAnswers.find(a => a.participant_id === p.id);
              const isCorrect = answer?.is_correct;

              let bgGradient = 'bg-gradient-to-br from-slate-700 to-slate-800';
              let borderColor = 'border-gray-600';
              let glowColor = '';
              let statusIcon = '';
              let statusText = '';

              if (hasAnswered) {
                if (isCorrect) {
                  bgGradient = 'bg-gradient-to-br from-green-900/80 to-emerald-900/80';
                  borderColor = 'border-green-400';
                  glowColor = 'anime-glow';
                  statusIcon = '✅';
                  statusText = '正解';
                } else {
                  bgGradient = 'bg-gradient-to-br from-red-900/80 to-pink-900/80';
                  borderColor = 'border-red-400';
                  glowColor = 'anime-glow';
                  statusIcon = '❌';
                  statusText = '不正解';
                }
              }

              return (
              <div
                key={p.id}
                  className={`rounded-xl ${bgGradient} px-4 py-3 text-center text-base font-bold text-purple-900 border-2 ${borderColor} shadow-md relative`}
              >
                {p.name}
                  {statusIcon && (
                    <div className="absolute -top-1 -right-1 text-lg">
                      {statusIcon}
                    </div>
                  )}
              </div>
              );
            })}
          </div>
        </div>

        {isWaiting && (
          <div className="rounded-2xl backdrop-blur-xl p-8 text-center border border-white/10 anime-glow"
               style={{
                 background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
                 boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.2)'
               }}>
            <div className="mb-6">
              <h2 className="text-3xl font-black anime-text-gradient-2 mb-2">準備完了？</h2>
              <div className="text-cyan-400 font-mono text-sm">Ready to Battle?</div>
            </div>
            <div className="mb-8">
              <div className="text-2xl font-bold text-white mb-2">
                {participants.length}人の戦士が参戦
              </div>
              <div className="text-gray-400 text-sm">
                {participants.length} warrior{participants.length !== 1 ? 's' : ''} ready for battle
              </div>
            </div>
            <button
              onClick={startQuiz}
              disabled={isStarting}
              className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-10 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-110 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform anime-glow border-2 border-pink-400/50 hover:border-cyan-400/70"
            >
              {isStarting ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>バトル開始中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <span>🚀</span>
                  <span>バトル開始</span>
                  <span>⚡</span>
                </div>
              )}
            </button>
          </div>
        )}

        {isActive && question && (
          <div className="space-y-6">
            <div className="rounded-2xl backdrop-blur-xl p-8 border border-white/10 anime-glow"
                 style={{
                   background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
                   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(155, 89, 182, 0.2)'
                 }}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center anime-glow-blue">
                    <span className="text-white font-bold text-sm">Q</span>
                  </div>
                  <span className="text-lg font-bold text-cyan-400 font-mono">
                    問題 {questionIndex + 1} / {TOTAL_QUESTIONS}
                </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">残り時間</div>
                  <span className="text-2xl font-mono font-bold text-pink-400 bg-slate-800/80 px-4 py-2 rounded-xl border border-pink-400/50 anime-glow backdrop-blur-sm">
                  ⏱️ {Math.ceil(timeRemaining / 1000)}s
                </span>
                </div>
              </div>
              
              <div className="mb-8 h-4 w-full overflow-hidden rounded-full bg-slate-700 border-2 border-cyan-400/50">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 transition-all duration-100 anime-glow"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <h2 className="mb-8 text-3xl font-bold text-white leading-tight">{question.question}</h2>
              
              <div className="space-y-4">
                {question.options.map((option, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 p-5 text-lg font-bold transition-all duration-300 hover:scale-105 ${
                      idx === question.correctAnswer
                        ? 'border-green-400 bg-gradient-to-r from-green-900/80 to-emerald-900/80 text-green-300 anime-glow'
                        : 'border-purple-400/50 bg-gradient-to-r from-slate-700/80 to-slate-800/80 text-gray-300 hover:border-purple-400'
                    } backdrop-blur-sm`}
                  >
                    <span className="font-mono font-bold text-cyan-400 mr-3">{String.fromCharCode(65 + idx)}. </span>
                    <span>{option}</span>
                    {idx === question.correctAnswer && (
                      <span className="ml-3 text-green-400 font-bold">✓ 正解</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={showRankings}
                className="flex-1 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 text-lg font-extrabold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl transform anime-glow border-2 border-yellow-400/50 hover:border-orange-400"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>📊</span>
                  <span>ランキング表示</span>
                </div>
              </button>
              <button
                onClick={startNextQuestion}
                className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-6 py-4 text-lg font-extrabold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl transform anime-glow border-2 border-pink-400/50 hover:border-cyan-400"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>➡️</span>
                  <span>次の問題</span>
                  <span>⚡</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
