import { describe, expect, it } from "vitest";
import { averageBestAttempts, czechDays } from "@/lib/student-dashboard-summary";

const row = (assignment_id: string, score: number, max_score: number, attempt_number: number) => ({
  assignment_id, score, max_score, attempt_number, status: "submitted", submitted_at: `2026-11-${10 + attempt_number}T10:00:00Z`,
});

describe("souhrn žákovského přehledu", () => {
  it("počítá třicetidenní průměr z nejlepšího pokusu za každou úlohu", () => {
    expect(averageBestAttempts([
      row("a", 4, 10, 1),
      row("a", 8, 10, 2),
      row("b", 5, 10, 1),
      { ...row("ignored", 10, 10, 1), status: "in_progress" },
    ])).toBe(65);
    expect(averageBestAttempts([])).toBeNull();
  });

  it("používá správné české tvary dnů", () => {
    expect(czechDays(1)).toBe("1 den");
    expect(czechDays(4)).toBe("4 dny");
    expect(czechDays(7)).toBe("7 dní");
  });
});
