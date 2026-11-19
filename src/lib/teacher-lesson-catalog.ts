import { loadTeacherSourceLessons } from "@/lib/teacher-source-lessons";
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
  updatedAt?: string | null;
  sortOrder?: number;
}

/**
 * Lekce dostupné učiteli jako zdroj – sdílená logika teacher-source-lessons
 * (vlastní učebnice i kopie, katalog témat předmětu, demo ukázky jen pro čtení),
 * bez tichého omezení na 1000 řádků.
 */
export async function loadTeacherLessonOptions(uid: string): Promise<TeacherLessonOption[]> {
  const rows = await loadTeacherSourceLessons(uid, { withBlocks: true });
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    blocks: Array.isArray(l.blocks) ? l.blocks : [],
    source: l.textbookTitle,
    subject: l.subject,
    textbookTitle: l.textbookTitle,
    topicTitle: l.topicTitle ?? null,
    updatedAt: l.updatedAt ?? null,
    sortOrder: l.sortOrder,
    origin: l.kind === "catalog" ? "catalog" as const : "own" as const,
    textbookId: l.textbookId,
  }));
}
