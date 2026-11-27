import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildOwnLessonRows, buildPlacementRows, OWN_LESSON_TABLE } from "@/lib/own-textbook-lessons";

const target = { textbookId: "tb1", subjectSlug: "zkouska", topicId: "t1", grade: 2 };

describe("nová lekce ve vlastní učebnici", () => {
  it("ukládá se do vlastní tabulky učitele, ne do sdílené", () => {
    expect(OWN_LESSON_TABLE).toBe("teacher_textbook_lessons");
  });
  it("patří učebnici a začíná jako koncept", () => {
    const [row] = buildOwnLessonRows(target, [{ title: "  Lekce 1 ", blocks: [] }], 3);
    expect(row).toMatchObject({ textbook_id: "tb1", title: "Lekce 1", status: "draft", sort_order: 3 });
  });
  it("zařadí se do zvoleného tématu a ročníku", () => {
    expect(buildPlacementRows(target, ["L1"])[0]).toMatchObject({ lesson_id: "L1", topic_id: "t1", grade_number: 2, subject_slug: "zkouska" });
  });
});
