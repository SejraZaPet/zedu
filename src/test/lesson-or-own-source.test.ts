import { describe, expect, it } from "vitest";
import { combineLessonAndOwn, scannedPdfItems, OWN_MATERIAL_HEADING } from "@/lib/lesson-or-own-source";

const ok = { ok: true, message: null };
describe("combineLessonAndOwn", () => {
  it("own material is labelled for AI as Materiál učitele", () => {
    const r = combineLessonAndOwn({ mode: "own", lessonText: "lekce", ownText: "Fotosyntéza", ownState: ok, limit: 1000 });
    expect(r.text).toBe(`## ${OWN_MATERIAL_HEADING}\nFotosyntéza`);
    expect(r.text).not.toContain("lekce");
    expect(r.ok).toBe(true);
  });
  it("both merges lesson first, then teacher material", () => {
    const r = combineLessonAndOwn({ mode: "both", lessonText: "L", ownText: "M", ownState: ok, limit: 1000 });
    expect(r.text).toBe("## Text lekce\nL\n\n## Materiál učitele\nM");
  });
  it("lesson mode keeps the lesson text unchanged", () => {
    expect(combineLessonAndOwn({ mode: "lesson", lessonText: "L", ownText: "M", limit: 10 }).text).toBe("L");
  });
  it("over limit warns and blocks without truncating", () => {
    const r = combineLessonAndOwn({ mode: "own", lessonText: "", ownText: "x".repeat(200), ownState: ok, limit: 100 });
    expect(r.ok).toBe(false);
    expect(r.overBy).toBe(r.chars - 100);
    expect(r.text.length).toBe(r.chars);
    expect(r.chars).toBeGreaterThan(200);
  });
  it("empty own source is rejected", () => {
    const r = combineLessonAndOwn({ mode: "own", lessonText: "L", ownText: "  ", ownState: ok, limit: 100 });
    expect(r.ok).toBe(false);
  });
  it("empty lesson in both mode is rejected", () => {
    expect(combineLessonAndOwn({ mode: "both", lessonText: "", ownText: "M", ownState: ok, limit: 100 }).ok).toBe(false);
  });
  it("bundle problems (loading/limits) block generation", () => {
    const r = combineLessonAndOwn({ mode: "own", lessonText: "", ownText: "M", ownState: { ok: false, message: "Zdroje se ještě načítají…" }, limit: 100 });
    expect(r.message).toBe("Zdroje se ještě načítají…");
  });
});
describe("scannedPdfItems", () => {
  it("flags ready PDFs with almost no text", () => {
    expect(scannedPdfItems([
      { id: "a", kind: "pdf", status: "ready", text: "  " },
      { id: "b", kind: "pdf", status: "ready", text: "x".repeat(400) },
      { id: "c", kind: "docx", status: "ready", text: "" },
    ])).toEqual(["a"]);
  });
});
