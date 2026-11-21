import { supabase } from "@/integrations/supabase/client";
import { fetchStudentClassTextbookLinks, type StudentTextbookLink } from "@/lib/student-class-textbooks";

export interface PracticeLessonOption {
  id: string;
  title: string;
  textbook: string;
  subject: string;
  /** Existující pořadí v učebnici/tématu; stará data bez něj zůstanou abecedně. */
  sortOrder?: number | null;
  topicSortOrder?: number | null;
  topicId?: string | null;
}

export interface PracticeLessonGroup {
  subject: string;
  lessons: PracticeLessonOption[];
}

export interface RawPracticeLesson {
  id: string;
  title: string | null;
  status: string | null;
  textbook: string;
  subject: string;
  sortOrder?: number | null;
  topicSortOrder?: number | null;
  topicId?: string | null;
}

function throwOnQueryError(...results: Array<{ error?: unknown } | { data: unknown }>): void {
  for (const result of results) {
    if ("error" in result && result.error) throw result.error;
  }
}

function compareOrder(a: number | null | undefined, b: number | null | undefined): number {
  const aHas = typeof a === "number" && Number.isFinite(a);
  const bHas = typeof b === "number" && Number.isFinite(b);
  if (aHas && bHas) return a - b;
  if (aHas !== bHas) return aHas ? -1 : 1;
  return 0;
}

/** Jen publikované lekce, bez duplicit; existující pořadí učebnice/tématu, jinak abecedně. */
export function groupPracticeLessons(rows: RawPracticeLesson[]): PracticeLessonGroup[] {
  const seen = new Set<string>();
  const bySubject = new Map<string, PracticeLessonOption[]>();
  for (const r of rows) {
    if (!r.id || r.status !== "published" || seen.has(r.id)) continue;
    seen.add(r.id);
    const subject = r.subject?.trim() || "Ostatní";
    const list = bySubject.get(subject) ?? [];
    list.push({
      id: r.id,
      title: r.title || "Lekce",
      textbook: r.textbook,
      subject,
      sortOrder: r.sortOrder,
      topicSortOrder: r.topicSortOrder,
      topicId: r.topicId,
    });
    bySubject.set(subject, list);
  }
  return [...bySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "cs"))
    .map(([subject, lessons]) => ({
      subject,
      lessons: lessons.sort(
        (a, b) => a.textbook.localeCompare(b.textbook, "cs")
          || compareOrder(a.topicSortOrder, b.topicSortOrder)
          || compareOrder(a.sortOrder, b.sortOrder)
          || a.title.localeCompare(b.title, "cs"),
      ),
    }));
}

