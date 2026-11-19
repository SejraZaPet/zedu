import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, fail: "" as string, demo: false }));
vi.mock("@/lib/demo-seed-textbooks", () => ({
  isDemoAccount: async () => db.demo,
  textbookOwnerOr: (uid: string, demo: boolean) => (demo ? `teacher_id.eq.${uid},is_demo_seed.eq.true` : `teacher_id.eq.${uid}`),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const filters: ((r: any) => boolean)[] = [];
  const chain: any = {
    select: () => chain, order: () => chain,
    // RLS-like owner filter as the client sends it
    or: (f: string) => { const parts = f.split(","); filters.push(r => parts.some(p => p === `teacher_id.eq.${r.teacher_id}` || (p === "is_demo_seed.eq.true" && r.is_demo_seed))); return chain; },
    is: (c: string) => { filters.push(r => r[c] == null); return chain; },
    in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return chain; },
    range: (from: number, to: number) => Promise.resolve(db.fail === table ? { data: null, error: new Error("x") }
      : { data: (db.tables[table] ?? []).filter(r => filters.every(f => f(r))).slice(from, to + 1), error: null }),
  };
  return chain;
} } }));
import { loadTeacherSourceLessons, isAllowedSourceLesson } from "@/lib/teacher-source-lessons";

const book = (id: string, extra: any = {}) => ({ id, title: `[TEST] ${id}`, subject: null, teacher_id: "me", copied_from_textbook_id: null, is_system: false, is_demo_seed: false, deleted_at: null, ...extra });
const lesson = (id: string, textbook_id: string) => ({ id, title: `[TEST] ${id}`, textbook_id, sort_order: 0 });

beforeEach(() => { db.tables = {}; db.fail = ""; db.demo = false; });

describe("lekce použitelné jako zdroj", () => {
  it("vlastní učebnice nabídne její lekce", async () => {
    db.tables = { teacher_textbooks: [book("own")], teacher_textbook_lessons: [lesson("l1", "own")] };
    expect((await loadTeacherSourceLessons("me")).map(l => [l.id, l.kind])).toEqual([["l1", "own"]]);
  });
  it("vlastní kopie učebnice se nabídne", async () => {
    db.tables = { teacher_textbooks: [book("copy", { copied_from_textbook_id: "orig" })], teacher_textbook_lessons: [lesson("l2", "copy")] };
    expect((await loadTeacherSourceLessons("me")).map(l => [l.id, l.kind])).toEqual([["l2", "copy"]]);
  });
  it("katalogové lekce témat předmětu vlastní učebnice se nabídnou pod ní", async () => {
    db.tables = { teacher_textbooks: [book("own", { subject: "admin" })], textbook_topics: [{ id: "t1", subject: "admin" }, { id: "t2", subject: "jine" }],
      textbook_lessons: [{ id: "c1", title: "K", topic_id: "t1", sort_order: 0, is_demo_seed: false }, { id: "c2", title: "J", topic_id: "t2", sort_order: 0, is_demo_seed: false }, { id: "c3", title: "D", topic_id: "t1", sort_order: 1, is_demo_seed: true }] };
    const rows = await loadTeacherSourceLessons("me");
    expect(rows.map(l => [l.id, l.source, l.textbookId])).toEqual([["c1", "textbook_lessons", "own"]]);
  });
  it("demo účet dostane ukázkové lekce jen pro čtení, běžný účet ne", async () => {
    db.tables = { teacher_textbooks: [book("seed", { teacher_id: "seeder", is_demo_seed: true })], teacher_textbook_lessons: [lesson("s1", "seed")] };
    expect(await loadTeacherSourceLessons("me")).toEqual([]);
    db.demo = true;
    expect((await loadTeacherSourceLessons("me")).map(l => [l.id, l.readOnly])).toEqual([["s1", true]]);
  });
  it("cizí, systémová a smazaná učebnice se nenabídne", async () => {
    db.tables = { teacher_textbooks: [book("foreign", { teacher_id: "other" }), book("sys", { is_system: true }), book("del", { deleted_at: "2026-01-01" })],
      teacher_textbook_lessons: [lesson("f", "foreign"), lesson("s", "sys"), lesson("d", "del")] };
    expect(await loadTeacherSourceLessons("me")).toEqual([]);
    expect(await isAllowedSourceLesson("me", { id: "f", source: "teacher_textbook_lessons" })).toBe(false);
  });
  it("bez lekcí vrátí prázdný seznam", async () => {
    db.tables = { teacher_textbooks: [book("own")] };
    expect(await loadTeacherSourceLessons("me")).toEqual([]);
  });
  it("chyba načítání se nepřevede na prázdný seznam", async () => {
    db.tables = { teacher_textbooks: [book("own")] }; db.fail = "teacher_textbook_lessons";
    await expect(loadTeacherSourceLessons("me")).rejects.toThrow();
  });
  it("více než 1000 lekcí se načte celé", async () => {
    db.tables = { teacher_textbooks: [book("own")], teacher_textbook_lessons: Array.from({ length: 1205 }, (_, i) => lesson(`l${i}`, "own")) };
    expect(await loadTeacherSourceLessons("me")).toHaveLength(1205);
  });
});
