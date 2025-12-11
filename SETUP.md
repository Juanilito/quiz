# Setup Checklist

## 1. Environment Variables

Create a `.env.local` file in the root directory with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dciwuiatjphznadkuyhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaXd1aWF0anBoem5hZGt1eWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjkxNTUsImV4cCI6MjA4MTAwNTE1NX0.AQGevOymYtvHF9Jjpi5SQi53ijZSNk8kisWwb1Mt1zQ
```

## 2. Enable Supabase Realtime

In your Supabase dashboard, enable Realtime for the following tables:
- `quiz_sessions`
- `participants`
- `answers`

To enable Realtime:
1. Go to Database → Replication
2. Enable replication for each table listed above

## 3. Install Dependencies

```bash
npm install
```

## 4. Run the Application

```bash
npm run dev
```

## 5. Test the Application

1. Open http://localhost:3000
2. Click "Start Quiz" to create a quiz session
3. Copy the 6-character code
4. Open a new browser tab/window
5. Enter the code and join as a participant
6. Start the quiz from the host dashboard
7. Answer questions and see real-time updates

## Troubleshooting

### Realtime not working?
- Make sure Realtime is enabled in Supabase dashboard
- Check that your Supabase URL and keys are correct in `.env.local`

### Database errors?
- Verify that all tables exist in your Supabase project
- Check that RLS policies allow public access (or use service role key)

### Questions not appearing?
- Check browser console for errors
- Verify Supabase connection in Network tab


