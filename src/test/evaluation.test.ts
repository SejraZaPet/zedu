import { describe, expect, it } from "vitest";
import {
  buildStudentEvaluation,
  EVALUATION_LOW_DATA_MESSAGE,
  evaluationAiCandidates,
  evaluationHasNewData,
  evaluationPracticeHref,
  type EvaluationInput,
} from "@/lib/evaluation";

const base: EvaluationInput = {
  assignments: [
    { id: "a1", title: "Úkol 1", lesson_id: "l1", lesson_source: "textbook_lessons", subjectKey: "id:s1", subjectLabel: "Administrativa" },
    { id: "a2", title: "Úkol 2", lesson_id: "l1", lesson_source: "textbook_lessons", subjectKey: "id:s1", subjectLabel: "Administrativa" },
    { id: "a3", title: "Samostatný úkol", lesson_id: null, subjectKey: "id:s1", subjectLabel: "Administrativa" },
  ],
  lessons: [{ id: "l1", title: "Adresy", subjectKey: "id:s1", subjectLabel: "Administrativa" }],
  attempts: [
    { id: "t1", assignment_id: "a1", status: "submitted", score: 2, max_score: 10, submitted_at: "2026-11-01T10:00:00Z", attempt_number: 1 },
    { id: "t2", assignment_id: "a1", status: "submitted", score: 8, max_score: 10, submitted_at: "2026-11-03T10:00:00Z", attempt_number: 2 },
    { id: "t3", assignment_id: "a1", status: "in_progress", score: 10, max_score: 10, submitted_at: null, attempt_number: 3 },
    { id: "t4", assignment_id: "a2", status: "submitted", score: 6, max_score: 10, submitted_at: "2026-11-04T10:00:00Z", attempt_number: 1 },
    { id: "t5", assignment_id: "a3", status: "submitted", score: 9, max_score: 10, submitted_at: "2026-11-05T10:00:00Z", attempt_number: 1 },
  ],
  activities: [
    { lesson_id: "l1", activity_index: 0, score: 1, max_score: 2, completed_at: "2026-11-02T10:00:00Z" },
    { lesson_id: "l1", activity_index: 0, score: 2, max_score: 2, completed_at: "2026-11-06T10:00:00Z" },
  ],
  practice: [{ lesson_id: "l1", percent: 80, created_at: "2026-11-07T10:00:00Z" }],
  mastery: [{ lesson_id: "l1", mastery_percent: 75, sessions_count: 2, mastered_at: null, updated_at: "2026-11-08T10:00:00Z" }],
};

describe("interní vyhodnocení žáka", () => {
  it("použije nejlepší odevzdaný pokus a ignoruje rozpracovaný", () => {
    const result = buildStudentEvaluation({ ...base, activities: [], practice: [], mastery: [] });
    const lesson = result.topics.find((topic) => topic.key === "lesson:l1")!;
    // a1 = 80 % (ne 100 % z rozpracovaného), a2 = 60 %.
    expect(lesson.successPct).toBe(70);
    expect(lesson.evidenceCount).toBe(2);
    expect(lesson.attemptCount).toBe(3);
  });

  it("zařadí úkol bez lekce pod předmět", () => {
    const result = buildStudentEvaluation(base);
    expect(result.topics.find((topic) => topic.key === "subject:id:s1")).toMatchObject({
      label: "Úkoly bez navázané lekce",
      subjectLabel: "Administrativa",
      successPct: 90,
    });
  });

  it("zahrne nejlepší aktivitu, procvičování i zvládnutí lekce", () => {
    const result = buildStudentEvaluation(base);
    const lesson = result.topics.find((topic) => topic.key === "lesson:l1")!;
    // 2 pokusy + 1 nejlepší aktivita + 1 procvičování + 1 mastery.
    expect(lesson.evidenceCount).toBe(5);
    expect(lesson.masteryPct).toBe(75);
    expect(result.lastDataAt).toBe("2026-11-08T10:00:00Z");
  });

  it("při méně než třech podkladech ukáže přesné upozornění", () => {
    const result = buildStudentEvaluation({ assignments: [], lessons: base.lessons, attempts: [], activities: [], practice: [base.practice[0]], mastery: [] });
    expect(result.lowData).toBe(true);
    expect(result.summary).toContain(EVALUATION_LOW_DATA_MESSAGE);
  });

  it("spočítá zlepšení z časové řady", () => {
    const result = buildStudentEvaluation(base);
    const lesson = result.topics.find((topic) => topic.key === "lesson:l1")!;
    expect(lesson.trend).toBe("improving");
    expect(lesson.trendDelta).toBeGreaterThanOrEqual(5);
  });

  it("AI kandidáty tvoří jen skutečná témata seřazená od nejslabšího", () => {
    const result = buildStudentEvaluation(base);
    const candidates = evaluationAiCandidates(result);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => result.topics.some((topic) => topic.key === candidate.key))).toBe(true);
    expect(candidates[0].successPct!).toBeLessThanOrEqual(candidates.at(-1)!.successPct!);
  });

  it("odkaz na procvičování obsahuje existující lekci a nová data pozná až po datu návrhu", () => {
    const result = buildStudentEvaluation(base);
    const lesson = result.topics.find((topic) => topic.key === "lesson:l1")!;
    expect(evaluationPracticeHref(lesson)).toBe("/student/metody/5p/procviceni?lesson=l1&min=10");
    expect(evaluationHasNewData(result, "2026-11-07T10:00:00Z")).toBe(true);
    expect(evaluationHasNewData(result, "2026-11-09T10:00:00Z")).toBe(false);
  });
});
