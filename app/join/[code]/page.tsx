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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
        <div className="text-2xl font-bold text-emerald-200">Tapping into the Morphin Grid...</div>
      </div>
    );
  }

  if (sessionExists === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
        <div className="rounded-2xl p-8 shadow-2xl border border-red-500/50 bg-gradient-to-br from-red-600/15 via-slate-900 to-blue-600/15">
          <h2 className="mb-4 text-3xl font-extrabold text-red-300 flex items-center gap-2">❌ Code Not Found</h2>
          <p className="mb-6 text-xl font-semibold text-gray-200">That morph code isn&apos;t in the Grid. Try again.</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-2xl bg-gradient-to-r from-red-500 via-amber-400 to-yellow-400 px-8 py-4 text-lg font-extrabold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(248,113,113,0.35)]"
          >
            Back to Command Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 p-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_70%_70%,rgba(52,211,153,0.14),transparent_35%)]" />
      <div className="relative w-full max-w-md rounded-3xl p-9 shadow-2xl border border-emerald-400/40 bg-gradient-to-br from-slate-900/90 via-gray-900/90 to-slate-950/90 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-black text-emerald-200 flex items-center gap-2">
            🐉 Join the Ranger Grid
          </h1>
          <span className="text-sm font-mono text-emerald-200 bg-emerald-500/10 border border-emerald-400/40 rounded-full px-3 py-1">
            Code: {code}
          </span>
        </div>

        <p className="mb-6 text-sm text-gray-300">
          Choose your ranger call sign and enter the Morphin Grid quiz arena.
        </p>

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-emerald-200">
              Ranger Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Red Ranger"
              maxLength={50}
              className="w-full rounded-xl border border-emerald-400/30 bg-slate-950/70 px-4 py-4 text-lg font-semibold text-emerald-100 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/30"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isJoining || !name.trim()}
            className="w-full rounded-2xl bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 px-4 py-4 text-xl font-extrabold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(248,113,113,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isJoining ? 'Syncing with Zordon...' : 'Join the Squad'}
          </button>
        </form>
      </div>
    </div>
  );
}
