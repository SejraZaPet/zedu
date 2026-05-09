/**
 * Persistence for "phase schedules" of a teacher's lesson plan.
 * Backed by the `lesson_plan_phases` Supabase table (with localStorage
 * fallback for legacy data; migrated on first access).
 */
import { supabase } from "@/integrations/supabase/client";

export interface PhaseEntry {
  key: string;
  title: string;
  timeMin: number;
}

export interface StoredPhasePlan {
  subject: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end?: string;
  title?: string;
  phases: PhaseEntry[];
  updatedAt: string;
}

const LEGACY_KEY = "zedu.phase-plans.v1";
const MIGRATED_FLAG = "zedu.phase-plans.migrated.v2";

function readLegacy(): Record<string, StoredPhasePlan> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LEGACY_KEY) || "{}");
  } catch {
    return {};
  }
}

export function planKey(subject: string, date: string, start: string) {
  return `${(subject || "").trim().toLowerCase()}|${date}|${start}`;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** One-time copy from legacy localStorage into DB for the current user. */
async function migrateLegacyOnce(userId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_FLAG)) return;
  const all = readLegacy();
  const entries = Object.values(all);
  if (entries.length > 0) {
    const rows = entries.flatMap((p) =>
      p.phases.map((ph, i) => ({
        teacher_id: userId,
        subject: p.subject,
        lesson_date: p.date,
        start_time: p.start,
        end_time: p.end ?? null,
        plan_title: p.title ?? null,
        phase_key: ph.key,
        title: ph.title,
        duration_min: ph.timeMin || 0,
        sort_order: i,
      })),
    );
    if (rows.length > 0) {
      await supabase.from("lesson_plan_phases").insert(rows);
    }
  }
  localStorage.setItem(MIGRATED_FLAG, "1");
}

export async function savePhasePlan(plan: StoredPhasePlan): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await migrateLegacyOnce(userId);

  const subj = (plan.subject || "").trim();

  // Replace existing rows for this (teacher, subject, date, start)
  await supabase
    .from("lesson_plan_phases")
    .delete()
    .eq("teacher_id", userId)
    .eq("subject", subj)
    .eq("lesson_date", plan.date)
    .eq("start_time", plan.start)
    .is("lesson_plan_id", null);

  const rows = plan.phases.map((ph, i) => ({
    teacher_id: userId,
    subject: subj,
    lesson_date: plan.date,
    start_time: plan.start,
    end_time: plan.end ?? null,
    plan_title: plan.title ?? null,
    phase_key: ph.key,
    title: ph.title,
    duration_min: ph.timeMin || 0,
    sort_order: i,
  }));
  if (rows.length > 0) {
    await supabase.from("lesson_plan_phases").insert(rows);
  }
}

export async function getPhasePlan(
  subject: string | undefined,
  date: string | undefined,
  start: string | undefined,
): Promise<StoredPhasePlan | null> {
  if (!subject || !date || !start) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  await migrateLegacyOnce(userId);

  const subj = subject.trim();
  const { data, error } = await supabase
    .from("lesson_plan_phases")
    .select("*")
    .eq("teacher_id", userId)
    .eq("subject", subj)
    .eq("lesson_date", date)
    .eq("start_time", start)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return null;

  const first: any = data[0];
  return {
    subject: first.subject ?? subj,
    date: first.lesson_date ?? date,
    start: first.start_time ?? start,
    end: first.end_time ?? undefined,
    title: first.plan_title ?? undefined,
    phases: data.map((r: any) => ({
      key: r.phase_key,
      title: r.title ?? "",
      timeMin: r.duration_min ?? 0,
    })),
    updatedAt: first.updated_at,
  };
}
