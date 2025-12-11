# Real-time Setup Guide

## Enable Realtime in Supabase

For the quiz app to work in real-time, you **MUST** enable Realtime replication for the following tables:

### Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Database** → **Replication**
4. Enable replication (toggle ON) for these tables:
   - ✅ `quiz_sessions` - For real-time question updates
   - ✅ `participants` - For real-time participant joins and score updates
   - ✅ `answers` - For real-time answer submissions

### Verify Realtime is Working

1. Open browser console (F12)
2. Look for subscription status messages:
   - `"Session subscription status: SUBSCRIBED"` ✅
   - `"Participants subscription status: SUBSCRIBED"` ✅
   - `"Answer subscription status: SUBSCRIBED"` ✅

3. If you see `"CHANNEL_ERROR"`, Realtime is not enabled for that table

### Testing Real-time

1. Open two browser windows:
   - Window 1: Host dashboard (`/host/[code]`)
   - Window 2: Participant view (`/quiz/[code]`)

2. In Host window:
   - Click "Start Quiz"
   - Participant window should immediately show the question (no refresh needed)

3. In Participant window:
   - Answer a question
   - Host window should see participant count update in real-time

4. In Host window:
   - Click "Show Rankings"
   - Participant window should immediately show rankings (no refresh needed)

### Troubleshooting

**If real-time is not working:**

1. ✅ Check Realtime is enabled in Supabase Dashboard
2. ✅ Check browser console for errors
3. ✅ Verify `.env.local` has correct Supabase URL and keys
4. ✅ Check network tab for WebSocket connections
5. ✅ Restart dev server after enabling Realtime

**Common Issues:**

- **"CHANNEL_ERROR"**: Table replication not enabled
- **No updates**: Check RLS policies allow SELECT
- **Connection issues**: Check Supabase project status


