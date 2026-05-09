export interface GameQuestion {
  question: string;
  answers: { text: string; correct: boolean }[];
  type: "quiz" | "true_false" | "fill_choice";
  explanation?: string;
  timeLimit?: number;
}

export type TeamMode = "none" | "random" | "manual";

export interface Team {
  id: string;
  name: string;
  color: string;
  members: string[]; // game_players.id
}

export interface TeamsData {
  teams: Team[];
}

export interface GameSettings {
  timePerQuestion: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showLeaderboardAfterEach: boolean;
  teamMode: boolean;
  teamModeKind?: TeamMode; // 'none' | 'random' | 'manual'
  teamCount?: number; // 2-6 for random
  gameMode?: "standard" | "race" | "tower" | "steal";
  theme?: string;
  visualTheme?: "default" | "castle" | "space" | "pirate";
  soundsEnabled?: boolean;
}

export const TEAM_COLORS = [
  "#EF4444", // red
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
];

export const TEAM_EMOJIS = ["🔴", "🔵", "🟢", "🟡", "🟣", "🩷"];

export function buildDefaultTeams(count: number): Team[] {
  return Array.from({ length: Math.max(2, Math.min(6, count)) }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Tým ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    members: [],
  }));
}

export function distributeRandomly(playerIds: string[], count: number): Team[] {
  const teams = buildDefaultTeams(count);
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  shuffled.forEach((pid, i) => {
    teams[i % teams.length].members.push(pid);
  });
  return teams;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  timePerQuestion: 20,
  shuffleQuestions: false,
  shuffleAnswers: true,
  showLeaderboardAfterEach: true,
  teamMode: false,
  gameMode: "standard",
  theme: "default",
  visualTheme: "default",
  soundsEnabled: true,
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
