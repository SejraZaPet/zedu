import { describe, expect, it } from "vitest";
import { CHEATSHEET_LIMITS, cheatSheetAllowed, duplexIndex, emptyCheatsheet, parseCheatsheet, sideStats, validCheatsheet } from "@/lib/cheatsheet";
import { mergeKindSettings, canSubmitNow } from "@/lib/assignment-kind";
describe("Tahák rules", () => {
  it("uses a 90 × 55 mm card", () => { expect([CHEATSHEET_LIMITS.widthMm, CHEATSHEET_LIMITS.heightMm]).toEqual([90, 55]); });
  it("accepts 220 characters but rejects 221 on either side", () => {
    for (const side of ["front", "back"]) { expect(validCheatsheet({ ...emptyCheatsheet(), [side]: "a".repeat(220) })).toBe(true); expect(validCheatsheet({ ...emptyCheatsheet(), [side]: "a".repeat(221) })).toBe(false); }
  });
  it("accepts eight lines but rejects nine on either side", () => {
    for (const side of ["front", "back"]) { expect(validCheatsheet({ ...emptyCheatsheet(), [side]: Array(8).fill("x").join("\n") })).toBe(true); expect(validCheatsheet({ ...emptyCheatsheet(), [side]: Array(9).fill("x").join("\n") })).toBe(false); }
  });
  it("counts symbols once and normalizes Windows line endings", () => { expect(sideStats("→\r\nΔ")).toEqual({ characters: 3, lines: 2, valid: true }); });
  it("rejects fonts under 7 pt", () => { expect(validCheatsheet({ ...emptyCheatsheet(), fontPt: 6 })).toBe(false); expect(validCheatsheet({ ...emptyCheatsheet(), fontPt: 7 })).toBe(true); });
  it("fits ten cards into A4 usable area", () => { expect(CHEATSHEET_LIMITS.cardsPerPage).toBe(10); expect(2 * 90 + 2 * 15).toBe(210); expect(5 * 55 + 2 * 11).toBe(297); });
  it("mirrors back columns for long-edge duplex", () => { expect(Array.from({ length: 10 }, (_, i) => duplexIndex(i))).toEqual([1,0,3,2,5,4,7,6,9,8]); });
  it("defaults to no permission; only explicit boolean true permits", () => { for (const s of [null, {}, { cheatSheetAllowed: false }, { cheatSheetAllowed: "true" }]) expect(cheatSheetAllowed(s)).toBe(false); expect(cheatSheetAllowed({ cheatSheetAllowed: true })).toBe(true); });
  it("persists the informational choice without changing deadlines or unrelated settings", () => {
    const current = { plan: { id: "test" }, custom: 42 };
    const settings = mergeKindSettings(current, { kind: "task", cheatSheetAllowed: true });
    expect(settings).toEqual({ ...current, cheatSheetAllowed: true });
    expect(canSubmitNow({ deadline: "2026-01-01", settings }, new Date("2026-02-01"))).toBe(false);
    expect(cheatSheetAllowed(mergeKindSettings(settings, { kind: "task", cheatSheetAllowed: false }))).toBe(false);
  });
  it("allows subjects to be combined or omitted", () => { expect(validCheatsheet({ ...emptyCheatsheet(), subject: "Matematika / Fyzika", front: "F = m × a" })).toBe(true); expect(validCheatsheet(emptyCheatsheet())).toBe(true); });
  it("rejects malformed stored data", () => { expect(parseCheatsheet({ version: 1, front: "x" })).toBeNull(); expect(parseCheatsheet(emptyCheatsheet())).toEqual(emptyCheatsheet()); });
});