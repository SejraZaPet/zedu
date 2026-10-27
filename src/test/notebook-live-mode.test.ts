import { describe, it, expect } from "vitest";
import { isLiveWorksheetPage } from "@/lib/notebook";
describe("live worksheet page mode", () => {
  it("treats live and legacy digital as live pages", () => {
    expect(isLiveWorksheetPage({ worksheet: { worksheetId: "w", mode: "live", title: "t" } })).toBe(true);
    expect(isLiveWorksheetPage({ worksheet: { worksheetId: "w", mode: "digital", title: "t" } })).toBe(true);
  });
  it("keeps pen and plain pages on the canvas", () => {
    expect(isLiveWorksheetPage({ worksheet: { worksheetId: "w", mode: "pen", title: "t" } })).toBe(false);
    expect(isLiveWorksheetPage({})).toBe(false);
  });
});
