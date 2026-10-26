import { describe, it, expect, vi } from "vitest";
import { farEnough, isEditableTarget, loadPenPrefs, savePenPrefs, shouldDrawPointer, smoothPressure } from "@/lib/notebook-pointer";
import { renderStroke } from "@/lib/notebook";

function fakeCtx() {
  const calls: string[] = [];
  const ctx: any = new Proxy({}, { get: (t: any, k: string) => k in t ? t[k] : (typeof k === "string" ? (...a: unknown[]) => { calls.push(k); } : undefined), set: (t: any, k, v) => { t[k] = v; return true; } });
  return { ctx, calls };
}

describe("pero v sešitě", () => {
  it("v režimu Jen pero dotyk nekreslí, pero a myš ano", () => {
    expect(shouldDrawPointer("touch", true)).toBe(false);
    expect(shouldDrawPointer("pen", true)).toBe(true);
    expect(shouldDrawPointer("mouse", true)).toBe(true);
    expect(shouldDrawPointer("touch", false)).toBe(true);
  });
  it("textová pole si výběr ponechají", () => {
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    const d = document.createElement("div"); d.setAttribute("contenteditable", "true");
    const inner = document.createElement("span"); d.appendChild(inner);
    expect(isEditableTarget(inner)).toBe(true);
    expect(isEditableTarget(document.createElement("canvas"))).toBe(false);
  });
  it("blízké body se neukládají", () => {
    expect(farEnough([0.5, 0.5], [0.5001, 0.5], 800, 1100, 0.6)).toBe(false);
    expect(farEnough([0.5, 0.5], [0.51, 0.5], 800, 1100, 0.6)).toBe(true);
    expect(farEnough(undefined, [0, 0], 800, 1100, 0.6)).toBe(true);
  });
  it("tlak se vyhlazuje", () => {
    expect(smoothPressure(undefined, 0.8, 0.5)).toBe(0.8);
    expect(smoothPressure(0.2, 1, 0.5)).toBeCloseTo(0.6);
  });
  it("tah se kreslí křivkou, i starý tah bez tlaku", () => {
    const { ctx, calls } = fakeCtx();
    renderStroke(ctx, { id: "s", tool: "pen", color: "#000", width: 3, points: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] } as any, 800, 1100);
    expect(calls).toContain("quadraticCurveTo");
    const b = fakeCtx();
    renderStroke(b.ctx, { id: "s", tool: "pen", color: "#000", width: 3, points: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]], pressures: [0.2, 0.6, 1] } as any, 800, 1100);
    expect(b.calls.filter(c => c === "quadraticCurveTo").length).toBe(2);
  });
  it("nastavení pera se pamatuje a nedostupné úložiště nespadne", () => {
    savePenPrefs({ penOnly: true, smoothing: "strong" });
    expect(loadPenPrefs()).toEqual({ penOnly: true, smoothing: "strong", penSeen: false });
    const broken = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } } as unknown as Storage;
    expect(loadPenPrefs(broken)).toEqual({ penOnly: false, smoothing: "medium", penSeen: false });
    expect(() => savePenPrefs({ penOnly: false, smoothing: "fine" }, broken)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("zapamatování pera", () => {
  it("penSeen se uloží a načte", () => {
    savePenPrefs({ penOnly: true, smoothing: "medium", penSeen: true });
    expect(loadPenPrefs().penSeen).toBe(true);
  });
});

describe("zvýrazňovač", () => {
  it("jeden tah zvýrazňovače = jedno stroke() i s tlakem, konstantní šířka", () => {
    const { ctx, calls } = fakeCtx();
    const points: [number, number][] = Array.from({ length: 30 }, (_, i) => [0.1 + i * 0.01, 0.5 + (i % 3) * 0.002]);
    renderStroke(ctx, { tool: "highlight", color: "#9B6CFF", width: 4, points, pressures: points.map((_, i) => (i % 5) / 5) } as any, 800, 1100);
    expect(calls.filter((c) => c === "stroke").length).toBe(1);
    expect(ctx.globalAlpha).toBe(0.35);
  });
  it("běžné pero s tlakem dál mění šířku po úsecích", () => {
    const { ctx, calls } = fakeCtx();
    const points: [number, number][] = Array.from({ length: 10 }, (_, i) => [0.1 + i * 0.01, 0.5]);
    renderStroke(ctx, { tool: "pen", color: "#000", width: 2, points, pressures: points.map(() => 0.5) } as any, 800, 1100);
    expect(calls.filter((c) => c === "stroke").length).toBe(9);
  });
});
