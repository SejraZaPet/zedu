import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { groupPracticeLessons } from "@/lib/student-practice-lessons";
import { questionCountForDuration } from "@/lib/study-method-info";
import { loadPracticeLesson, clampQuestionCount } from "../../supabase/functions/_shared/practice-lesson";

const client = (tables: Record<string, any[]>) => ({
  from: (t: string) => ({
    select: () => ({
      eq: (_c: string, id: string) => ({
        maybeSingle: async () => ({ data: (tables[t] ?? []).find((r) => r.id === id) ?? null }),
      }),
    }),
  }),
});

describe("Učím se – výběr lekcí", () => {
  it("žák vidí lekce všech předmětů (učitelské přes class_subjects i globální)", () => {
    const groups = groupPracticeLessons([
      { id: "t1", title: "Pohyb", status: "published", textbook: "Fyzika 7", subject: "Fyzika" },
      { id: "t2", title: "Maso", status: "published", textbook: "Výživa a potraviny", subject: "Nauka o výživě" },
      { id: "g1", title: "Zlomky", status: "published", textbook: "Matematika", subject: "Matematika" },
    ]);
    expect(groups.map((g) => g.subject)).toEqual(["Fyzika", "Matematika", "Nauka o výživě"]);
  });
  it("koncept se nenabídne a duplicity se sloučí", () => {
    const groups = groupPracticeLessons([
      { id: "a", title: "A", status: "draft", textbook: "X", subject: "Fyzika" },
      { id: "b", title: "B", status: "published", textbook: "X", subject: "Fyzika" },
      { id: "b", title: "B", status: "published", textbook: "X", subject: "Fyzika" },
    ]);
    expect(groups[0].lessons.map((l) => l.id)).toEqual(["b"]);
  });
  it("délka určuje počet otázek", () => {
    expect([5, 10, 15].map(questionCountForDuration)).toEqual([4, 8, 12]);
    expect(clampQuestionCount(undefined, 6)).toBe(6);
  });
});

describe("Generátor – načtení lekce", () => {
  const admin = client({
    textbook_lessons: [{ id: "g1", title: "Globální", blocks: [] }],
    teacher_textbook_lessons: [{ id: "t1", title: "Učitelská", blocks: [] }, { id: "foreign", title: "Cizí", blocks: [] }],
  });
  const student = client({
    textbook_lessons: [{ id: "g1", title: "Globální", blocks: [] }],
    teacher_textbook_lessons: [{ id: "t1", title: "Učitelská", blocks: [] }],
  });
  it("globální i učitelská lekce se načtou", async () => {
    const g = await loadPracticeLesson(student, admin, "g1");
    const t = await loadPracticeLesson(student, admin, "t1");
    expect(g.ok && g.lesson.source).toBe("textbook_lessons");
    expect(t.ok && t.lesson.source).toBe("teacher_textbook_lessons");
  });
  it("cizí lekce se odmítne, neexistující vrátí 404", async () => {
    expect(await loadPracticeLesson(student, admin, "foreign")).toMatchObject({ ok: false, status: 403 });
    expect(await loadPracticeLesson(student, admin, "nope")).toMatchObject({ ok: false, status: 404 });
  });
});
