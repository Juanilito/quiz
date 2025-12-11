export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct answer
  timeLimit: number; // Time limit in seconds
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "Who is the original Red Ranger in Mighty Morphin Power Rangers?",
    options: ["Jason Lee Scott", "Tommy Oliver", "Billy Cranston", "Zack Taylor"],
    correctAnswer: 0,
    timeLimit: 25,
  },
  {
    question: "What phrase activates the Rangers' transformation?",
    options: ["Power Up!", "Let's Go!", "It's Morphin Time!", "Go Go Rangers!"],
    correctAnswer: 2,
    timeLimit: 20,
  },
  {
    question: "Who served as the Rangers' mentor inside the Command Center tube?",
    options: ["Alpha 5", "Zordon", "Dulcea", "Gosei"],
    correctAnswer: 1,
    timeLimit: 25,
  },
  {
    question: "Which Ranger first wielded the Dragonzord powers?",
    options: ["Red Ranger", "Green Ranger", "Black Ranger", "White Ranger"],
    correctAnswer: 1,
    timeLimit: 20,
  },
  {
    question: "What prehistoric creature powers the Pink Ranger's Dinozord?",
    options: ["Sabertooth Tiger", "Triceratops", "Pterodactyl", "Tyrannosaurus"],
    correctAnswer: 2,
    timeLimit: 20,
  },
  {
    question: "Which villain was freed from a space dumpster and became the first major foe?",
    options: ["Lord Zedd", "Rita Repulsa", "Astronema", "Divatox"],
    correctAnswer: 1,
    timeLimit: 25,
  },
  {
    question: "What California city do the Rangers protect in the original series?",
    options: ["Blue Valley", "Angel Grove", "Reefside", "Silver Hills"],
    correctAnswer: 1,
    timeLimit: 20,
  },
  {
    question: "Which Ranger has canonically been both Green and White?",
    options: ["Rocky DeSantos", "Adam Park", "Tommy Oliver", "Leo Corbett"],
    correctAnswer: 2,
    timeLimit: 25,
  },
  {
    question: "What call does Alpha 5 often make when trouble appears?",
    options: ["Yo, Rangers!", "Alert! Alert!", "Ay-yi-yi-yi-yi!", "Morph Now!"],
    correctAnswer: 2,
    timeLimit: 15,
  },
  {
    question: "Which Zords combine to form the original Megazord?",
    options: ["Ninja Zords", "Dinozords", "Thunderzords", "Turbo Zords"],
    correctAnswer: 1,
    timeLimit: 20,
  },
];

export const TOTAL_QUESTIONS = QUIZ_QUESTIONS.length;


