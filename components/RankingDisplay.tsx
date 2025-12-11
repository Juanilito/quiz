'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase, realtimeFallback } from '@/lib/supabase';

interface RankingDisplayProps {
  sessionId: string;
  code: string;
  onContinue: () => void;
  isHost: boolean;
}

export default function RankingDisplay({
  sessionId,
  code,
  onContinue,
  isHost,
}: RankingDisplayProps) {
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useRealtime, setUseRealtime] = useState(true);
  const participantsChannelRef = useRef<any>(null);
  const sessionChannelRef = useRef<any>(null);
  const realtimeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRankings();
    const unsubscribeParticipants = subscribeToParticipants();
    const unsubscribeSession = subscribeToSession();
    return () => {
      if (unsubscribeParticipants) unsubscribeParticipants();
      if (unsubscribeSession) unsubscribeSession();
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
    };
  }, [sessionId, code]);

  const loadRankings = async () => {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('total_score', { ascending: false });

    if (error) {
      console.error('Error loading rankings:', error);
      return;
    }

    setParticipants(data || []);
    setIsLoading(false);
  };

  const subscribeToParticipants = () => {
    // Clean up existing channel if any
    if (participantsChannelRef.current) {
      supabase.removeChannel(participantsChannelRef.current);
    }

    let realtimeWorking = false;

    const channel = supabase
      .channel(`rankings-participants-${code}`, {
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
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          realtimeWorking = true;
          console.log('📊 Rankings: Realtime participants update received');
          await loadRankings();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Rankings: Realtime participants subscription successful');
          realtimeWorking = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Rankings: Realtime participants channel error, falling back to polling');
        } else {
          console.log('📡 Rankings participants subscription status:', status);
        }
      });

    participantsChannelRef.current = channel;

    // Set up polling fallback
    realtimeTimeoutRef.current = setTimeout(() => {
      if (!realtimeWorking) {
        console.log('⚠️ Rankings: Realtime not working, enabling polling fallback');
        setUseRealtime(false);
      }
    }, 5000);

    // Start polling regardless, but prioritize realtime
    const stopPolling = realtimeFallback.pollParticipants(sessionId, (data) => {
      if (!realtimeWorking) {
        console.log('📊 Rankings: Polling participants update');
        setParticipants(data);
      }
    });

    return () => {
      if (participantsChannelRef.current) {
        supabase.removeChannel(participantsChannelRef.current);
        participantsChannelRef.current = null;
      }
      stopPolling();
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
    };
  };

  const subscribeToSession = () => {
    // Clean up existing channel if any
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
    }

    let realtimeWorking = false;

    const channel = supabase
      .channel(`rankings-session-${code}`, {
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
          realtimeWorking = true;
          console.log('🔄 Rankings: Realtime session update received');
          const newSession = payload.new as any;
          // If host continues, the session status will change and parent component will handle navigation
          // This subscription ensures we're aware of status changes
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Rankings: Realtime session subscription successful');
          realtimeWorking = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Rankings: Realtime session channel error, falling back to polling');
        } else {
          console.log('📡 Rankings session subscription status:', status);
        }
      });

    sessionChannelRef.current = channel;

    // Start polling fallback
    const stopPolling = realtimeFallback.pollSession(code, (data) => {
      if (!realtimeWorking) {
        console.log('🔄 Rankings: Polling session update');
        // Rankings component doesn't need to react to session changes
        // as the parent components handle navigation
      }
    });

    return () => {
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      stopPolling();
    };
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-purple-400 cyberpunk-flicker">Loading Rankings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl anime-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl anime-float" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="rounded-3xl backdrop-blur-xl p-6 md:p-8 border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.2)'
             }}>
          <div className="mb-8 text-center">
            <h2 className="text-5xl font-black anime-text-gradient mb-2">ランキング</h2>
            <div className="text-cyan-400 font-mono text-sm cyberpunk-flicker">Battle Rankings</div>
            <div className="flex justify-center items-center gap-2 mt-4">
              <span className="w-8 h-0.5 bg-gradient-to-r from-transparent to-yellow-400"></span>
              <span className="text-yellow-400 text-sm font-mono">最終結果</span>
              <span className="w-8 h-0.5 bg-gradient-to-r from-yellow-400 to-transparent"></span>
            </div>
          </div>

          <div className="space-y-4">
            {participants.map((participant, index) => {
              const rank = index + 1;
              let medal = '';
              let medalText = '';
              let bgGradient = '';
              let borderColor = '';
              let glowClass = '';
              let rankIcon = '';

              if (rank === 1) {
                medal = '🥇';
                medalText = '優勝';
                bgGradient = 'bg-gradient-to-r from-yellow-900/80 to-orange-900/80';
                borderColor = 'border-yellow-400';
                glowClass = 'anime-glow';
                rankIcon = '👑';
              } else if (rank === 2) {
                medal = '🥈';
                medalText = '準優勝';
                bgGradient = 'bg-gradient-to-r from-gray-700/80 to-slate-700/80';
                borderColor = 'border-gray-400';
                glowClass = 'anime-glow';
                rankIcon = '⭐';
              } else if (rank === 3) {
                medal = '🥉';
                medalText = '3位';
                bgGradient = 'bg-gradient-to-r from-orange-900/80 to-red-900/80';
                borderColor = 'border-orange-400';
                glowClass = 'anime-glow';
                rankIcon = '🏆';
              } else {
                bgGradient = 'bg-gradient-to-r from-slate-700/80 to-slate-800/80';
                borderColor = 'border-slate-600';
                rankIcon = `#${rank}`;
              }

              return (
                <div
                  key={participant.id}
                  className={`flex items-center justify-between rounded-xl border-2 p-5 ${bgGradient} ${borderColor} ${glowClass} transition-all duration-300 hover:scale-102 backdrop-blur-sm relative group`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl">{rankIcon}</span>
                      {medal && <span className="text-sm text-gray-400">{medalText}</span>}
                    </div>
                    <div>
                      <span className="text-xl font-bold text-white">
                        {participant.name}
                      </span>
                      {rank <= 3 && (
                        <div className="text-xs text-gray-400 font-mono">
                          {medalText}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400 font-mono">
                    {participant.total_score || 0} pts
                  </div>

                  {/* Rank glow effect for top 3 */}
                  {rank <= 3 && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  )}
                </div>
              );
            })}

            {participants.length === 0 && (
              <div className="py-12 text-center">
                <div className="text-4xl mb-4">👻</div>
                <div className="text-xl font-semibold text-gray-400">
                  まだ参戦者がいません
                </div>
                <div className="text-sm text-gray-500 mt-2">No participants yet</div>
              </div>
            )}
          </div>

          {isHost && (
            <div className="mt-8">
              <button
                onClick={onContinue}
                className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-6 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl transform anime-glow border-2 border-pink-400/50 hover:border-cyan-400"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>➡️</span>
                  <span>次の問題へ</span>
                  <span>⚡</span>
                </div>
              </button>
            </div>
          )}

          {!isHost && (
            <div className="mt-8 text-center">
              <div className="text-xl font-bold text-cyan-400 cyberpunk-flicker mb-2">
                ⏳ ホストの指示を待っています...
              </div>
              <div className="text-sm text-gray-400">
                Waiting for host to continue...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
