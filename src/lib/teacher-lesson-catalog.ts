import { supabase } from "@/integrations/supabase/client";

export interface TeacherLessonOption {
  id: string;
  title: string;
  blocks: any[];
  /** Název učebnice (vlastní) nebo tématu (katalog). */
  source?: string;
  /** Předmět lekce (teacher_textbooks.subject / textbook_topics.subject). */
  subject?: string | null;
  /** Skutečný název učebnice (u vlastních lekcí). */
  textbookTitle?: string | null;
  /** Název tématu (u katalogových lekcí). */
  topicTitle?: string | null;
  origin: "own" | "catalog";
  textbookId?: string | null;
}

/**
 * Načte lekce dostupné učiteli: jeho vlastní lekce z jeho učebnic
 * a k tomu katalogové lekce z témat pro předměty, které učí.
 * Duplicity podle id jsou odstraněné, vlastní lekce mají přednost.
 */
export async function loadTeacherLessonOptions(uid: string): Promise<TeacherLessonOption[]> {
  const { data: books, error: booksErr } = await supabase
    .from("teacher_textbooks")
    .select("id, title, subject")
    .eq("teacher_id", uid)
    .is("deleted_at", null);
  if (booksErr) throw booksErr;

  const bookRows = ((books as any[]) || []);
  const bookIds = bookRows.map((b) => b.id);
  const titleByBook = new Map(bookRows.map((b) => [b.id, b.title as string]));
  const subjectByBook = new Map(bookRows.map((b) => [b.id, (b.subject as string) || null]));

  let own: TeacherLessonOption[] = [];
  if (bookIds.length) {
    const { data, error } = await supabase
      .from("teacher_textbook_lessons")
      .select("id, title, blocks, textbook_id")
      .in("textbook_id", bookIds)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    own = ((data as any[]) || []).map((l) => ({
      id: l.id,
      title: l.title || "Bez názvu",
      blocks: Array.isArray(l.blocks) ? l.blocks : [],
      source: titleByBook.get(l.textbook_id) || undefined,
      subject: subjectByBook.get(l.textbook_id) ?? null,
      textbookTitle: titleByBook.get(l.textbook_id) ?? null,
      topicTitle: null,
      origin: "own" as const,
      textbookId: l.textbook_id ?? null,
    }));
  }

  // Katalogová struktura (textbook_topics / textbook_lessons) – tam vzniká většina obsahu.
  const subjects = Array.from(
    new Set(bookRows.map((b) => b.subject).filter(Boolean)),
  ) as string[];

  let catalog: TeacherLessonOption[] = [];
  if (subjects.length) {
    const { data: topics } = await supabase
      .from("textbook_topics" as any)
      .select("id, title, subject")
      .in("subject", subjects);
    const topicRows = ((topics as any[]) || []);
    if (topicRows.length) {
      const topicLabel = new Map(topicRows.map((t) => [t.id, t.title as string]));
      const topicSubject = new Map(topicRows.map((t) => [t.id, (t.subject as string) || null]));
      const { data: cl } = await supabase
        .from("textbook_lessons" as any)
        .select("id, title, blocks, topic_id, sort_order")
        .in("topic_id", topicRows.map((t) => t.id))
        .order("sort_order", { ascending: true });
      catalog = ((cl as any[]) || []).map((l) => ({
        id: l.id,
        title: l.title || "Bez názvu",
        blocks: Array.isArray(l.blocks) ? l.blocks : [],
        source: topicLabel.get(l.topic_id) || undefined,
        subject: topicSubject.get(l.topic_id) ?? null,
        textbookTitle: null,
        topicTitle: topicLabel.get(l.topic_id) ?? null,
        origin: "catalog" as const,
        textbookId: null,
      }));
    }
  }

  return [...own, ...catalog].filter(
    (l, i, arr) => arr.findIndex((x) => x.id === l.id) === i,
  );
}
