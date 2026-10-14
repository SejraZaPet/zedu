import { supabase } from "@/integrations/supabase/client";
import { fetchStudentClassTextbookLinks, type StudentTextbookLink } from "@/lib/student-class-textbooks";

export interface PracticeLessonOption {
  id: string;
  title: string;
  textbook: string;
  subject: string;
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
}

/** Jen publikované lekce, bez duplicit, seskupené Předmět → Lekce (abecedně). */
export function groupPracticeLessons(rows: RawPracticeLesson[]): PracticeLessonGroup[] {
  const seen = new Set<string>();
  const bySubject = new Map<string, PracticeLessonOption[]>();
  for (const r of rows) {
    if (!r.id || r.status !== "published" || seen.has(r.id)) continue;
    seen.add(r.id);
    const subject = r.subject?.trim() || "Ostatní";
    const list = bySubject.get(subject) ?? [];
    list.push({ id: r.id, title: r.title || "Lekce", textbook: r.textbook, subject });
    bySubject.set(subject, list);
  }
  return [...bySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "cs"))
    .map(([subject, lessons]) => ({
      subject,
      lessons: lessons.sort(
        (a, b) => a.textbook.localeCompare(b.textbook, "cs") || a.title.localeCompare(b.title, "cs"),
      ),
    }));
}

/**
 * Lekce, které žák vidí na stránce svých učebnic: učitelské učebnice
 * (třída, předmět třídy, rozvrh, skupina, zápis kódem, umístění lekce)
 * a globální lekce přiřazené jeho třídě/skupině. Jen čtení – RLS rozhoduje.
 */
export async function fetchStudentPracticeLessons(userId: string): Promise<PracticeLessonGroup[]> {
  const [{ data: memberships }, { data: enrollData }, { data: groupMembers }] = await Promise.all([
    supabase.from("class_members").select("class_id").eq("user_id", userId),
    supabase.from("teacher_textbook_enrollments").select("textbook_id").eq("student_id", userId),
    supabase.from("subject_group_members").select("group_id").eq("student_id", userId),
  ]);
  const classIds = ((memberships ?? []) as any[]).map((m) => m.class_id).filter(Boolean);
  const groupIds = ((groupMembers ?? []) as any[]).map((m) => m.group_id).filter(Boolean);
  const links: StudentTextbookLink[] = await fetchStudentClassTextbookLinks(userId, classIds);

  const teacherSubjectByTb = new Map<string, string | null>();
  for (const l of links) {
    if (l.textbook_type !== "teacher") continue;
    if (!teacherSubjectByTb.get(l.textbook_id)) teacherSubjectByTb.set(l.textbook_id, l.subject_id);
  }
  for (const e of (enrollData ?? []) as any[]) {
    if (e.textbook_id && !teacherSubjectByTb.has(e.textbook_id)) teacherSubjectByTb.set(e.textbook_id, null);
  }

  // Globální lekce přiřazené třídě/skupině žáka + umístění lekcí
  const targetFilters: string[] = [];
  if (classIds.length) targetFilters.push(`class_id.in.(${classIds.join(",")})`);
  if (groupIds.length) targetFilters.push(`subject_group_id.in.(${groupIds.join(",")})`);
  let globalLessonIds: string[] = [];
  let placedLessonIds: string[] = [];
  if (targetFilters.length) {
    const or = targetFilters.join(",");
    const [a, p] = await Promise.all([
      supabase.from("lesson_topic_assignments").select("lesson_id").eq("status", "published").or(or),
      supabase.from("lesson_placements").select("lesson_id").eq("status", "published").or(or),
    ]);
    globalLessonIds = [...new Set(((a.data ?? []) as any[]).map((r) => r.lesson_id).filter(Boolean))];
    placedLessonIds = [...new Set(((p.data ?? []) as any[]).map((r) => r.lesson_id).filter(Boolean))];
  }

  const tbIds = [...teacherSubjectByTb.keys()];
  const [tbRes, tLessonsRes, placedTRes, gLessonsRes] = await Promise.all([
    tbIds.length
      ? supabase.from("teacher_textbooks").select("id, title, subject_id").in("id", tbIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as any[] }),
    tbIds.length
      ? supabase.from("teacher_textbook_lessons" as any).select("id, title, status, textbook_id").in("textbook_id", tbIds).eq("status", "published")
      : Promise.resolve({ data: [] as any[] }),
    placedLessonIds.length
      ? supabase.from("teacher_textbook_lessons" as any).select("id, title, status, textbook_id").in("id", placedLessonIds).eq("status", "published")
      : Promise.resolve({ data: [] as any[] }),
    [...globalLessonIds, ...placedLessonIds].length
      ? supabase.from("textbook_lessons").select("id, title, status, topic_id").in("id", [...new Set([...globalLessonIds, ...placedLessonIds])]).eq("status", "published")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const tbById = new Map<string, any>(((tbRes as any).data ?? []).map((t: any) => [t.id, t]));
  // Doplnit učebnice z umístění, které nejsou v odkazech
  const placedT = ((placedTRes as any).data ?? []) as any[];
  const missingTb = [...new Set(placedT.map((l) => l.textbook_id).filter((id) => id && !tbById.has(id)))];
  if (missingTb.length) {
    const { data } = await supabase.from("teacher_textbooks").select("id, title, subject_id").in("id", missingTb).is("deleted_at", null);
    for (const t of (data ?? []) as any[]) tbById.set(t.id, t);
  }

  const gLessons = ((gLessonsRes as any).data ?? []) as any[];
  const topicIds = [...new Set(gLessons.map((l) => l.topic_id).filter(Boolean))];
  const topicsRes = topicIds.length
    ? await supabase.from("textbook_topics").select("id, subject").in("id", topicIds)
    : { data: [] as any[] };
  const slugByTopic = new Map<string, string>(((topicsRes.data ?? []) as any[]).map((t) => [t.id, t.subject]));
  const slugs = [...new Set([...slugByTopic.values()].filter(Boolean))];

  const subjectIds = [...new Set([
    ...[...teacherSubjectByTb.values()].filter(Boolean),
    ...[...tbById.values()].map((t) => t.subject_id).filter(Boolean),
  ])] as string[];
  const [subjRes, tsRes] = await Promise.all([
    subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] as any[] }),
    slugs.length ? supabase.from("textbook_subjects").select("slug, label").in("slug", slugs) : Promise.resolve({ data: [] as any[] }),
  ]);
  const subjectName = new Map<string, string>(((subjRes as any).data ?? []).map((s: any) => [s.id, s.name]));
  const labelBySlug = new Map<string, string>(((tsRes as any).data ?? []).map((s: any) => [s.slug, s.label]));

  const rows: RawPracticeLesson[] = [];
  for (const l of [...(((tLessonsRes as any).data ?? []) as any[]), ...placedT]) {
    const tb = tbById.get(l.textbook_id);
    if (!tb) continue; // smazaná nebo nečitelná učebnice
    const sid = teacherSubjectByTb.get(l.textbook_id) || tb.subject_id;
    rows.push({ id: l.id, title: l.title, status: l.status, textbook: tb.title ?? "", subject: (sid && subjectName.get(sid)) || tb.title || "" });
  }
  for (const l of gLessons) {
    const slug = slugByTopic.get(l.topic_id);
    const label = (slug && labelBySlug.get(slug)) || "";
    rows.push({ id: l.id, title: l.title, status: l.status, textbook: label, subject: label });
  }
  return groupPracticeLessons(rows);
}
