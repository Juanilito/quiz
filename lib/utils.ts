/**
 * Generates a random 6-character code for quiz sessions
 */
export function generateQuizCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Formats time in milliseconds to MM:SS format
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculates points based on position (top 3 fastest correct answers)
 */
export function calculatePoints(position: number): number {
  switch (position) {
    case 1:
      return 10;
    case 2:
      return 7;
    case 3:
      return 5;
    default:
      return 0;
  }
}


