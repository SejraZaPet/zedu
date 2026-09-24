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
  /** Předem naplánovaní žáci (ze třídy/skupiny) – po připojení se sami zařadí sem. */
  roster?: { userId: string; name: string }[];
}

export interface TeamsData {
  teams: Team[];
  /** Zdroj předem rozdělených žáků (třída nebo skupina). */
  rosterSource?: { kind: "class" | "group"; id: string; name: string } | null;
}

export type TeamScoring = "avg" | "sum";

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
  anonymousAnswers?: boolean;
  pacingMode?: "teacher" | "student";
  showRaceTrack?: boolean;
  /** Total race duration in seconds (Time-to-Climb style). Default 180 = 3 min. */
  raceDurationSec?: number;
  /** ISO timestamp when the race actually started (set on Start in race mode). */
  raceStartedAt?: string | null;
  /** Jak se počítají body týmu: průměr na člena (výchozí) nebo součet. */
  teamScoring?: TeamScoring;
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
  teamModeKind: "none",
  teamCount: 2,
  gameMode: "standard",
  theme: "default",
  visualTheme: "default",
  soundsEnabled: true,
  raceDurationSec: 180,
  raceStartedAt: null,
};

export interface GamePlayer {
  id: string;
  session_id: string;
  user_id: string | null;
  nickname: string;
  total_score: number;
  created_at: string;
  hand_raised?: boolean;
  hand_raised_at?: string | null;
  student_index?: number | null;
}

/**
 * Builds a stable "Žák N" label map based on player join order (created_at asc).
 * Used when session.settings.anonymousAnswers is true on projector/student views.
 */
export function buildAnonymousLabelMap(players: GamePlayer[]): Record<string, string> {
  const sorted = [...players].sort((a, b) =>
    (a.created_at || "").localeCompare(b.created_at || "")
  );
  const map: Record<string, string> = {};
  sorted.forEach((p, i) => {
    map[p.id] = `Žák ${i + 1}`;
  });
  return map;
}

export interface GameSession {
  id: string;
  teacher_id: string;
  title: string;
  game_code: string;
  status: string;
  activity_data: GameQuestion[];
  settings: GameSettings;
  teams?: TeamsData;
  current_question_index: number;
  question_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export function findPlayerTeam(teams: Team[] | undefined, playerId: string): Team | null {
  if (!teams) return null;
  return teams.find((t) => t.members.includes(playerId)) ?? null;
}

export function computeTeamLeaderboard(
  teams: Team[] | undefined,
  players: GamePlayer[],
  scoring: TeamScoring = "avg",
): Array<{ team: Team; score: number; total: number; memberCount: number }> {
  if (!teams || teams.length === 0) return [];
  const byPlayer = new Map(players.map((p) => [p.id, p.total_score]));
  return teams
    .map((team) => {
      const present = team.members.filter((pid) => byPlayer.has(pid));
      const total = present.reduce((sum, pid) => sum + (byPlayer.get(pid) || 0), 0);
      const score = scoring === "sum" ? total : present.length ? Math.round(total / present.length) : 0;
      return { team, score, total, memberCount: present.length };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Zařadí nepřiřazené připojené žáky: nejdřív podle předem připraveného
 * seznamu (roster), v náhodném režimu pak do nejmenšího týmu.
 * Vrací nové týmy, nebo null, když není co měnit.
 */
export function autoAssignPlayers(
  teams: Team[],
  players: GamePlayer[],
  kind: TeamMode,
): Team[] | null {
  if (kind === "none" || teams.length === 0) return null;
  const next = teams.map((t) => ({ ...t, members: [...t.members] }));
  const assigned = new Set(next.flatMap((t) => t.members));
  let changed = false;
  const sorted = [...players].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  for (const p of sorted) {
    if (assigned.has(p.id)) continue;
    let target = p.user_id ? next.find((t) => t.roster?.some((r) => r.userId === p.user_id)) : undefined;
    if (!target && kind === "random") {
      target = next.reduce((min, t) => (t.members.length < min.members.length ? t : min), next[0]);
    }
    if (target) {
      target.members.push(p.id);
      assigned.add(p.id);
      changed = true;
    }
  }
  return changed ? next : null;
}

/** Vyrovná počty připojených členů (rozdíl nejvýš 1), přesouvá z největšího do nejmenšího. */
export function rebalanceTeams(teams: Team[], players: GamePlayer[]): Team[] {
  const online = new Set(players.map((p) => p.id));
  const next = teams.map((t) => ({ ...t, members: t.members.filter((m) => online.has(m)) }));
  for (let guard = 0; guard < 200; guard++) {
    const big = next.reduce((a, t) => (t.members.length > a.members.length ? t : a), next[0]);
    const small = next.reduce((a, t) => (t.members.length < a.members.length ? t : a), next[0]);
    if (big.members.length - small.members.length <= 1) break;
    const moved = big.members.pop()!;
    small.members.push(moved);
  }
  return next;
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
