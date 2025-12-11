'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [sessionExists, setSessionExists] = useState<boolean | null>(null);

  useEffect(() => {
    checkSession();
  }, [code]);

  const checkSession = async () => {
    const { data, error } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('session_code', code)
      .single();

    if (error || !data) {
      setSessionExists(false);
    } else {
      setSessionExists(true);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsJoining(true);

    try {
      // Get session
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id')
        .eq('session_code', code)
        .single();

      if (sessionError || !session) {
        throw new Error('Quiz session not found');
      }

      // Check if name already exists in this session
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('session_id', session.id)
        .eq('name', name.trim())
        .single();

      if (existingParticipant) {
        alert('This name is already taken. Please choose another name.');
        setIsJoining(false);
        return;
      }

      // Create participant
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({
          session_id: session.id,
          name: name.trim(),
          total_score: 0,
        })
        .select()
        .single();

      if (participantError) {
        throw participantError;
      }

      // Store participant ID in localStorage
      localStorage.setItem(`participant_${code}`, participant.id);
      localStorage.setItem(`participant_name_${code}`, name.trim());

      router.push(`/quiz/${code}`);
    } catch (error: any) {
      console.error('Error joining quiz:', error);
      alert(error.message || 'Failed to join quiz. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  if (sessionExists === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-cyan-400 cyberpunk-flicker">システム接続中...</div>
        </div>
      </div>
    );
  }

  if (sessionExists === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="rounded-2xl backdrop-blur-xl p-8 text-center border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(239, 68, 68, 0.2)'
             }}>
          <div className="mb-6">
            <h2 className="text-3xl font-black anime-text-gradient-2 mb-2">❌ コードが見つかりません</h2>
            <div className="text-cyan-400 font-mono text-sm">Code Not Found</div>
          </div>
          <p className="mb-8 text-xl font-semibold text-gray-300">そのコードは無効です。</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-8 py-4 text-lg font-extrabold text-white transition-all duration-300 hover:scale-110 hover:shadow-2xl transform anime-glow border-2 border-pink-400/50 hover:border-cyan-400"
          >
            <div className="flex items-center justify-center gap-2">
              <span>🏠</span>
              <span>ホームに戻る</span>
              <span>⚡</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl anime-float"></div>
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl anime-float" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Main card with glassmorphism effect */}
        <div className="rounded-3xl backdrop-blur-xl p-8 border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 107, 157, 0.1)'
             }}>

          {/* Title with anime styling */}
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-black anime-text-gradient mb-2">
              参戦
            </h1>
            <h2 className="text-2xl font-bold text-white mb-2 cyberpunk-flicker">
              JOIN QUIZ
            </h2>
            <div className="flex justify-center items-center gap-2 text-cyan-400 font-mono">
              <span className="w-2 h-2 bg-cyan-400 rounded-full anime-pulse-glow"></span>
              <span className="text-sm">バトルレディ</span>
              <span className="w-2 h-2 bg-cyan-400 rounded-full anime-pulse-glow"></span>
            </div>
          </div>

          {/* Code display */}
          <div className="mb-6 text-center">
            <div className="font-mono font-bold text-cyan-300 bg-slate-800/80 px-4 py-2 rounded-xl border border-cyan-400/50 anime-glow-blue backdrop-blur-sm">
              CODE: {code}
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label htmlFor="name" className="mb-2 block text-lg font-bold text-cyan-300">
                プレイヤー名
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="あなたの名前を入力"
                maxLength={50}
                className="w-full rounded-xl border-2 border-cyan-400/50 px-4 py-4 text-lg font-bold text-cyan-300 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 bg-slate-800/50 backdrop-blur-sm placeholder:text-cyan-600/50 transition-all duration-300"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isJoining || !name.trim()}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600 px-6 py-4 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform anime-glow-blue border border-cyan-400/50 hover:border-cyan-300"
            >
              {isJoining ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>参戦中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <span>⚔️</span>
                  <span>参戦する</span>
                  <span>⚡</span>
                </div>
              )}
            </button>
          </form>

          {/* Floating particles effect */}
          <div className="absolute -inset-4 pointer-events-none">
            <div className="absolute top-4 left-4 w-2 h-2 bg-pink-400 rounded-full opacity-60 anime-float"></div>
            <div className="absolute top-8 right-8 w-1 h-1 bg-cyan-400 rounded-full opacity-40 anime-float" style={{animationDelay: '0.5s'}}></div>
            <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-50 anime-float" style={{animationDelay: '1.5s'}}></div>
            <div className="absolute bottom-4 right-4 w-2 h-2 bg-cyan-400 rounded-full opacity-70 anime-float" style={{animationDelay: '2.5s'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
