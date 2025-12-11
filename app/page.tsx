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
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
      {/* Morphin Grid background flares */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-red-500/15 rounded-full blur-3xl anime-float"></div>
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl anime-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/15 rounded-full blur-2xl anime-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-6 right-12 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl anime-float" style={{animationDelay: '2.4s'}}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Main card with glassmorphism effect */}
        <div className="rounded-3xl backdrop-blur-xl p-8 border border-white/10 anime-glow"
             style={{
               background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.95) 0%, rgba(30, 35, 45, 0.92) 100%)',
               boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(239, 68, 68, 0.18)'
             }}>

          {/* Title with ranger styling */}
          <div className="mb-8 text-center">
            <h1 className="text-6xl font-black mb-2 bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent anime-pulse-glow">
              MORPHIN GRID
            </h1>
            <h2 className="text-3xl font-bold text-white mb-2 cyberpunk-flicker">
              Ranger Quiz Command
            </h2>
            <div className="flex justify-center items-center gap-2 text-emerald-300 font-mono">
              <span className="w-2 h-2 bg-emerald-300 rounded-full anime-pulse-glow"></span>
              <span className="text-sm">Go Go, real-time quiz squad</span>
              <span className="w-2 h-2 bg-emerald-300 rounded-full anime-pulse-glow"></span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Create Quiz Section - Host */}
            <div className="rounded-2xl border-2 border-red-500/40 bg-gradient-to-br from-red-600/20 to-amber-500/10 p-6 anime-glow group hover:border-red-400/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-amber-500 rounded-lg flex items-center justify-center anime-glow">
                  <span className="text-white font-bold">🛡️</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Morph as Red Leader
                </h2>
              </div>
              <p className="mb-4 text-base text-gray-200 font-medium">
                Launch a new session • {TOTAL_QUESTIONS} Power Rangers lore battles
              </p>
              <button
                onClick={handleCreateQuiz}
                disabled={isCreating}
                className="w-full rounded-2xl bg-gradient-to-r from-red-500 via-amber-400 to-yellow-400 px-6 py-4 text-lg font-bold text-gray-900 transition-all duration-300 hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform anime-glow border border-yellow-300/60 hover:border-amber-200"
              >
                {isCreating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Forming Megazord...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>⚡</span>
                    <span>Morph Session</span>
                    <span>🟥</span>
                  </div>
                )}
              </button>
            </div>

            {/* Join Quiz Section */}
            <div className="rounded-2xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-600/20 to-emerald-500/10 p-6 anime-glow-blue group hover:border-blue-400/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center anime-glow-blue">
                  <span className="text-white font-bold">🧑‍🚀</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Join the Ranger Squad
                </h2>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter morph code"
                  maxLength={6}
                  className="w-full rounded-xl border-2 border-blue-400/50 px-4 py-4 text-center text-xl font-mono font-bold tracking-widest text-blue-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 bg-slate-800/60 backdrop-blur-sm placeholder:text-blue-500/70 transition-all duration-300"
                />
                <button
                  onClick={handleJoinQuiz}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-600 px-6 py-4 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl transform anime-glow-blue border border-emerald-300/60 hover:border-blue-200"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🎯</span>
                    <span>Join the Grid</span>
                    <span>🔵</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer with anime elements */}
          <div className="mt-8 text-center">
            <div className="flex justify-center items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                Real-time
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                Multiplayer
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                Morphin Theme
              </span>
            </div>
          </div>
        </div>

        {/* Floating particles effect */}
        <div className="absolute -inset-4 pointer-events-none">
          <div className="absolute top-4 left-4 w-2 h-2 bg-red-400 rounded-full opacity-60 anime-float"></div>
          <div className="absolute top-8 right-8 w-1 h-1 bg-blue-400 rounded-full opacity-40 anime-float" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-green-400 rounded-full opacity-50 anime-float" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute bottom-4 right-4 w-2 h-2 bg-yellow-300 rounded-full opacity-70 anime-float" style={{animationDelay: '2.5s'}}></div>
        </div>
      </div>
    </div>
  );
}
