import { describe, expect, it } from "vitest";
import { computeGameQuestionResults, computePersonalGameSummary, gameQuestionLabel } from "@/lib/game-results";

const slides = [
  { question: "Přímá otázka" },
  { activitySpec: { question: "Otázka aktivity" } },
  { projector: { headline: "Nadpis snímku" } },
];

describe("game results", () => {
  it("reads question labels from supported game formats", () => {
    expect(gameQuestionLabel(slides[0], 0)).toBe("Přímá otázka");
    expect(gameQuestionLabel(slides[1], 1)).toBe("Otázka aktivity");
    expect(gameQuestionLabel(slides[2], 2)).toBe("Nadpis snímku");
  });

  it("sorts answered questions from lowest success", () => {
    const rows = computeGameQuestionResults(slides, [
      { question_index: 0, is_correct: true },
      { question_index: 0, is_correct: false },
      { question_index: 1, is_correct: false },
      { question_index: 1, is_correct: false },
      { question_index: 2, is_correct: true },
    ] as any);
    expect(rows.map((row) => row.successPct)).toEqual([0, 50, 100]);
    expect(rows.map((row) => row.question)).toEqual(["Otázka aktivity", "Přímá otázka", "Nadpis snímku"]);
  });

  it("builds a personal summary only from the selected player's answers", () => {
    const summary = computePersonalGameSummary(slides, [
      { player_id: "me", question_index: 0, is_correct: true },
      { player_id: "me", question_index: 1, is_correct: false },
      { player_id: "other", question_index: 2, is_correct: false },
    ] as any, "me");
    expect(summary.correct.map((row) => row.question)).toEqual(["Přímá otázka"]);
    expect(summary.practice.map((row) => row.question)).toEqual(["Otázka aktivity"]);
  });
});