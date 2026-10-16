import { supabase } from "@/integrations/supabase/client";
import type { PlanLesson } from "@/lib/planned-assignment";

/**
 * Lekce učitelské učebnice: vlastní lekce + globální lekce přes témata předmětu
 * (stejná logika jako výběr lekce v zadání úlohy). RLS rozhoduje o přístupu.
 */
export async function loadTextbookLessonOptions(textbookId: string): Promise<PlanLesson[]> {
  const options: PlanLesson[] = [];
  const [tbRes, teacherLessonsRes] = await Promise.all([
    supabase.from("teacher_textbooks" as any).select("subject, title").eq("id", textbookId).maybeSingle(),
    supabase.from("teacher_textbook_lessons" as any).select("id, title, sort_order").eq("textbook_id", textbookId).order("sort_order", { ascending: true }),
  ]);
  for (const l of ((teacherLessonsRes.data as any[]) ?? [])) options.push({ id: l.id, title: l.title, source: "teacher_textbook_lessons" });
  const tb = tbRes.data as any;
  const slug = (tb?.subject && String(tb.subject).trim()) ||
    String(tb?.title ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (slug) {
    const { data: topics } = await supabase.from("textbook_topics").select("id").eq("subject", slug);
    const topicIds = ((topics as any[]) ?? []).map((t) => t.id);
    if (topicIds.length) {
      const { data: tas } = await supabase.from("lesson_topic_assignments").select("lesson_id").in("topic_id", topicIds);
      const ids = [...new Set(((tas as any[]) ?? []).map((a) => a.lesson_id).filter(Boolean))];
      if (ids.length) {
        const { data: gl } = await supabase.from("textbook_lessons").select("id, title").in("id", ids);
        for (const l of ((gl as any[]) ?? [])) options.push({ id: l.id, title: l.title, source: "textbook_lessons" });
      }
    }
  }
  const seen = new Set<string>();
  return options.filter((o) => !seen.has(o.id) && (seen.add(o.id), true));
}
