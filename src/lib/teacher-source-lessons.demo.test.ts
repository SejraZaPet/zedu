import { describe, it, expect, vi } from "vitest";

const tables: string[] = [];
vi.mock("@/lib/demo-seed-textbooks", () => ({
  isDemoAccount: async () => true,
  textbookOwnerOr: () => "teacher_id.eq.u1",
}));
vi.mock("@/integrations/supabase/client", () => {
  const rows: Record<string, any[]> = {
    teacher_textbooks: [{ id: "b1", title: "Moje", subject: "cestina", teacher_id: "u1", copied_from_textbook_id: null, is_system: false, is_demo_seed: false }],
    teacher_textbook_lessons: [],
    textbook_topics: [{ id: "t1", subject: "cestina", title: "T" }],
    textbook_lessons: [{ id: "g1", title: "Koncept autorky", topic_id: "t1" }],
  };
  const q = (t: string): any => {
    const b: any = { then: (r: any) => r({ data: rows[t] ?? [], error: null }) };
    for (const m of ["select", "or", "is", "order", "range", "in", "eq"]) b[m] = () => b;
    return b;
  };
  return { supabase: { from: (t: string) => { tables.push(t); return q(t); } } };
});

import { loadTeacherSourceLessons } from "./teacher-source-lessons";

describe("demo účet a globální katalog lekcí", () => {
  it("nečte textbook_lessons a nevrací katalogové lekce", async () => {
    const out = await loadTeacherSourceLessons("u1");
    expect(tables).not.toContain("textbook_lessons");
    expect(out.find((l) => l.id === "g1")).toBeUndefined();
  });
});
