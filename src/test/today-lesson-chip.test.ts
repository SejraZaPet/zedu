// @vitest-environment node
import { describe, it, expect } from "vitest";
import { subjectAbbreviation, subjectChipColor, fallbackSubjectColor, compactTimeRange, lessonPhaseLabel } from "@/lib/today-lesson-chip";

describe("today lesson chip", () => {
  it("uses existing abbreviation", () => expect(subjectAbbreviation("ČJ", "Český jazyk")).toBe("ČJ"));
  it("falls back to first 3 letters uppercased", () => expect(subjectAbbreviation(null, "světová literatura")).toBe("SVĚ"));
  it("uses subject color, else stable fallback", () => {
    expect(subjectChipColor("#123456", "X")).toBe("#123456");
    expect(subjectChipColor(null, "Dějepis")).toBe(fallbackSubjectColor("Dějepis"));
    expect(fallbackSubjectColor("Dějepis")).toBe(fallbackSubjectColor("Dějepis"));
  });
  it("formats time without spaces", () =>
    expect(compactTimeRange(new Date(2026, 10, 23, 10, 40), new Date(2026, 10, 23, 11, 25))).toBe("10:40–11:25"));
  it("labels phases", () => {
    expect(lessonPhaseLabel("past")).toBe("hotovo");
    expect(lessonPhaseLabel("current")).toBe("právě teď");
    expect(lessonPhaseLabel("future")).toBeNull();
  });
});
