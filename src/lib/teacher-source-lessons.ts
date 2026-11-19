import { supabase } from "@/integrations/supabase/client";
import { isDemoAccount, textbookOwnerOr } from "@/lib/demo-seed-textbooks";

/**
 * Lekce, které učitel vidí ve svých učebnicích (stejně jako stránka TeacherTextbooks)
 * a smí je použít jako zdroj: přímé lekce vlastních učebnic včetně vlastních kopií,
 * katalogové lekce témat předmětu vlastní učebnice a u demo účtu ukázkové lekce
 * jen pro čtení. Cizí, systémové a smazané učebnice se nenabízejí. RLS beze změny.
 */
export type SourceLessonTable = "teacher_textbook_lessons" | "textbook_lessons";
export type SourceBookKind = "own" | "copy" | "demo";
export interface SourceBookRow {
  id: string; title?: string | null; subject?: string | null; teacher_id: string;
  copied_from_textbook_id: string | null; is_system: boolean; is_demo_seed: boolean; deleted_at?: string | null;
}
export interface TeacherSourceLesson {
  id: string; title: string; blocks: unknown; sortOrder: number;
  source: SourceLessonTable; textbookId: string; textbookTitle: string;
  kind: SourceBookKind | "catalog"; readOnly: boolean;
  /** Předmět učebnice, pod kterou se lekce zobrazuje. */
  subject: string | null;
  /** Poslední úprava lekce (pro řazení „nejnovější“). */
  updatedAt?: string | null;
  /** Téma katalogové lekce (u vlastních učebnic chybí). */
  topicTitle?: string | null;
}

export function usableSourceBook(book: SourceBookRow, uid: string, isDemo: boolean): SourceBookKind | null {
  if (book.deleted_at || book.is_system) return null;
  if (book.is_demo_seed) return isDemo ? "demo" : null;
  if (book.teacher_id !== uid) return null;
  return book.copied_from_textbook_id ? "copy" : "own";
}

const PAGE = 1000;
const CHUNK = 100;
/** Načte všechny stránky dotazu – seznam se nikdy tiše neusekne na 1000 řádků. */
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

export async function loadTeacherSourceLessons(uid: string, opts: { withBlocks?: boolean } = {}): Promise<TeacherSourceLesson[]> {
  const isDemo = await isDemoAccount(uid);
  const books = await fetchAllPages<SourceBookRow>((from, to) => supabase.from("teacher_textbooks")
    .select("id, title, subject, teacher_id, copied_from_textbook_id, is_system, is_demo_seed, deleted_at")
    .or(textbookOwnerOr(uid, isDemo)).is("deleted_at", null).order("title").order("id").range(from, to) as any);
  const usable = books.map(b => ({ book: b, kind: usableSourceBook(b, uid, isDemo) })).filter((x): x is { book: SourceBookRow; kind: SourceBookKind } => !!x.kind);
  const byId = new Map(usable.map(x => [x.book.id, x]));
  const cols = opts.withBlocks ? "id, title, blocks, sort_order, updated_at" : "id, title, sort_order, updated_at";
  const seen = new Set<string>();
  const out: TeacherSourceLesson[] = [];

  for (const ids of chunks([...byId.keys()])) {
    const rows = await fetchAllPages<any>((from, to) => supabase.from("teacher_textbook_lessons")
      .select(`${cols}, textbook_id`).in("textbook_id", ids).order("sort_order").order("id").range(from, to) as any);
    for (const l of rows) {
      const owner = byId.get(l.textbook_id);
      if (!owner || seen.has(l.id)) continue;
      seen.add(l.id);
      out.push({ id: l.id, title: l.title || "Bez názvu", blocks: l.blocks ?? [], sortOrder: l.sort_order ?? 0, source: "teacher_textbook_lessons",
        textbookId: owner.book.id, textbookTitle: owner.book.title || "Učebnice", kind: owner.kind, readOnly: owner.kind === "demo", subject: owner.book.subject ?? null, updatedAt: l.updated_at ?? null, topicTitle: null });
    }
  }

  // Katalogové lekce témat předmětu – jen pod vlastní (ne ukázkovou) učebnicí, jako na stránce Učebnice.
  const bookBySubject = new Map<string, { book: SourceBookRow; kind: SourceBookKind }>();
  for (const x of usable) if (x.kind !== "demo" && x.book.subject && !bookBySubject.has(x.book.subject)) bookBySubject.set(x.book.subject, x);
  const subjects = [...bookBySubject.keys()];
  if (subjects.length) {
    const topics = await fetchAllPages<any>((from, to) => supabase.from("textbook_topics")
      .select("id, subject, title").in("subject", subjects).order("id").range(from, to) as any);
    const subjectByTopic = new Map(topics.map(t => [t.id as string, t.subject as string]));
    const titleByTopic = new Map(topics.map(t => [t.id as string, (t.title as string | null) ?? null]));
    for (const ids of chunks([...subjectByTopic.keys()])) {
      const rows = await fetchAllPages<any>((from, to) => supabase.from("textbook_lessons")
        .select(`${cols}, topic_id, is_demo_seed`).in("topic_id", ids).order("sort_order").order("id").range(from, to) as any);
      for (const l of rows) {
        const owner = bookBySubject.get(subjectByTopic.get(l.topic_id) ?? "");
        if (!owner || l.is_demo_seed || seen.has(l.id)) continue;
        seen.add(l.id);
        out.push({ id: l.id, title: l.title || "Bez názvu", blocks: l.blocks ?? [], sortOrder: l.sort_order ?? 0, source: "textbook_lessons",
          textbookId: owner.book.id, textbookTitle: owner.book.title || "Učebnice", kind: "catalog", readOnly: false, subject: owner.book.subject ?? null, updatedAt: l.updated_at ?? null, topicTitle: titleByTopic.get(l.topic_id) ?? null });
      }
    }
  }
  return sortSourceLessons(out);
}

export function sortSourceLessons(lessons: TeacherSourceLesson[]): TeacherSourceLesson[] {
  return [...lessons].sort((a, b) => a.textbookTitle.localeCompare(b.textbookTitle, "cs") || a.textbookId.localeCompare(b.textbookId)
    || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "cs") || a.id.localeCompare(b.id));
}

/** Učebnice v pořadí seznamu, pro seskupený výběr. */
export function sourceLessonBooks(lessons: TeacherSourceLesson[]): { id: string; title: string; count: number }[] {
  const map = new Map<string, { id: string; title: string; count: number }>();
  for (const l of lessons) {
    const b = map.get(l.textbookId) ?? { id: l.textbookId, title: l.textbookTitle, count: 0 };
    b.count++; map.set(l.textbookId, b);
  }
  return [...map.values()];
}

/** Před odesláním textu do AI znovu ověří, že lekce je stále povoleným zdrojem. */
export async function isAllowedSourceLesson(uid: string, lesson: { id: string; source: SourceLessonTable }): Promise<boolean> {
  const fresh = await loadTeacherSourceLessons(uid);
  return fresh.some(l => l.id === lesson.id && l.source === lesson.source);
}

/** Položka pro sdílený LessonFinder (stejná data, žádná nová lekce). */
export function toFinderItem(l: TeacherSourceLesson) {
  return { id: l.id, title: l.title, textbookId: l.textbookId, textbookTitle: l.textbookTitle, subject: l.subject,
    topic: l.topicTitle ?? null, updatedAt: l.updatedAt ?? null, sortOrder: l.sortOrder, note: l.readOnly ? "ukázka" : null };
}
