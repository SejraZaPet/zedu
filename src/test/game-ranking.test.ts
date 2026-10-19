import { describe, expect, it } from "vitest";
import { applyPlayerUpdate, rankGamePlayers } from "@/lib/game-ranking";
import type { GamePlayer } from "@/lib/game-types";
import { sessionDisplayName, DEFAULT_SCREEN_NAME_MODE, DEFAULT_EXPORT_NAME_MODE } from "../../supabase/functions/_shared/session-display-name";

const player = (id: string, score: number, progress = 0): GamePlayer => ({
  id, nickname: id, session_id: "test", user_id: null, total_score: score,
  created_at: "2026-10-19T09:00:00Z", student_index: progress,
});
describe("final game ranking", () => {
  it("equal scores share competition ranks 1, 1, 3", () => {
    expect(rankGamePlayers([player("c", 50), player("b", 100), player("a", 100)])
      .map(({ player, rank }) => [player.id, rank])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
  });
  it("stabilizes ties without mutating the input", () => {
    const original = [player("b", 100), player("a", 100)];
    expect(rankGamePlayers(original).map((row) => row.player.id)).toEqual(["a", "b"]);
    expect(original[0].id).toBe("b");
  });
  it("race preserves progress then score, sharing a rank only when both match", () => {
    expect(rankGamePlayers([player("a", 1000, 1), player("b", 50, 2), player("c", 50, 2), player("d", 40, 2)], true)
      .map(({ player, rank }) => [player.id, rank])).toEqual([["b", 1], ["c", 1], ["d", 3], ["a", 4]]);
  });
  it("accepts a legitimate theft score decrease and resorts players", () => {
    expect(applyPlayerUpdate([player("a", 10), player("b", 8)], player("a", 5))
      .map((p) => [p.id, p.total_score])).toEqual([["b", 8], ["a", 5]]);
  });
  it("accepts a score below zero without changing opponents", () => {
    expect(applyPlayerUpdate([player("a", 2), player("b", 8)], player("a", -1))
      .map((p) => p.total_score)).toEqual([8, -1]);
  });
});
describe("result names", () => {
  const participant = { nickname: "Žofka", user_id: "u" };
  const profiles = { u: "Jiné profilové jméno" };
  it("screen defaults to the entered nickname even with a profile name", () => {
    expect(DEFAULT_SCREEN_NAME_MODE).toBe("nickname");
    expect(sessionDisplayName(participant, 0, DEFAULT_SCREEN_NAME_MODE, profiles)).toBe("Žofka");
  });
  it("file exports keep the pseudonymous default", () => {
    expect(DEFAULT_EXPORT_NAME_MODE).toBe("pseudonymous");
    expect(sessionDisplayName(participant, 1, DEFAULT_EXPORT_NAME_MODE, profiles)).toBe("Student_2");
  });
  it("anonymous mode does not reveal nickname or profile name", () => {
    expect(sessionDisplayName(participant, 0, "anonymous", profiles)).toBe("Účastník 1");
  });
  it("retains explicitly chosen profile names", () => {
    expect(sessionDisplayName(participant, 0, "named", profiles)).toBe("Jiné profilové jméno");
  });
});