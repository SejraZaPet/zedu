import { supabase } from "@/integrations/supabase/client";

export interface LessonReflection {
  id: string;
  teacher_id: string;
  lesson_plan_id: string | null;
  subject: string | null;
  class_id: string | null;
  reflection_date: string | null;
  rating: number | null;
  what_worked: string | null;
  what_to_change: string | null;
  quick_notes: string | null;
  created_at: string;
}

/** Build a lookup key for a lesson event. */
export function reflectionKey(args: {
  subject?: string | null;
  classId?: string | null;
  date: string; // YYYY-MM-DD
}) {
  return `${(args.subject || "").trim().toLowerCase()}|${args.classId || ""}|${args.date}`;
}

/** Fetch reflections for a teacher within a date range. */
export async function fetchReflections(args: {
  teacherId: string;
  fromDate: string;
  toDate: string;
}): Promise<LessonReflection[]> {
  const { data } = await (supabase as any)
    .from("lesson_reflections")
    .select("*")
    .eq("teacher_id", args.teacherId)
    .gte("reflection_date", args.fromDate)
    .lte("reflection_date", args.toDate);
  return (data as LessonReflection[]) ?? [];
}

/** Find a single reflection for given (subject, class, date). */
export async function findReflection(args: {
  teacherId: string;
  subject?: string | null;
  classId?: string | null;
  date: string;
}): Promise<LessonReflection | null> {
  let q = (supabase as any)
    .from("lesson_reflections")
    .select("*")
    .eq("teacher_id", args.teacherId)
    .eq("reflection_date", args.date)
    .limit(1);
  if (args.subject) q = q.eq("subject", args.subject);
  if (args.classId) q = q.eq("class_id", args.classId);
  const { data } = await q;
  return ((data as LessonReflection[]) ?? [])[0] ?? null;
}
