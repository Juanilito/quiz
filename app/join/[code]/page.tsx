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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070c] via-[#0b132b] to-black">
        <div className="text-2xl font-bold text-yellow-200">Scanning Gotham skyline...</div>
      </div>
    );
  }

  if (sessionExists === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070c] via-[#0b132b] to-black">
        <div className="rounded-2xl gotham-card p-8 shadow-2xl border border-red-500/50">
          <h2 className="mb-4 text-3xl font-extrabold text-red-300 flex items-center gap-2">❌ Code Not Found</h2>
          <p className="mb-6 text-xl font-semibold text-gray-200">That signal doesn&apos;t match any active quiz.</p>
          <button
            onClick={() => router.push('/')}
            className="bat-sheen rounded-2xl bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-400 px-8 py-4 text-lg font-extrabold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(246,201,14,0.25)]"
          >
            Return to HQ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070c] via-[#0b132b] to-black p-6">
      <div className="pointer-events-none absolute inset-0 gotham-grid opacity-35" />
      <div className="relative w-full max-w-md rounded-3xl gotham-card p-9 shadow-2xl border border-yellow-400/30">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-black text-yellow-300 flex items-center gap-2">
            🦇 Join Quiz
          </h1>
          <span className="text-sm font-mono text-gray-300 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-3 py-1">
            Code: {code}
          </span>
        </div>

        <p className="mb-6 text-sm text-gray-300">
          Enter your vigilante alias and step into the Gotham quiz arena.
        </p>

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-yellow-200">
              Hero Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nightwing"
              maxLength={50}
              className="w-full rounded-xl border border-yellow-400/30 bg-[#0a0c13] px-4 py-4 text-lg font-semibold text-yellow-100 focus:border-yellow-300 focus:outline-none focus:ring-4 focus:ring-yellow-400/30"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isJoining || !name.trim()}
            className="bat-sheen w-full rounded-2xl bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-400 px-4 py-4 text-xl font-extrabold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(246,201,14,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isJoining ? 'Dropping into Gotham...' : 'Join the Mission'}
          </button>
        </form>
      </div>
    </div>
  );
}
