import { describe, it, expect } from "vitest";
import { nextLessonWorksheetTitle, sortLessonWorksheets } from "@/lib/lesson-worksheets";

describe("multiple worksheets per lesson", () => {
  it("first worksheet has no number", () => {
    expect(nextLessonWorksheetTitle("Maso", 0)).toBe("Pracovní list – Maso");
  });
  it("second worksheet is numbered 2", () => {
    expect(nextLessonWorksheetTitle("Maso", 1)).toBe("Pracovní list 2 – Maso");
  });
  it("sorts newest first and uses id for equal dates", () => {
    const r = sortLessonWorksheets([
      { id: "b", created_at: "2026-02-01" },
      { id: "a", created_at: "2026-01-01" },
      { id: "c", created_at: "2026-02-01" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
