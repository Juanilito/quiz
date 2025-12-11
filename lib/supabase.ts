import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Test connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase auth connection error:', error);
  } else {
    console.log('✅ Supabase auth connected successfully');
  }
});

// Test database connection
supabase.from('quizzes').select('count').then(({ data, error }) => {
  if (error) {
    console.error('Supabase database connection error:', error);
  } else {
    console.log('✅ Supabase database connected successfully');
  }
});

// Enhanced real-time subscription manager with retry logic
export class RealtimeManager {
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 3;
  private retryDelay = 2000; // Start with 2 seconds, exponential backoff

  async subscribeWithRetry(
    channelName: string,
    setupChannel: () => any,
    onSuccess: () => void,
    onError?: (error: string) => void
  ) {
    const attemptKey = channelName;
    const currentAttempts = this.retryAttempts.get(attemptKey) || 0;

    if (currentAttempts >= this.maxRetries) {
      console.error(`❌ Max retry attempts reached for ${channelName}`);
      onError?.(`Failed to connect after ${this.maxRetries} attempts`);
      return null;
    }

    try {
      console.log(`🔄 Setting up subscription for ${channelName} (attempt ${currentAttempts + 1}/${this.maxRetries})`);

      const channel = setupChannel();

      // Set up error handling
      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscription successful for ${channelName}`);
          this.retryAttempts.delete(attemptKey); // Reset retry count on success
          onSuccess();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Subscription ${status} for ${channelName}, retrying...`);
          this.retryAttempts.set(attemptKey, currentAttempts + 1);

          // Retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, currentAttempts);
          setTimeout(() => {
            this.subscribeWithRetry(channelName, setupChannel, onSuccess, onError);
          }, delay);
        } else {
          console.log(`📡 Subscription status for ${channelName}: ${status}`);
        }
      });

      return channel;
    } catch (error) {
      console.error(`❌ Error setting up subscription for ${channelName}:`, error);
      this.retryAttempts.set(attemptKey, currentAttempts + 1);

      const delay = this.retryDelay * Math.pow(2, currentAttempts);
      setTimeout(() => {
        this.subscribeWithRetry(channelName, setupChannel, onSuccess, onError);
      }, delay);

      return null;
    }
  }

  resetRetries(channelName: string) {
    this.retryAttempts.delete(channelName);
  }
}

export const realtimeManager = new RealtimeManager();

// Fallback polling for real-time updates
export class RealtimeFallback {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastData: Map<string, any> = new Map();

  // Poll for session updates
  pollSession(code: string, onUpdate: (data: any) => void, intervalMs: number = 1000) {
    const key = `session-${code}`;

    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key)!);
    }

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_sessions')
          .select('*')
          .eq('session_code', code)
          .single();

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        const lastData = this.lastData.get(key);
        const hasChanged = !lastData ||
            lastData.status !== data.status ||
            lastData.current_question_index !== data.current_question_index ||
            lastData.question_start_time !== data.question_start_time;

        if (hasChanged) {
          console.log('🔄 Polling: Session changed, updating...', {
            old: { status: lastData?.status, questionIndex: lastData?.current_question_index },
            new: { status: data.status, questionIndex: data.current_question_index }
          });
          this.lastData.set(key, data);
          onUpdate(data);
        } else {
          // Even if no change detected, still call onUpdate to ensure state is up to date
          // This helps with cases where the initial state might be stale
          onUpdate(data);
        }
      } catch (error) {
        console.error('Polling failed:', error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, intervalMs);
    this.intervals.set(key, intervalId);

    return () => {
      if (this.intervals.has(key)) {
        clearInterval(this.intervals.get(key)!);
        this.intervals.delete(key);
        this.lastData.delete(key);
      }
    };
  }

  // Poll for participant updates
  pollParticipants(sessionId: string, onUpdate: (data: any[]) => void, intervalMs: number = 2000) {
    const key = `participants-${sessionId}`;

    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key)!);
    }

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('participants')
          .select('*')
          .eq('session_id', sessionId)
          .order('total_score', { ascending: false });

        if (error) {
          console.error('Participants polling error:', error);
          return;
        }

        const lastData = this.lastData.get(key);
        if (!lastData || JSON.stringify(lastData) !== JSON.stringify(data)) {
          console.log('👥 Polling: Participants changed, updating...');
          this.lastData.set(key, data);
          onUpdate(data);
        }
      } catch (error) {
        console.error('Participants polling failed:', error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, intervalMs);
    this.intervals.set(key, intervalId);

    return () => {
      if (this.intervals.has(key)) {
        clearInterval(this.intervals.get(key)!);
        this.intervals.delete(key);
        this.lastData.delete(key);
      }
    };
  }

  // Poll for answer updates
  pollAnswers(sessionId: string, participantId: string, questionIndex: number, onUpdate: (data: any) => void, intervalMs: number = 1000) {
    const key = `answers-${sessionId}-${participantId}-${questionIndex}`;

    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key)!);
    }

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('answers')
          .select('*')
          .eq('session_id', sessionId)
          .eq('participant_id', participantId)
          .eq('question_index', questionIndex)
          .maybeSingle();

        if (error) {
          console.error('Answers polling error:', error);
          return;
        }

        const lastData = this.lastData.get(key);
        if (!lastData || JSON.stringify(lastData) !== JSON.stringify(data)) {
          console.log('📝 Polling: Answer changed, updating...');
          this.lastData.set(key, data);
          onUpdate(data);
        }
      } catch (error) {
        console.error('Answers polling failed:', error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, intervalMs);
    this.intervals.set(key, intervalId);

    return () => {
      if (this.intervals.has(key)) {
        clearInterval(this.intervals.get(key)!);
        this.intervals.delete(key);
        this.lastData.delete(key);
      }
    };
  }

  // Stop all polling
  stopAll() {
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();
    this.lastData.clear();
  }
}

export const realtimeFallback = new RealtimeFallback();
