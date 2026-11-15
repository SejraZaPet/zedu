import { describe, expect, it } from "vitest";
import { practiceTargetDifficulty, recentPracticePercents } from "../../supabase/functions/_shared/practice-phases";

describe("izolace obtížnosti procvičování", () => {
  it("výsledky jiného žáka neovlivní obtížnost", () => {
    const rows = [
      { student_id: "jiný-žák", answers_json: { percent: 0 } },
      { student_id: "jiný-žák", answers_json: { percent: 0 } },
      { student_id: "žák", answers_json: { percent: 100 } },
      { student_id: "jiný-žák", answers_json: { percent: 0 } },
    ];

    const ownPercents = recentPracticePercents(rows, "žák");
    expect(ownPercents).toEqual([100]);
    expect(practiceTargetDifficulty(1, ownPercents)).toBe("medium");
    // Kdyby cizí nuly pronikly do průměru, výsledek by bylo „easy“.
    expect(practiceTargetDifficulty(1, [0, 0, 100, 0])).toBe("easy");
  });

  it("bez vlastní historie zůstane výchozí střední obtížnost", () => {
    const rows = [{ student_id: "jiný-žák", answers_json: { percent: 100 } }];
    expect(recentPracticePercents(rows, "žák")).toEqual([]);
    expect(practiceTargetDifficulty(1, [])).toBe("medium");
  });
});
