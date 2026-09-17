import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slugify";

export type LessonSource = "textbook_lessons" | "teacher_textbook_lessons";

export interface LinkedLessonInfo {
  id: string;
  title: string;
  /** Trasa, na které si lekci otevře žák (i učitel). */
  url: string;
}

/**
 * Dohledá název propojené lekce a trasu, na které se dá zobrazit.
 * Globální lekce (textbook_lessons) se otevírají na /ucebnice/... (LessonPage
 * hledá lekci nejdřív podle ID), učitelské lekce ve žákovské učebnici.
 */
export const resolveLinkedLesson = async (
  lessonId: string,
  source: LessonSource | string | null,
): Promise<LinkedLessonInfo | null> => {
  if (!lessonId) return null;

  if (source === "textbook_lessons") {
    const { data: lesson } = await supabase
      .from("textbook_lessons")
      .select("id, title")
      .eq("id", lessonId)
      .maybeSingle();
    if (!lesson) return null;

    let url = `/ucebnice/obsah/0/lekce/${lessonId}`;
    const { data: assignment } = await supabase
      .from("lesson_topic_assignments")
      .select("topic_id")
      .eq("lesson_id", lessonId)
      .maybeSingle();
    if (assignment?.topic_id) {
      const { data: topic } = await supabase
        .from("textbook_topics")
        .select("subject, grade, title")
        .eq("id", assignment.topic_id)
        .maybeSingle();
      if (topic) {
        url = `/ucebnice/${topic.subject}/${topic.grade}/${slugify(topic.title || "") || topic.subject}/${lessonId}`;
      }
    }
    return { id: lessonId, title: (lesson as any).title ?? "Lekce", url };
  }

  const { data: lesson } = await supabase
    .from("teacher_textbook_lessons" as any)
    .select("id, title, textbook_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return null;
  const textbookId = (lesson as any).textbook_id;
  return {
    id: lessonId,
    title: (lesson as any).title ?? "Lekce",
    url: textbookId
      ? `/student/ucebnice/${textbookId}?lesson=${lessonId}`
      : `/student/ucebnice`,
  };
};
