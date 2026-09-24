import { supabase } from "@/integrations/supabase/client";

/** Žáci, kterým je úloha zadaná (třída nebo skupina předmětu). */
export const fetchAssignmentStudentIds = async (a: {
  class_id?: string | null;
  group_id?: string | null;
}): Promise<string[]> => {
  if (a.group_id) {
    const { data } = await supabase
      .from("subject_group_members")
      .select("student_id")
      .eq("group_id", a.group_id);
    return ((data as any[]) || []).map((m) => m.student_id).filter(Boolean);
  }
  if (a.class_id) {
    const { data } = await supabase.from("class_members").select("user_id").eq("class_id", a.class_id);
    return ((data as any[]) || []).map((m) => m.user_id).filter(Boolean);
  }
  return [];
};

export interface LessonSuccessOptions {
  lessonId: string;
  studentIds: string[];
  /** Když je zadané, počítá se jen tato aktivita; jinak průměr přes všechny. */
  activityIndex?: number | null;
}

/** Průměrná úspěšnost (0–100) aktivit lekce, null když nejsou data. */
export const fetchLessonSuccessPct = async ({
  lessonId,
  studentIds,
  activityIndex,
}: LessonSuccessOptions): Promise<{ pct: number | null; sampleCount: number }> => {
  if (!lessonId) return { pct: null, sampleCount: 0 };
  let q = supabase
    .from("student_activity_results")
    .select("user_id, activity_index, score, max_score")
    .eq("lesson_id", lessonId);
  if (typeof activityIndex === "number") q = q.eq("activity_index", activityIndex);
  if (studentIds.length > 0) q = q.in("user_id", studentIds);
  const { data } = await q;

  let sum = 0;
  let n = 0;
  ((data as any[]) || []).forEach((r) => {
    const max = Number(r.max_score) || 0;
    if (max <= 0) return;
    sum += (Number(r.score) || 0) / max;
    n += 1;
  });
  return { pct: n > 0 ? Math.round((sum / n) * 100) : null, sampleCount: n };
};

/** Vytvoří prázdný pracovní list a vrátí jeho ID (pro AI generování k tématu). */
export const createWorksheetForTopic = async (
  title: string,
  subject: string,
  spec: unknown,
): Promise<string> => {
  const { data: auth } = await supabase.auth.getUser();
  const teacherId = auth.user?.id;
  if (!teacherId) throw new Error("Nejste přihlášeni.");
  const { data, error } = await supabase
    .from("worksheets" as never)
    .insert({ teacher_id: teacherId, title, subject, spec } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Pracovní list se nepodařilo vytvořit.");
  return (data as { id: string }).id;
};

/** Zadání pro „Rychlou hru“ zaměřenou na slabé místo. */
export const weakSpotGameTopic = (label: string, pct: number | null) => {
  const t = label.trim() || "Opakování";
  const detail = pct !== null ? `${t} (úspěšnost jen ${pct} %)` : t;
  return `${t}\n\nZaměř se hlavně na tohle, protože to žákům dělalo problém: ${detail}`;
};
