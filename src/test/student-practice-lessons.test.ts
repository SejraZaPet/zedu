import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { groupPracticeLessons, practiceSubjectLabel } from "@/lib/student-practice-lessons";
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
  it("chybějící label nahradí schváleným názvem ze slugu a Ostatní nechá jen bez slugu", () => {
    const expected = {
      administrativa: "Administrativa",
      informacni_a_komunikacni_technologie: "Informační a komunikační technologie",
      maturitni_otazky: "Maturitní otázky",
      ekonomika: "Ekonomika",
      zaklady_prava: "Základy práva",
      predmet_na_zkousku: "Předmět na zkoušku",
      stolniceni: "Stolničení",
    };
    for (const [slug, label] of Object.entries(expected)) {
      expect(practiceSubjectLabel(slug)).toBe(label);
    }
    expect(practiceSubjectLabel("administrativa", "Katalogový název")).toBe("Katalogový název");
    expect(practiceSubjectLabel("novy_obor_bez_diakritiky")).toBe("Novy obor bez diakritiky");
    expect(practiceSubjectLabel(null)).toBe("Ostatní");
    expect(practiceSubjectLabel("  ")).toBe("Ostatní");

    const grouped = groupPracticeLessons([
      { id: "a1", title: "Adresy – úvod", status: "published", textbook: "Administrativa", subject: practiceSubjectLabel("administrativa") },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].subject).toBe("Administrativa");
    expect(grouped[0].lessons[0].subject).toBe("Administrativa");
  });
  it("koncept se nenabídne a duplicity se sloučí", () => {
    const groups = groupPracticeLessons([
      { id: "a", title: "A", status: "draft", textbook: "X", subject: "Fyzika" },
      { id: "b", title: "B", status: "published", textbook: "X", subject: "Fyzika" },
      { id: "b", title: "B", status: "published", textbook: "X", subject: "Fyzika" },
    ]);
    expect(groups[0].lessons.map((l) => l.id)).toEqual(["b"]);
  });
  it("cesta použije pořadí učebnice a témat, chybějící pořadí nechá abecedně", () => {
    const ordered = groupPracticeLessons([
      { id: "a", title: "Alfa", status: "published", textbook: "Učebnice", subject: "Předmět", sortOrder: 20 },
      { id: "b", title: "Beta", status: "published", textbook: "Učebnice", subject: "Předmět", sortOrder: 10 },
      { id: "c", title: "Cela", status: "published", textbook: "Učebnice", subject: "Předmět" },
    ]);
    expect(ordered[0].lessons.map((lesson) => lesson.id)).toEqual(["b", "a", "c"]);

    const topics = groupPracticeLessons([
      { id: "pozde", title: "A", status: "published", textbook: "Předmět", subject: "Předmět", topicId: "t2", topicSortOrder: 20, sortOrder: 1 },
      { id: "brzy", title: "Z", status: "published", textbook: "Předmět", subject: "Předmět", topicId: "t1", topicSortOrder: 10, sortOrder: 1 },
    ]);
    expect(topics[0].lessons.map((lesson) => lesson.id)).toEqual(["brzy", "pozde"]);
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
