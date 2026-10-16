import { describe, it, expect } from "vitest";
import { filterByTitle, foldText, togglePicked } from "@/lib/lesson-picker-search";
const items = [{ id: "1", title: "Potraviny" }, { id: "2", title: "Poživatiny a výživa" }, { id: "3", title: "Nápoje" }];
describe("lesson picker search", () => {
  it("ignoruje diakritiku a velikost", () => {
    expect(filterByTitle(items, "potraviny").map((i) => i.id)).toEqual(["1"]);
    expect(filterByTitle(items, "VYZIVA").map((i) => i.id)).toEqual(["2"]);
    expect(filterByTitle(items, "napoje").map((i) => i.id)).toEqual(["3"]);
  });
  it("prázdný dotaz vrací vše, nic nenalezeno = []", () => {
    expect(filterByTitle(items, "  ")).toHaveLength(3);
    expect(filterByTitle(items, "xyz")).toEqual([]);
    expect(foldText("Žluťoučký")).toBe("zlutoucky");
  });
  it("výběr přetrvá nezávisle na filtru", () => {
    let p = togglePicked([], "1", true);
    p = togglePicked(p, "3", true);
    p = togglePicked(p, "3", true);
    expect(p).toEqual(["1", "3"]);
    expect(togglePicked(p, "1", false)).toEqual(["3"]);
  });
});
