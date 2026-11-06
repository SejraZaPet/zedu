import { describe, it, expect } from "vitest";
import { filterByKind, sectionFromParam } from "./assignment-kind";

const items = [
  { id: "t", settings: {} },
  { id: "m", settings: { kind: "material" } },
  { id: "a1", settings: { kind: "announcement" } },
  { id: "a2", settings: { kind: "announcement", pinned: true } },
  { id: "old", settings: { kind: "announcement", visibleUntil: "2020-01-01T00:00:00Z" } },
];
describe("pod-záložky Úkoly/Materiály/Oznámení", () => {
  it("úkol bez kind patří do Úkolů", () => expect(filterByKind(items, "task").map((i) => i.id)).toEqual(["t"]));
  it("materiály zvlášť", () => expect(filterByKind(items, "material").map((i) => i.id)).toEqual(["m"]));
  it("žák: připnuté oznámení první, prošlé skryté", () =>
    expect(filterByKind(items, "announcement", { now: new Date("2026-11-06") }).map((i) => i.id)).toEqual(["a2", "a1"]));
  it("učitel vidí i prošlé oznámení", () => expect(filterByKind(items, "announcement", { teacher: true })).toHaveLength(3));
  it("neplatná sekce v URL = null", () => {
    expect(sectionFromParam("oznameni")).toBe("oznameni");
    expect(sectionFromParam("xyz")).toBeNull();
  });
});
