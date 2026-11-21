import { describe, it, expect } from "vitest";
import { filterPresentations, DEFAULT_PRESENTATION_FILTERS as D, NO_SUBJECT } from "./presentation-filters";

const now = new Date("2026-11-21T12:00:00Z").getTime();
const items = [
  { title: "Vesmír", lesson_id: "l1", created_at: "2026-01-01", updated_at: "2026-11-21T10:00:00Z", subject: "Fyzika" },
  { title: "Antika", lesson_id: null, created_at: "2026-02-01", updated_at: "2026-09-01T00:00:00Z", subject: null },
];

describe("filterPresentations", () => {
  it("zdroj z lekce/vlastní", () => {
    expect(filterPresentations(items, { ...D, source: "lesson" }, now).map((p) => p.title)).toEqual(["Vesmír"]);
    expect(filterPresentations(items, { ...D, source: "own" }, now).map((p) => p.title)).toEqual(["Antika"]);
  });
  it("bez předmětu", () => {
    expect(filterPresentations(items, { ...D, subject: NO_SUBJECT }, now).map((p) => p.title)).toEqual(["Antika"]);
  });
  it("starší než 30 dní a hledání", () => {
    expect(filterPresentations(items, { ...D, updated: "older" }, now).map((p) => p.title)).toEqual(["Antika"]);
    expect(filterPresentations(items, { ...D, q: "vesm" }, now).map((p) => p.title)).toEqual(["Vesmír"]);
  });
  it("řazení podle názvu", () => {
    expect(filterPresentations(items, { ...D, sort: "title" }, now).map((p) => p.title)).toEqual(["Antika", "Vesmír"]);
  });
});
