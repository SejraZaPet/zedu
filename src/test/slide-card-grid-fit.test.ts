import { describe, it, expect } from "vitest";
import { fitCardGrid } from "@/lib/slide-card-grid-fit";

const card = (n = 3) => ({ title: "JÁTRA", mode: "bullets", items: Array(n).fill("krátká položka") });

describe("fitCardGrid", () => {
  it("one card gets the largest text", () => {
    expect(fitCardGrid([card()]).bodyRem).toBeGreaterThan(fitCardGrid([card(), card()]).bodyRem);
  });
  it("two cards sit side by side in one row filling the height", () => {
    const f = fitCardGrid([card(), card()]);
    expect(f).toMatchObject({ columns: 2, rows: 1, cardMinHeight: 640 });
  });
  it("text never drops below projector-readable 1.75rem", () => {
    const long = { title: "X", text: "a".repeat(800) };
    expect(fitCardGrid(Array(6).fill(long)).bodyRem).toBeGreaterThanOrEqual(1.75);
  });
  it("four cards use two rows of two", () => {
    expect(fitCardGrid(Array(4).fill(card()))).toMatchObject({ columns: 2, rows: 2 });
  });
});
