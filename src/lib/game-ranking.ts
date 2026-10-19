import type { GamePlayer } from "./game-types";

/** Race keeps progress first, then score. Other modes rank by server score. */
function compareResult(a: GamePlayer, b: GamePlayer, race: boolean): number {
  if (race && (a.student_index ?? 0) !== (b.student_index ?? 0)) {
    return (b.student_index ?? 0) - (a.student_index ?? 0);
  }
  return b.total_score - a.total_score;
}

/** Competition ranking (1, 1, 3); join time/id only stabilize equal rows. */
export function rankGamePlayers(players: GamePlayer[], race = false) {
  const sorted = [...players].sort((a, b) => compareResult(a, b, race)
    || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  let rank = 1;
  return sorted.map((player, index) => {
    if (index > 0 && compareResult(sorted[index - 1], player, race) !== 0) rank = index + 1;
    return { player, rank };
  });
}

/** Realtime is authoritative even when theft reduces the score. */
export function applyPlayerUpdate(players: GamePlayer[], updated: GamePlayer): GamePlayer[] {
  return players.map((player) => player.id === updated.id ? { ...player, ...updated } : player)
    .sort((a, b) => b.total_score - a.total_score || a.id.localeCompare(b.id));
}