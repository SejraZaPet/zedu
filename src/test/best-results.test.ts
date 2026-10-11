import { describe, expect, it } from "vitest";
import { bestActivityResults, bestAttempt, firstActivityResult, firstAttempt } from "@/lib/best-results";
import { splitStrengthsWeaknesses, summarizePerformance } from "@/lib/strengths-weaknesses";

describe("best results", () => {
  const older = "2026-01-01T10:00:00Z";
  const newer = "2026-01-02T10:00:00Z";
  it("vybere nejlepší poměr a při shodě novější aktivitu bez závislosti na pořadí", () => {
    const rows = [
      { activity_index: 1, score: 8, max_score: 10, completed_at: older, id: "old" },
      { activity_index: 1, score: 4, max_score: 5, completed_at: newer, id: "new" },
      { activity_index: 2, score: 2, max_score: 10, completed_at: newer, id: "only" },
    ];
    expect(bestActivityResults(rows).get(1)?.id).toBe("new");
    expect(bestActivityResults([...rows].reverse()).get(1)?.id).toBe("new");
    expect(bestActivityResults([rows[2]]).get(2)?.id).toBe("only");
    expect(bestActivityResults([]).size).toBe(0);
  });

  it("vybere nejlepší odevzdaný pokus a ignoruje koncept", () => {
    const attempts = [
      { status: "submitted", score: 7, max_score: 10, submitted_at: older, attempt_number: 1, id: "first" },
      { status: "submitted", score: 14, max_score: 20, submitted_at: newer, attempt_number: 2, id: "tie-new" },
      { status: "in_progress", score: 10, max_score: 10, submitted_at: newer, attempt_number: 3, id: "draft" },
    ];
    expect(bestAttempt(attempts)?.id).toBe("tie-new");
    expect(bestAttempt([])).toBeNull();
    expect(firstAttempt(attempts)?.id).toBe("first");
  });

  it("určí první aktivitu podle času", () => {
    expect(firstActivityResult([
      { activity_index: 1, score: 9, max_score: 10, completed_at: newer },
      { activity_index: 1, score: 3, max_score: 10, completed_at: older },
    ])?.score).toBe(3);
  });
});

describe("strengths and weaknesses", () => {
  const row = (key: string, ratios: number[][]) => summarizePerformance(
    { key, label: key },
    ratios.map((values, learner) => ({ learnerId: String(learner), learnerName: `Žák ${learner + 1}`, attempts: values.map((correctRatio, order) => ({ correctRatio, order: order + 1 })) })),
  );

  it("počítá první, nejlepší výsledek, opakování a neúspěšné", () => {
    const result = row("A", [[0.2, 0.8], [0.4], [1, 1]]);
    expect(result.firstPct).toBe(53);
    expect(result.bestPct).toBe(73);
    expect(result.repeaters).toBe(2);
    expect(result.averageAttempts).toBe(1.7);
    expect(result.failedLearners).toEqual(["Žák 2"]);
  });

  it("řadí silné sestupně a slabé vzestupně s opakováním jako druhým klíčem", () => {
    const split = splitStrengthsWeaknesses([
      row("strong-low", [[0.8], [0.8]]), row("strong-high", [[1], [0.9]]),
      row("weak-high", [[0.4], [0.4]]), row("weak-low", [[0.1, 0.2], [0.2]]),
    ]);
    expect(split.strong.map((item) => item.key)).toEqual(["strong-high", "strong-low"]);
    expect(split.weak.map((item) => item.key)).toEqual(["weak-low", "weak-high"]);
  });
});