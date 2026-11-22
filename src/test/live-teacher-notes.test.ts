import { beforeEach, describe, expect, it } from "vitest";
import { loadTeacherNotesCollapsed, patchTeacherNotes, saveTeacherNotesCollapsed, teacherNotesForSlide } from "@/lib/live-teacher-notes";

describe("poznámky řečníka v živé prezentaci", () => {
  beforeEach(() => window.localStorage.clear());

  it("po přeuspořádání cílí podle slideId, ne podle zastaralého indexu", () => {
    const slides = [
      { slideId: "a", teacherNotes: "A", projector: { headline: "První" } },
      { slideId: "b", teacherNotes: "B", projector: { headline: "Druhý" } },
    ];
    const reordered = [slides[1], slides[0]];
    const next = patchTeacherNotes(reordered, { slideId: "a", index: 0 }, "[TEST] Nová poznámka");
    expect(next?.[1]).toMatchObject({ slideId: "a", teacherNotes: "[TEST] Nová poznámka" });
    expect(next?.[0]).toMatchObject({ slideId: "b", teacherNotes: "B", projector: { headline: "Druhý" } });
    expect(reordered[1].teacherNotes).toBe("A");
  });

  it("zachová staré speakerNotes a všechna ostatní data slidu", () => {
    const slide = { slideId: "legacy", speakerNotes: "Původní", projector: { headline: "Výklad" }, blocks: [{ id: "x" }] };
    expect(teacherNotesForSlide(slide)).toBe("Původní");
    const next = patchTeacherNotes([slide], { slideId: "legacy", index: 0 }, "Upraveno");
    expect(next?.[0]).toEqual({ ...slide, teacherNotes: "Upraveno" });
  });

  it("bez ID použije index a neexistující slide odmítne", () => {
    const slides = [{ teacherNotes: "A" }, { teacherNotes: "B" }];
    expect(patchTeacherNotes(slides, { index: 1 }, "")?.[1].teacherNotes).toBe("");
    expect(patchTeacherNotes(slides, { slideId: "chybi", index: 0 }, "X")).toBeNull();
    expect(patchTeacherNotes(slides, { index: 8 }, "X")).toBeNull();
  });

  it("zapamatuje sbalení odděleně pro každého učitele", () => {
    saveTeacherNotesCollapsed("teacher-a", true);
    saveTeacherNotesCollapsed("teacher-b", false);
    expect(loadTeacherNotesCollapsed("teacher-a")).toBe(true);
    expect(loadTeacherNotesCollapsed("teacher-b")).toBe(false);
    expect(loadTeacherNotesCollapsed(undefined)).toBe(false);
  });
});
