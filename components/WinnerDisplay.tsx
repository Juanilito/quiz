'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, realtimeFallback } from '@/lib/supabase';

interface WinnerDisplayProps {
  sessionId: string;
  code: string;
}

export default function WinnerDisplay({ sessionId, code }: WinnerDisplayProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useRealtime, setUseRealtime] = useState(true);
  const participantsChannelRef = useRef<any>(null);
  const sessionChannelRef = useRef<any>(null);
  const realtimeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadFinalRankings();
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

  const loadFinalRankings = async () => {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('total_score', { ascending: false });

    if (error) {
      console.error('Error loading final rankings:', error);
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
      .channel(`winners-participants-${code}`, {
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
          console.log('🏆 Winners: Realtime participants update received');
          await loadFinalRankings();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Winners: Realtime participants subscription successful');
          realtimeWorking = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Winners: Realtime participants channel error, falling back to polling');
        } else {
          console.log('📡 Winners participants subscription status:', status);
        }
      });

    participantsChannelRef.current = channel;

    // Set up polling fallback
    realtimeTimeoutRef.current = setTimeout(() => {
      if (!realtimeWorking) {
        console.log('⚠️ Winners: Realtime not working, enabling polling fallback');
        setUseRealtime(false);
      }
    }, 5000);

    // Start polling regardless, but prioritize realtime
    const stopPolling = realtimeFallback.pollParticipants(sessionId, (data) => {
      if (!realtimeWorking) {
        console.log('🏆 Winners: Polling participants update');
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
      .channel(`winners-session-${code}`, {
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
          console.log('🔄 Winners: Realtime session update received');
          const newSession = payload.new as any;
          // If session status changes (e.g., new quiz started), we can react here
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Winners: Realtime session subscription successful');
          realtimeWorking = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Winners: Realtime session channel error, falling back to polling');
        } else {
          console.log('📡 Winners session subscription status:', status);
        }
      });

    sessionChannelRef.current = channel;

    // Start polling fallback
    const stopPolling = realtimeFallback.pollSession(code, (data) => {
      if (!realtimeWorking) {
        console.log('🔄 Winners: Polling session update');
        // Winners component doesn't need to react to session changes
        // as it's the final state
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
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-yellow-400 cyberpunk-flicker">Loading Final Results...</div>
        </div>
      </div>
    );
  }

  const winners = participants.slice(0, 3);
  const otherParticipants = participants.slice(3);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8 relative">
      {/* Spectacular background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl anime-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl anime-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl anime-float" style={{animationDelay: '2s'}}></div>
        {/* Victory particles */}
        <div className="absolute top-10 left-10 w-2 h-2 bg-yellow-400 rounded-full opacity-80 anime-float"></div>
        <div className="absolute top-20 right-20 w-1.5 h-1.5 bg-pink-400 rounded-full opacity-60 anime-float" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute bottom-10 left-20 w-2.5 h-2.5 bg-cyan-400 rounded-full opacity-70 anime-float" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute bottom-20 right-10 w-1 h-1 bg-purple-400 rounded-full opacity-50 anime-float" style={{animationDelay: '2.5s'}}></div>
      </div>

      <div className="w-full max-w-4xl relative z-10">
        <div className="rounded-3xl backdrop-blur-xl p-6 md:p-8 border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 215, 0, 0.3)'
             }}>

          {/* Victory Header */}
          <div className="mb-10 text-center">
            <div className="mb-4">
              <h1 className="text-7xl font-black anime-text-gradient mb-2 anime-pulse-glow">優勝</h1>
              <div className="text-cyan-400 font-mono text-lg cyberpunk-flicker">VICTORY ACHIEVED</div>
            </div>
            <div className="flex justify-center items-center gap-4 mb-6">
              <span className="w-12 h-0.5 bg-gradient-to-r from-transparent to-yellow-400"></span>
              <span className="text-yellow-400 text-sm font-mono tracking-widest">FINAL RESULTS</span>
              <span className="w-12 h-0.5 bg-gradient-to-r from-yellow-400 to-transparent"></span>
            </div>
            <div className="text-2xl font-bold text-white mb-4">バトル終了！</div>
            <div className="text-gray-400 text-sm">The ultimate anime quiz battle has concluded</div>
          </div>

          {winners.length > 0 && (
            <div className="mb-12">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-black anime-text-gradient-2">チャンピオン</h2>
                <div className="text-cyan-400 font-mono text-sm">CHAMPIONS</div>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                {winners.map((participant, index) => {
                  const rank = index + 1;
                  let medal = '';
                  let medalText = '';
                  let bgGradient = '';
                  let borderColor = '';
                  let size = '';
                  let glowClass = '';
                  let crownIcon = '';

                  if (rank === 1) {
                    medal = '👑';
                    medalText = '優勝者';
                    bgGradient = 'bg-gradient-to-br from-yellow-900/90 to-orange-900/90';
                    borderColor = 'border-yellow-400';
                    size = 'md:scale-110 transform';
                    glowClass = 'anime-glow';
                    crownIcon = '👑';
                  } else if (rank === 2) {
                    medal = '⭐';
                    medalText = '準優勝';
                    bgGradient = 'bg-gradient-to-br from-gray-700/90 to-slate-700/90';
                    borderColor = 'border-gray-400';
                    size = 'md:scale-105 transform';
                    glowClass = 'anime-glow';
                    crownIcon = '⭐';
                  } else if (rank === 3) {
                    medal = '🏆';
                    medalText = '3位';
                    bgGradient = 'bg-gradient-to-br from-orange-900/90 to-red-900/90';
                    borderColor = 'border-orange-400';
                    glowClass = 'anime-glow';
                    crownIcon = '🏆';
                  }

                  return (
                    <div
                      key={participant.id}
                      className={`rounded-2xl border-2 p-8 text-center transition-all duration-500 hover:scale-105 ${bgGradient} ${borderColor} ${size} ${glowClass} shadow-2xl backdrop-blur-sm relative group overflow-hidden`}
                    >
                      {/* Background particles */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      <div className="relative z-10">
                        <div className="mb-4">
                          <div className="text-6xl mb-2 anime-float">{crownIcon}</div>
                          <div className="text-4xl font-bold text-white">{medalText}</div>
                        </div>

                        <div className="mb-4">
                          <div className="text-2xl font-bold text-white mb-1">
                            {participant.name}
                          </div>
                          <div className="text-sm text-gray-400 font-mono">
                            RANK #{rank}
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="text-4xl font-black text-cyan-400 font-mono">
                            {participant.total_score || 0}
                          </div>
                          <div className="text-sm text-cyan-300 font-mono">PTS</div>
                        </div>

                        <div className="text-sm text-gray-300 font-mono">
                          {rank === 1 ? 'LEGENDARY CHAMPION' : rank === 2 ? 'ELITE WARRIOR' : 'HONORABLE FIGHTER'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {otherParticipants.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-6 text-center text-2xl font-bold text-gray-300">
                その他の参戦者
                <div className="text-cyan-400 font-mono text-sm mt-1">OTHER PARTICIPANTS</div>
              </h3>
              <div className="space-y-3">
                {otherParticipants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-700/80 to-slate-800/80 p-4 border border-slate-600/50 backdrop-blur-sm hover:border-slate-500/70 transition-all duration-300 hover:scale-101"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg flex items-center justify-center border border-gray-500">
                        <span className="text-white font-bold text-sm">#{index + 4}</span>
                      </div>
                      <span className="text-lg font-semibold text-white">
                        {participant.name}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-gray-300 font-mono">
                      {participant.total_score || 0} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {participants.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-4">👻</div>
              <div className="text-xl font-semibold text-gray-400">
                このクイズには参戦者がいません
              </div>
              <div className="text-sm text-gray-500 mt-2">No participants in this quiz</div>
            </div>
          )}

          <div className="mt-12 text-center">
            <button
              onClick={() => router.push('/')}
              className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-12 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-110 hover:shadow-2xl transform anime-glow border-2 border-pink-400/50 hover:border-cyan-400 anime-pulse-glow"
            >
              <div className="flex items-center justify-center gap-3">
                <span>🔄</span>
                <span>新しいバトルを開始</span>
                <span>⚡</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
