import { describe, it, expect } from "vitest";
import { PointerGate, finalizeTapPoints, normalizePoint } from "@/lib/notebook-pointer";
import { countsTowardProgress, pointsBadgeLabel, progressItems } from "@/lib/worksheet-progress";

const box = { left: 100, top: 50, borderLeft: 1, borderTop: 1, innerWidth: 800, innerHeight: 1131 };

describe("souřadnice tahu v sešitě", () => {
  it("počítá vůči vnitřní ploše bez rámečku", () => {
    expect(normalizePoint(101, 51, box)).toEqual([0, 0]);
    expect(normalizePoint(501, 51 + 1131 / 2, box)).toEqual([0.5, 0.5]);
    expect(normalizePoint(901, 1182, box)).toEqual([1, 1]);
  });
  it("mimo plochu se ořízne na okraj", () => {
    expect(normalizePoint(0, 5000, box)).toEqual([0, 1]);
  });
});

describe("jeden aktivní ukazatel", () => {
  it("druhý prst během tahu nezačne ani neposune tah", () => {
    const g = new PointerGate();
    expect(g.begin(1, "touch")).toBe(true);
    expect(g.begin(2, "touch")).toBe(false);
    expect(g.accepts(2)).toBe(false);
    expect(g.end(2)).toBe(false);
    expect(g.accepts(1)).toBe(true);
  });
  it("během tahu perem se dotyk dlaně ignoruje", () => {
    const g = new PointerGate();
    g.begin(7, "pen");
    expect(g.penActive).toBe(true);
    expect(g.begin(8, "touch")).toBe(false);
  });
  it("pointercancel / konec uvolní ukazatel pro další tah", () => {
    const g = new PointerGate();
    g.begin(1, "pen");
    expect(g.end(1)).toBe(true);
    expect(g.begin(3, "touch")).toBe(true);
    g.reset();
    expect(g.active).toBeNull();
  });
  it("ťuknutí perem uloží tečku, ťuknutí prstem nic", () => {
    expect(finalizeTapPoints([[0.2, 0.3]], "pen")).toEqual([[0.2, 0.3], [0.2, 0.3]]);
    expect(finalizeTapPoints([[0.2, 0.3]], "touch")).toBeNull();
  });
});

describe("přehrávač listu: body a Vyplněno", () => {
  const it0 = (type: string, points: number) => ({ id: type + points, type, points } as any);
  it("nulové body se nezobrazí, jinak správný tvar slova", () => {
    expect(pointsBadgeLabel(0)).toBeNull();
    expect(pointsBadgeLabel(1)).toBe("1 bod");
    expect(pointsBadgeLabel(3)).toBe("3 body");
    expect(pointsBadgeLabel(5)).toBe("5 bodů");
  });
  it("psací bloky bez bodů se do Vyplněno nepočítají", () => {
    const items = [it0("mcq", 1), it0("write_lines", 0), it0("blank_box", 0), it0("open_answer", 0), it0("write_lines", 2)];
    expect(items.filter(countsTowardProgress).map((i) => i.id)).toEqual(["mcq1", "open_answer0", "write_lines2"]);
  });
  it("když jsou všechny položky jen psací bloky, počítají se všechny", () => {
    const items = [it0("write_lines", 0), it0("blank_box", 0)];
    expect(progressItems(items)).toHaveLength(2);
  });
});
