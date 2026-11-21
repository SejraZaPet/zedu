import {
  findTutorSnippets,
  lessonTextForTutor,
  notebookTextForTutor,
  type TutorSourceSnippet,
} from "./tutor.ts";

const LESSON_CANDIDATES_PER_TABLE = 80;
const NOTEBOOK_CANDIDATES = 20;
const NOTEBOOK_PAGE_CANDIDATES = 100;

interface StudentSearchDb {
  from: (table: string) => any;
}

interface GlobalLessonRow {
  id: string;
  title: string | null;
  blocks: unknown;
  textbook_topics?: { id: string; subject: string; grade: number } | Array<{ id: string; subject: string; grade: number }> | null;
}
interface TeacherLessonRow { id: string; title: string | null; blocks: unknown; textbook_id: string }
interface NotebookRow { id: string; title: string | null }
interface NotebookPageRow { id: string; notebook_id: string; title: string | null; content: unknown }

/**
 * Čte výhradně předaným klientem s JWT žáka. RLS a published filtr jsou povinné;
 * žádný service-role klient ani cizí owner se zde nevytváří.
 */
export async function searchStudentMaterialSnippets(
  db: StudentSearchDb,
  userId: string,
  query: string,
): Promise<TutorSourceSnippet[]> {
  const [globalResult, teacherResult, notebooksResult] = await Promise.all([
    db.from("textbook_lessons")
      .select("id, title, blocks, textbook_topics(id, subject, grade)")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(LESSON_CANDIDATES_PER_TABLE),
    db.from("teacher_textbook_lessons")
      .select("id, title, blocks, textbook_id")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(LESSON_CANDIDATES_PER_TABLE),
    db.from("notebooks")
      .select("id, title")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(NOTEBOOK_CANDIDATES),
  ]);
  if (globalResult.error || teacherResult.error || notebooksResult.error) {
    throw new Error("Material candidate query failed");
  }

  const documents: Array<{ title: string; kind: string; text: string; href?: string }> = [];
  for (const lesson of (globalResult.data ?? []) as GlobalLessonRow[]) {
    const text = lessonTextForTutor(lesson.blocks);
    const topic = Array.isArray(lesson.textbook_topics) ? lesson.textbook_topics[0] : lesson.textbook_topics;
    const href = topic
      ? `/ucebnice/${encodeURIComponent(topic.subject)}/${topic.grade}/${encodeURIComponent(topic.id)}/${encodeURIComponent(lesson.id)}`
      : undefined;
    if (text) documents.push({ title: lesson.title || "Lekce", kind: "Lekce z učebnice", text, ...(href ? { href } : {}) });
  }
  for (const lesson of (teacherResult.data ?? []) as TeacherLessonRow[]) {
    const text = lessonTextForTutor(lesson.blocks);
    if (text) documents.push({
      title: lesson.title || "Lekce od učitele",
      kind: "Lekce od učitele",
      text,
      href: `/student/ucebnice/${encodeURIComponent(lesson.textbook_id)}?lesson=${encodeURIComponent(lesson.id)}`,
    });
  }

  const notebooks = (notebooksResult.data ?? []) as NotebookRow[];
  const notebookIds = notebooks.map((notebook) => notebook.id);
  if (notebookIds.length) {
    const pagesResult = await db.from("notebook_pages")
      .select("id, notebook_id, title, content")
      .in("notebook_id", notebookIds)
      .order("page_order", { ascending: true })
      .limit(NOTEBOOK_PAGE_CANDIDATES);
    if (pagesResult.error) throw new Error("Notebook candidate query failed");
    const titleByNotebook = new Map(notebooks.map((notebook) => [notebook.id, notebook.title || "Můj sešit"]));
    for (const page of (pagesResult.data ?? []) as NotebookPageRow[]) {
      const text = notebookTextForTutor(page.content);
      if (!text) continue;
      const notebookTitle = titleByNotebook.get(page.notebook_id) ?? "Můj sešit";
      documents.push({
        title: `${notebookTitle}${page.title ? ` – ${page.title}` : ""}`,
        kind: "Poznámka v sešitě",
        text,
        href: `/student/sesit?otevrit=${encodeURIComponent(page.notebook_id)}&strana=${encodeURIComponent(page.id)}`,
      });
    }
  }

  return findTutorSnippets(documents, query);
}
