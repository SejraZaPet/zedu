import { describe, it, expect } from "vitest";
import { scorePractice, correctAnswerLabel, difficultyLabelCs, hasOpenQuestions } from "@/lib/student-practice";
describe("student practice", () => {
  it("3 of 4 correct saves 75 %", () => {
    const qs = [
      { type: "multiple_choice" as const, correct_index: 1 }, { type: "multiple_choice" as const, correct_index: 0 },
      { type: "true_false" as const, correct_answer: false }, { type: "true_false" as const, correct_answer: true },
    ];
    expect(scorePractice(qs, { "0": 1, "1": 0, "2": false, "3": false })).toEqual({ correct: 3, total: 4, percent: 75 });
  });
  it("shows true/false correct answer in Czech, including false", () => {
    expect(correctAnswerLabel({ type: "true_false", correct_answer: false })).toBe("Nepravda");
    expect(correctAnswerLabel({ type: "true_false", correct_answer: true })).toBe("Pravda");
  });
  it("difficulty is Czech", () => { expect(difficultyLabelCs("easy")).toBe("základní"); });
  it("open-answer note only with open questions", () => {
    expect(hasOpenQuestions([{ type: "true_false" }])).toBe(false);
    expect(hasOpenQuestions([{ type: "open" }])).toBe(true);
  });
});
