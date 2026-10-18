import { describe, it, expect } from "vitest";
import { countHiddenLessonUnits } from "@/lib/lesson-plan-units";

describe("countHiddenLessonUnits", () => {
  it("counts hidden headings at top level and inside groups", () => {
    const blocks = [
      { type: "heading", visible: true },
      { type: "slide_group", props: { blocks: [{ type: "heading", visible: false }, { type: "paragraph" }] } },
      { type: "heading", visible: false },
    ];
    expect(countHiddenLessonUnits(blocks)).toBe(2);
  });
  it("headings inside a hidden group count as hidden", () => {
    expect(countHiddenLessonUnits([{ type: "slide_group", visible: false, props: { blocks: [{ type: "heading" }] } }])).toBe(1);
  });
  it("no hidden headings gives 0", () => {
    expect(countHiddenLessonUnits([{ type: "heading" }])).toBe(0);
  });
});
