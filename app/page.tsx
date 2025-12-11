'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateQuizCode } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { TOTAL_QUESTIONS } from '@/lib/quiz-questions';

export default function Home() {
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const router = useRouter();

  const handleCreateQuiz = async () => {
    setIsCreating(true);
    try {
      const code = generateQuizCode();
      const hostId = `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // First create a quiz record
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert({ title: `Quiz ${code}` })
        .select()
        .single();

      if (quizError) throw quizError;

      // Then create the quiz session
      const { error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert({
          quiz_id: quizData.id,
          session_code: code,
          host_id: hostId,
          status: 'waiting',
          current_question_index: 0,
        });

      if (sessionError) throw sessionError;

      // Store host ID in localStorage
      localStorage.setItem(`host_${code}`, hostId);
      
      router.push(`/host/${code}`);
    } catch (error) {
      console.error('Error creating quiz:', error);
      alert('Failed to create quiz. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinQuiz = () => {
    if (joinCode.trim().length === 6) {
      router.push(`/join/${joinCode.toUpperCase()}`);
    } else {
      alert('Please enter a valid 6-character code');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl anime-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl anime-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl anime-float" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Main card with glassmorphism effect */}
        <div className="rounded-3xl backdrop-blur-xl p-8 border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 107, 157, 0.1)'
             }}>

          {/* Title with anime styling */}
          <div className="mb-8 text-center">
            <h1 className="text-6xl font-black anime-text-gradient mb-2 anime-pulse-glow">
              アニメ
            </h1>
            <h2 className="text-3xl font-bold text-white mb-2 cyberpunk-flicker">
              QUIZ BATTLE
            </h2>
            <div className="flex justify-center items-center gap-2 text-cyan-400 font-mono">
              <span className="w-2 h-2 bg-cyan-400 rounded-full anime-pulse-glow"></span>
              <span className="text-sm">リアルタイム対戦</span>
              <span className="w-2 h-2 bg-cyan-400 rounded-full anime-pulse-glow"></span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Create Quiz Section - Host */}
            <div className="rounded-2xl border-2 border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-6 anime-glow group hover:border-pink-400/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center anime-glow">
                  <span className="text-white font-bold">👑</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  ホストとして開始
                </h2>
              </div>
              <p className="mb-4 text-base text-gray-300 font-medium">
                新しいクイズセッションを作成 • {TOTAL_QUESTIONS}問のバトル
              </p>
              <button
                onClick={handleCreateQuiz}
                disabled={isCreating}
                className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-600 px-6 py-4 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform anime-glow border border-pink-400/50 hover:border-pink-300"
              >
                {isCreating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    作成中...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>🚀</span>
                    <span>バトル開始</span>
                    <span>⚡</span>
                  </div>
                )}
              </button>
            </div>

            {/* Join Quiz Section */}
            <div className="rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 anime-glow-blue group hover:border-cyan-400/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center anime-glow-blue">
                  <span className="text-white font-bold">⚔️</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  参戦する
                </h2>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="6文字のコードを入力"
                  maxLength={6}
                  className="w-full rounded-xl border-2 border-cyan-400/50 px-4 py-4 text-center text-xl font-mono font-bold tracking-widest text-cyan-300 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 bg-slate-800/50 backdrop-blur-sm placeholder:text-cyan-600/50 transition-all duration-300"
                />
                <button
                  onClick={handleJoinQuiz}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600 px-6 py-4 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl transform anime-glow-blue border border-cyan-400/50 hover:border-cyan-300"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🎯</span>
                    <span>参戦</span>
                    <span>⚡</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer with anime elements */}
          <div className="mt-8 text-center">
            <div className="flex justify-center items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-pink-400 rounded-full"></span>
                リアルタイム
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-cyan-400 rounded-full"></span>
                マルチプレイヤー
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-purple-400 rounded-full"></span>
                アニメスタイル
              </span>
            </div>
          </div>
        </div>

        {/* Floating particles effect */}
        <div className="absolute -inset-4 pointer-events-none">
          <div className="absolute top-4 left-4 w-2 h-2 bg-pink-400 rounded-full opacity-60 anime-float"></div>
          <div className="absolute top-8 right-8 w-1 h-1 bg-cyan-400 rounded-full opacity-40 anime-float" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-50 anime-float" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute bottom-4 right-4 w-2 h-2 bg-cyan-400 rounded-full opacity-70 anime-float" style={{animationDelay: '2.5s'}}></div>
        </div>
      </div>
    </div>
  );
}
