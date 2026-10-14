// Načtení lekce pro procvičování: nejdřív globální textbook_lessons, pak
// teacher_textbook_lessons. Oprávnění ověřuje čtení klientem s JWT volajícího
// (RLS), takže se nemění žádná pravidla přístupu. Bez Deno importů kvůli testům.

export interface PracticeLesson {
  id: string;
  title: string;
  blocks: unknown;
  source: "textbook_lessons" | "teacher_textbook_lessons";
}

export type PracticeLessonResult =
  | { ok: true; lesson: PracticeLesson }
  | { ok: false; status: 404 | 403; error: string };

// deno-lint-ignore no-explicit-any
type Client = { from: (t: string) => any };

async function find(client: Client, lessonId: string) {
  for (const source of ["textbook_lessons", "teacher_textbook_lessons"] as const) {
    const { data } = await client
      .from(source)
      .select("id, title, blocks")
      .eq("id", lessonId)
      .maybeSingle();
    if (data) return { ...data, title: data.title ?? "", source } as PracticeLesson;
  }
  return null;
}

/**
 * @param userClient klient s Authorization hlavičkou volajícího (RLS)
 * @param adminClient service-role klient — jen pro rozlišení 404 vs. 403
 */
export async function loadPracticeLesson(
  userClient: Client,
  adminClient: Client,
  lessonId: string,
): Promise<PracticeLessonResult> {
  const visible = await find(userClient, lessonId);
  if (visible) return { ok: true, lesson: visible };
  const exists = await find(adminClient, lessonId);
  if (exists) return { ok: false, status: 403, error: "K této lekci nemáš přístup." };
  return { ok: false, status: 404, error: "Lekce nebyla nalezena. Vyber jinou lekci." };
}

/** Počet otázek z délky (4–12); bez hodnoty vrací výchozí. */
export function clampQuestionCount(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(4, Math.min(12, Math.round(n)));
}
