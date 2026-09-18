import { supabase } from "@/integrations/supabase/client";
import { activityMeta } from "@/lib/activity-meta";

export interface LessonActivityInfo {
  /** Index mezi VIDITELNÝMI bloky lekce – stejná konvence jako LessonPage.tsx. */
  index: number;
  title: string;
  activityType: string;
  required: boolean;
}

/**
 * Načte aktivity lekce (podle zdroje učebnice) ve stejném indexování,
 * jaké používá ukládání do student_activity_results.
 */
export const fetchLessonActivities = async (
  lessonId: string,
  source: string | null | undefined,
): Promise<LessonActivityInfo[]> => {
  if (!lessonId) return [];
  const table = source === "textbook_lessons" ? "textbook_lessons" : "teacher_textbook_lessons";
  const { data } = await supabase
    .from(table as any)
    .select("blocks")
    .eq("id", lessonId)
    .maybeSingle();

  const blocks = ((data as any)?.blocks as any[]) ?? [];
  if (!Array.isArray(blocks)) return [];
  const visible = blocks.filter((b) => b?.visible !== false);

  return visible
    .map((b, index) => ({ b, index }))
    .filter(({ b }) => b?.type === "activity")
    .map(({ b, index }) => {
      const props = (b?.props ?? {}) as Record<string, any>;
      const type = String(props.activityType ?? "activity");
      return {
        index,
        title: String(props.title || b?.title || activityMeta(type).label),
        activityType: type,
        required: props.required === true,
      };
    });
};
