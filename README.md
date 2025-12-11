# Realtime Quiz Application

A realtime quiz application built with Next.js, TypeScript, Tailwind CSS, and Supabase. Hosts can create quiz sessions and control the flow, while participants join and answer questions in real-time.

## Features

- **Host Dashboard**: Create quiz sessions, control question flow, view participants
- **Participant Interface**: Join quizzes, answer questions in real-time, see rankings
- **Real-time Updates**: Live synchronization using Supabase Realtime
- **Timer-based Scoring**: Top 3 fastest correct answers receive points (10, 7, 5)
- **Live Rankings**: See current leaderboard between questions
- **Winner Display**: Final results screen showing top 3 winners

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dciwuiatjphznadkuyhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get your Supabase keys from your Supabase project dashboard.

### 3. Database Setup

The application uses the following Supabase tables:
- `quizzes` - Quiz metadata
- `quiz_sessions` - Active quiz sessions
- `participants` - Quiz participants
- `answers` - Participant answers

The tables should already be set up in your Supabase project. If not, you can create them using the Supabase MCP tools.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Hosting a Quiz

1. Click "Start Quiz" on the home page
2. Share the generated 6-character code with participants
3. Wait for participants to join
4. Click "Start Quiz" when ready
5. Click "Next Question" to proceed through questions
6. Click "Show Rankings" to display current leaderboard between questions

### Joining a Quiz

1. Enter the 6-character quiz code
2. Enter your unique name
3. Wait for the host to start the quiz
4. Answer questions as they appear
5. View rankings between questions
6. See final winners at the end

## Project Structure

```
quizapp/
├── app/
│   ├── host/[code]/     # Host dashboard
│   ├── join/[code]/     # Participant join page
│   ├── quiz/[code]/     # Participant quiz view
│   └── page.tsx          # Landing page
├── components/
│   ├── RankingDisplay.tsx   # Rankings component
│   └── WinnerDisplay.tsx    # Winners component
├── lib/
│   ├── quiz-questions.ts    # Pre-defined quiz questions
│   ├── supabase.ts          # Supabase client
│   └── utils.ts             # Utility functions
└── README.md
```

## Customizing Quiz Questions

Edit `lib/quiz-questions.ts` to modify the quiz questions:

```typescript
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "Your question here?",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: 0, // Index of correct answer (0-3)
    timeLimit: 30, // Time limit in seconds
  },
  // Add more questions...
];
```

## Technologies Used

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Backend and real-time functionality
- **Supabase Realtime** - Live updates

## License

MIT
