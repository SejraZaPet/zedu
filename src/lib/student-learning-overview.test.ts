import { describe, expect, it, vi } from "vitest";
import { buildLearningOverview, daysUntilLocalDay, examDayLabel, examPreparationMinutes, pickExamPreparationTopic, readStoredLearningSubject, resolveLearningSubject, storeLearningSubject } from "@/lib/student-learning-overview";

const groups = [{
  subject: "Přírodopis",
  lessons: [
    { id: "l1", title: "Buňka", textbook: "Přírodopis", subject: "Přírodopis" },
    { id: "l2", title: "Fotosyntéza", textbook: "Přírodopis", subject: "Přírodopis" },
    { id: "l3", title: "Dýchání", textbook: "Přírodopis", subject: "Přírodopis" },
  ],
}];
const now = new Date("2026-11-21T12:00:00");

describe("Učím se – denní cíl a cesta", () => {
  it("denním cílem je jedno dokončené procvičování a další sečte jako hotové", () => {
    const result = buildLearningOverview({ lessonGroups: groups, sessions: [
      { lesson_id: "l1", created_at: "2026-11-21T08:00:00" },
      { lesson_id: "l2", created_at: "2026-11-21T09:00:00" },
      { lesson_id: "l2", created_at: "2026-11-20T09:00:00" },
    ], mastery: [], now });
    expect(result.todaySessions).toBe(2);
    expect(result.dailyGoal).toBe(1);
    expect(result.missions[0]).toMatchObject({ state: "done", title: "Dnešní procvičování je hotové" });
  });

  it("použije poslední lekci a jako bonus nejslabší rozpracované téma", () => {
    const result = buildLearningOverview({ lessonGroups: groups, sessions: [
      { lesson_id: "l2", created_at: "2026-11-20T09:00:00" },
    ], mastery: [
      { lesson_id: "l1", mastery_percent: 35, sessions_count: 2, mastered_at: null },
      { lesson_id: "l2", mastery_percent: 60, sessions_count: 1, mastered_at: null },
    ], now });
    expect(result.lastLesson?.id).toBe("l2");
    expect(result.weakLesson?.id).toBe("l1");
    expect(result.missions[2]).toMatchObject({ state: "bonus", lessonId: "l1" });
    expect(result.missions.every((mission) => !("xp" in mission))).toBe(true);
  });

  it("cesta rozliší zvládnuté podle mastered_at, aktuální a teprve čekající", () => {
    const result = buildLearningOverview({ lessonGroups: groups, sessions: [
      { lesson_id: "l2", created_at: "2026-11-20T09:00:00" },
    ], mastery: [
      { lesson_id: "l1", mastery_percent: 100, sessions_count: 2, mastered_at: "2026-11-20T10:00:00" },
      { lesson_id: "l2", mastery_percent: 60, sessions_count: 1, mastered_at: null },
    ], now });
    expect(result.masteredCount).toBe(1);
    expect(result.currentTopicId).toBe("l2");
    expect(result.topics.map((topic) => [topic.id, topic.mastered, topic.id === result.currentTopicId])).toEqual([
      ["l1", true, false], ["l2", false, true], ["l3", false, false],
    ]);
  });

  it("bez lekce nabídne vlastní materiál místo vymyšleného kvízu", () => {
    const result = buildLearningOverview({ lessonGroups: [], sessions: [], mastery: [], now });
    expect(result.missions).toHaveLength(2);
    expect(result.missions[1]).toMatchObject({ action: "material", state: "bonus" });
    expect(result.activeSubject).toBeNull();
  });

  it("příprava na navázaný test začne nejslabší lekcí a délka se řídí termínem", () => {
    const result = buildLearningOverview({
      lessonGroups: groups,
      sessions: [{ lesson_id: "l2", created_at: "2026-11-20T09:00:00" }],
      mastery: [
        { lesson_id: "l1", mastery_percent: 25, sessions_count: 2, mastered_at: null },
        { lesson_id: "l2", mastery_percent: 70, sessions_count: 1, mastered_at: null },
      ],
      nextExam: { id: "exam", title: "Test", deadline: "2026-11-24T08:00:00", lessonIds: ["l1", "l2"] },
      now,
    });
    expect(pickExamPreparationTopic(result.topics, result.nextExam!.lessonIds)?.id).toBe("l1");
    expect(examPreparationMinutes(0)).toBe(20);
    expect(examPreparationMinutes(3)).toBe(15);
    expect(examPreparationMinutes(8)).toBe(10);
  });

  it("uložený předmět platí jen když stále existuje, jinak se použije poslední", () => {
    expect(resolveLearningSubject(["Matematika", "Fyzika"], "Fyzika", "Matematika")).toBe("Matematika");
    expect(resolveLearningSubject(["Matematika", "Fyzika"], "Fyzika", "Odstraněný")).toBe("Fyzika");
    expect(resolveLearningSubject(["Matematika"], null, null)).toBe("Matematika");
  });

  it("nedostupné úložiště nezabrání použití výchozího předmětu", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readStoredLearningSubject("student-1")).toBeNull();
    expect(() => storeLearningSubject("student-1", "Matematika")).not.toThrow();
    vi.restoreAllMocks();
  });

  it("počítá test podle kalendářních dnů a používá české popisky", () => {
    expect(daysUntilLocalDay("2026-11-24T08:00:00", now)).toBe(3);
    expect(examDayLabel(0)).toBe("Test je dnes");
    expect(examDayLabel(1)).toBe("Test je zítra");
    expect(examDayLabel(3)).toBe("Test za 3 dny");
  });
});