export function practiceLessonSelectOptions(
  groups: PracticeLessonGroup[],
  recentLessonIds: string[] = [],
  allowNone = false,
) {
  const rank = new Map(recentLessonIds.map((id, index) => [id, index]));
  const options = groups.flatMap((group) => group.lessons
    .map((lesson, index) => ({ lesson, index }))
    .sort((a, b) => {
      const aRank = rank.get(a.lesson.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.lesson.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.index - b.index;
    })
    .map(({ lesson }) => ({
      value: lesson.id,
      label: lesson.title,
      subtitle: [lesson.subject, lesson.textbook]
        .filter((part, index, all) => part.trim() && all.indexOf(part) === index)
        .join(" · "),
      group: group.subject,
    })));
  return allowNone
    ? [{ value: "none", label: "Bez konkrétní lekce", pinned: true }, ...options]
    : options;
}

/**
 * Lekce, které žák vidí na stránce svých učebnic: učitelské učebnice
 * (třída, předmět třídy, rozvrh, skupina, zápis kódem, umístění lekce)
 * a globální lekce přiřazené jeho třídě/skupině. Jen čtení – RLS rozhoduje.
 */
export async function fetchStudentPracticeLessons(userId: string): Promise<PracticeLessonGroup[]> {
  const [membershipResult, enrollmentResult, groupResult] = await Promise.all([
    supabase.from("class_members").select("class_id").eq("user_id", userId),
    supabase.from("teacher_textbook_enrollments").select("textbook_id").eq("student_id", userId),
    supabase.from("subject_group_members").select("group_id").eq("student_id", userId),
  ]);
  throwOnQueryError(membershipResult, enrollmentResult, groupResult);
  const memberships = membershipResult.data;
  const enrollData = enrollmentResult.data;
  const groupMembers = groupResult.data;
  const classIds = ((memberships ?? []) as any[]).map((m) => m.class_id).filter(Boolean);
  const groupIds = ((groupMembers ?? []) as any[]).map((m) => m.group_id).filter(Boolean);

  // Umístění lekcí nezávisí na odkazech učebnic, proto se načítají souběžně s nimi.
  const targetFilters: string[] = [];
  if (classIds.length) targetFilters.push(`class_id.in.(${classIds.join(",")})`);
  if (groupIds.length) targetFilters.push(`subject_group_id.in.(${groupIds.join(",")})`);
  const targetsPromise = targetFilters.length
    ? Promise.all([
      supabase.from("lesson_topic_assignments").select("lesson_id").eq("status", "published").or(targetFilters.join(",")),
      supabase.from("lesson_placements").select("lesson_id").eq("status", "published").or(targetFilters.join(",")),
    ])
    : Promise.resolve([{ data: [] as any[] }, { data: [] as any[] }]);
  const [links, [a, p]] = await Promise.all([
    fetchStudentClassTextbookLinks(userId, classIds, true),
    targetsPromise,
  ]);
  throwOnQueryError(a, p);

  const teacherSubjectByTb = new Map<string, string | null>();
  for (const l of links) {
    if (l.textbook_type !== "teacher") continue;
    if (!teacherSubjectByTb.get(l.textbook_id)) teacherSubjectByTb.set(l.textbook_id, l.subject_id);
  }
  for (const e of (enrollData ?? []) as any[]) {
    if (e.textbook_id && !teacherSubjectByTb.has(e.textbook_id)) teacherSubjectByTb.set(e.textbook_id, null);
  }

  const globalLessonIds = [...new Set(((a.data ?? []) as any[]).map((r) => r.lesson_id).filter(Boolean))];
  const placedLessonIds = [...new Set(((p.data ?? []) as any[]).map((r) => r.lesson_id).filter(Boolean))];
  const tbIds = [...teacherSubjectByTb.keys()];
  const [tbRes, tLessonsRes, placedTRes, gLessonsRes] = await Promise.all([
    tbIds.length
      ? supabase.from("teacher_textbooks").select("id, title, subject_id").in("id", tbIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as any[] }),
    tbIds.length
      ? supabase.from("teacher_textbook_lessons" as any).select("id, title, status, textbook_id, sort_order").in("textbook_id", tbIds).eq("status", "published")
      : Promise.resolve({ data: [] as any[] }),
    placedLessonIds.length
      ? supabase.from("teacher_textbook_lessons" as any).select("id, title, status, textbook_id, sort_order").in("id", placedLessonIds).eq("status", "published")
      : Promise.resolve({ data: [] as any[] }),
    [...globalLessonIds, ...placedLessonIds].length
      ? supabase.from("textbook_lessons").select("id, title, status, topic_id, sort_order").in("id", [...new Set([...globalLessonIds, ...placedLessonIds])]).eq("status", "published")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  throwOnQueryError(tbRes, tLessonsRes, placedTRes, gLessonsRes);
  const tbById = new Map<string, any>(((tbRes as any).data ?? []).map((t: any) => [t.id, t]));
  const placedT = ((placedTRes as any).data ?? []) as any[];
  const gLessons = ((gLessonsRes as any).data ?? []) as any[];
  const topicIds = [...new Set(gLessons.map((l) => l.topic_id).filter(Boolean))];
  const topicsPromise = topicIds.length
    ? supabase.from("textbook_topics").select("id, subject, sort_order").in("id", topicIds)
    : Promise.resolve({ data: [] as any[] });

  // Doplňování učebnic je podmíněné a běží souběžně s načtením témat.
  const missingTb = [...new Set(placedT.map((l) => l.textbook_id).filter((id) => id && !tbById.has(id)))];
  if (missingTb.length) {
    const { data, error } = await supabase.from("teacher_textbooks").select("id, title, subject_id").in("id", missingTb).is("deleted_at", null);
    throwOnQueryError({ error });
    for (const t of (data ?? []) as any[]) tbById.set(t.id, t);
  }
  const topicsRes = await topicsPromise;
  throwOnQueryError(topicsRes);
  const slugByTopic = new Map<string, string>(((topicsRes.data ?? []) as any[]).map((t) => [t.id, t.subject]));
  const topicOrderById = new Map<string, number>(((topicsRes.data ?? []) as any[]).map((t) => [t.id, t.sort_order]));
  const slugs = [...new Set([...slugByTopic.values()].filter(Boolean))];

  const subjectIds = [...new Set([
    ...[...teacherSubjectByTb.values()].filter(Boolean),
    ...[...tbById.values()].map((t) => t.subject_id).filter(Boolean),
  ])] as string[];
  const [subjRes, tsRes] = await Promise.all([
    subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] as any[] }),
    slugs.length ? supabase.from("textbook_subjects").select("slug, label").in("slug", slugs) : Promise.resolve({ data: [] as any[] }),
  ]);
  throwOnQueryError(subjRes, tsRes);
  const subjectName = new Map<string, string>(((subjRes as any).data ?? []).map((s: any) => [s.id, s.name]));
  const labelBySlug = new Map<string, string>(((tsRes as any).data ?? []).map((s: any) => [s.slug, s.label]));

  const rows: RawPracticeLesson[] = [];
  for (const l of [...(((tLessonsRes as any).data ?? []) as any[]), ...placedT]) {
    const tb = tbById.get(l.textbook_id);
    if (!tb) continue; // smazaná nebo nečitelná učebnice
    const sid = teacherSubjectByTb.get(l.textbook_id) || tb.subject_id;
    rows.push({
      id: l.id,
      title: l.title,
      status: l.status,
      textbook: tb.title ?? "",
      subject: (sid && subjectName.get(sid)) || tb.title || "",
      sortOrder: l.sort_order,
    });
  }
  for (const l of gLessons) {
    const slug = slugByTopic.get(l.topic_id);
    const label = (slug && labelBySlug.get(slug)) || "";
    rows.push({
      id: l.id,
      title: l.title,
      status: l.status,
      textbook: label,
      subject: label,
      sortOrder: l.sort_order,
      topicSortOrder: topicOrderById.get(l.topic_id),
      topicId: l.topic_id,
    });
  }
  return groupPracticeLessons(rows);
}
