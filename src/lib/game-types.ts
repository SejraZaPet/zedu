export interface GameQuestion {
  question: string;
  answers: { text: string; correct: boolean }[];
  type: "quiz" | "true_false" | "fill_choice";
  explanation?: string;
  timeLimit?: number;
}

export interface GameSettings {
  timePerQuestion: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showLeaderboardAfterEach: boolean;
  teamMode: boolean;
  gameMode?: "standard" | "race" | "tower" | "steal";
  theme?: string;
  visualTheme?: "default" | "castle" | "space" | "pirate";
  soundsEnabled?: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  timePerQuestion: 20,
  shuffleQuestions: false,
  shuffleAnswers: true,
  showLeaderboardAfterEach: true,
  teamMode: false,
  gameMode: "standard",
  theme: "default",
};

export interface GamePlayer {
  id: string;
  session_id: string;
  user_id: string | null;
  nickname: string;
  total_score: number;
  created_at: string;
}

export interface GameSession {
  id: string;
  teacher_id: string;
  title: string;
  game_code: string;
  status: string;
  activity_data: GameQuestion[];
  settings: GameSettings;
  current_question_index: number;
  question_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameResponse {
  id: string;
  session_id: string;
  player_id: string;
  question_index: number;
  answer: any;
  is_correct: boolean;
  response_time_ms: number;
  score: number;
  created_at: string;
}

export function calculateScore(correct: boolean, responseTimeMs: number, timeLimitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.max(0, 1 - responseTimeMs / timeLimitMs);
  return Math.round(400 + 600 * ratio); // 400-1000 points
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
