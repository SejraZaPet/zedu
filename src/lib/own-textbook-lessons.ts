import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Nové lekce ve vlastní učebnici učitele (včetně dema) se ukládají jako
 * teacher_textbook_lessons s vlastníkem (textbook_id) a do tématu se zařadí
 * přes lesson_placements. Sdílená tabulka textbook_lessons nemá autora a
 * demo/koncepty v ní učitel po vložení nevidí.
 */
export interface OwnLessonTarget {
  textbookId: string;
  subjectSlug: string;
  topicId: string;
  grade: number;
}

export interface OwnLessonInput {
  title: string;
  blocks: unknown[];
}

export const OWN_LESSON_TABLE = "teacher_textbook_lessons" as const;

export function buildOwnLessonRows(target: OwnLessonTarget, lessons: OwnLessonInput[], startOrder: number) {
  return lessons.map((l, i) => ({
    textbook_id: target.textbookId,
    title: l.title.trim().slice(0, 200),
    blocks: l.blocks as unknown as Json,
    sort_order: startOrder + i,
    status: "draft",
  }));
}

export function buildPlacementRows(target: OwnLessonTarget, lessonIds: string[]) {
  return lessonIds.map((id) => ({
    lesson_id: id,
    subject_slug: target.subjectSlug,
    grade_number: target.grade,
    topic_id: target.topicId,
    status: "published",
  }));
}

/** Vytvoří lekce a zařadí je do tématu. Vrací počet vytvořených lekcí, jinak vyhodí chybu. */
export async function createOwnTextbookLessons(target: OwnLessonTarget, lessons: OwnLessonInput[]): Promise<number> {
  if (lessons.length === 0) return 0;
  const { data: last } = await supabase
    .from(OWN_LESSON_TABLE)
    .select("sort_order")
    .eq("textbook_id", target.textbookId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const start = last && last.length > 0 ? (last[0].sort_order ?? 0) + 1 : 0;

  const { data: inserted, error } = await supabase
    .from(OWN_LESSON_TABLE)
    .insert(buildOwnLessonRows(target, lessons, start))
    .select("id");
  if (error) throw error;
  const ids = (inserted ?? []).map((r) => r.id);
  if (ids.length !== lessons.length) {
    throw new Error("Lekci se nepodařilo uložit. Zkuste to prosím znovu.");
  }

  const { error: placeErr } = await supabase.from("lesson_placements").insert(buildPlacementRows(target, ids));
  if (placeErr) {
    await supabase.from(OWN_LESSON_TABLE).delete().in("id", ids);
    throw placeErr;
  }
  return ids.length;
}
