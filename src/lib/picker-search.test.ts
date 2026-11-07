import { describe, it, expect } from "vitest";
import { matchesSearch, needsSearch, selectFound } from "./picker-search";
describe("shared picker rules", () => {
  it("ignores accents and case", () => expect(matchesSearch("CESTINA", "Čeština")).toBe(true));
  it("requires every word across title and subtitle", () => {
    expect(matchesSearch("zlomky p2", "Zlomky", "Matematika P2.A")).toBe(true);
    expect(matchesSearch("zlomky h2", "Zlomky", "Matematika P2.A")).toBe(false);
  });
  it("searches dates", () => expect(matchesSearch("14. 11.", "Plán", "14. 11. 2026")).toBe(true));
  it("starts at eight, growing lists always", () => {
    expect(needsSearch(7)).toBe(false); expect(needsSearch(8)).toBe(true); expect(needsSearch(0, true)).toBe(true);
  });
  it("preserves hidden selections when selecting found", () => expect(selectFound(["hidden", "a"], ["a", "b"])).toEqual(["hidden", "a", "b"]));
});