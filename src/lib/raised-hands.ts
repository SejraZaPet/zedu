import type { GamePlayer } from "./game-types";

/** Raised hands in the order students raised them (earliest first). */
export function sortRaisedHands<T extends Pick<GamePlayer, "id" | "hand_raised" | "hand_raised_at">>(players: T[]): T[] {
  return players
    .filter((p) => !!p.hand_raised)
    .sort((a, b) => (a.hand_raised_at || "").localeCompare(b.hand_raised_at || "") || a.id.localeCompare(b.id));
}

/** Student hand button is offered in every state except the final results. */
export function canStudentRaiseHand(status: string | undefined, hasJoinToken: boolean): boolean {
  return hasJoinToken && (status === "lobby" || status === "playing");
}
