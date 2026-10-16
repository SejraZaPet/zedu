import { describe, it, expect } from "vitest";
import { evaluateOrdering, evaluateImageLabel } from "@/lib/ordering-imagelabel-answers";
import { readActivityAnswers } from "@/lib/activity-answers";
describe("evaluateOrdering", () => {
  it("označí správná a špatná místa", () => {
    const r = evaluateOrdering(["A", "B", "C"], [0, 2, 1]);
    expect(r.score).toBe(1); expect(r.maxScore).toBe(3);
    expect(r.answers.map((a) => a.correct)).toEqual([true, false, false]);
    expect(r.answers[1]).toMatchObject({ studentAnswer: "C", correctAnswer: "B" });
    expect(readActivityAnswers(r.answers)).toBeDefined();
  });
  it("vše správně", () => expect(evaluateOrdering(["A", "B"], [0, 1]).score).toBe(2));
  it("chybějící data nespadnou", () => {
    expect(evaluateOrdering(undefined, undefined)).toEqual({ score: 0, maxScore: 0, answers: [] });
    expect(evaluateOrdering(["A", "B"], null).answers[0]).toMatchObject({ correct: false, studentAnswer: "Bez odpovědi" });
    expect(evaluateOrdering(["A"], [7]).score).toBe(0);
  });
});
describe("evaluateImageLabel", () => {
  const markers = [{ x: 1, y: 1, label: "Srdce" }, { x: 2, y: 2, label: "Plíce" }, { x: 3, y: 3, label: "Játra" }];
  it("označí správné a špatné popisky", () => {
    const r = evaluateImageLabel(markers, { 0: "Srdce", 1: "Játra" });
    expect(r.score).toBe(1); expect(r.maxScore).toBe(3);
    expect(r.answers.map((a) => a.correct)).toEqual([true, false, false]);
    expect(r.answers[2].studentAnswer).toBe("Bez odpovědi");
    expect(readActivityAnswers(r.answers)).toBeDefined();
  });
  it("chybějící nebo prázdná data nespadnou", () => {
    expect(evaluateImageLabel(null, null)).toEqual({ score: 0, maxScore: 0, answers: [] });
    const r = evaluateImageLabel([null, { label: "" }], {});
    expect(r.score).toBe(0); expect(r.maxScore).toBe(2);
  });
});
