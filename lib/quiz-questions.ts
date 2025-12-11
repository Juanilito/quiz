export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct answer
  timeLimit: number; // Time limit in seconds
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2,
    timeLimit: 30,
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 1,
    timeLimit: 30,
  },
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1,
    timeLimit: 15,
  },
  {
    question: "Who wrote 'Romeo and Juliet'?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    correctAnswer: 1,
    timeLimit: 30,
  },
  {
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
    correctAnswer: 3,
    timeLimit: 30,
  },
  {
    question: "In which year did World War II end?",
    options: ["1943", "1944", "1945", "1946"],
    correctAnswer: 2,
    timeLimit: 30,
  },
  {
    question: "What is the chemical symbol for gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctAnswer: 2,
    timeLimit: 20,
  },
  {
    question: "Which programming language is known as the 'language of the web'?",
    options: ["Python", "Java", "JavaScript", "C++"],
    correctAnswer: 2,
    timeLimit: 20,
  },
  {
    question: "What is the speed of light in vacuum (approximately)?",
    options: ["300,000 km/s", "150,000 km/s", "450,000 km/s", "600,000 km/s"],
    correctAnswer: 0,
    timeLimit: 30,
  },
  {
    question: "Which mountain is the tallest in the world?",
    options: ["K2", "Mount Kilimanjaro", "Mount Everest", "Mount Fuji"],
    correctAnswer: 2,
    timeLimit: 30,
  },
];

export const TOTAL_QUESTIONS = QUIZ_QUESTIONS.length;


