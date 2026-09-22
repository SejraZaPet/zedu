import { supabase } from "@/integrations/supabase/client";
import { parseMaterials, type AssignmentMaterial } from "@/lib/assignment-materials";
import type { LessonSource } from "@/lib/linked-lesson";

export interface StudentPlanPhase {
  key: string;
  title: string;
  timeMin: number | null;
  description: string;
}

export interface StudentPlanWorksheet {
  id: string;
  title: string;
}

export interface StudentLessonPlan {
  id: string;
  title: string;
  description: string;
  subject: string;
  /** Datum navázané hodiny (YYYY-MM-DD), pokud plán termín má. */
  date: string | null;
  /** Čas navázané hodiny ve tvaru „HH:mm-HH:mm“ nebo „HH:mm“. */
  time: string | null;
  phases: StudentPlanPhase[];
  materials: AssignmentMaterial[];
  lessonId: string | null;
  lessonSource: LessonSource | null;
  worksheets: StudentPlanWorksheet[];
}

const PHASE_TITLES: Record<string, string> = {
  uvod: "Úvod",
  motivace: "Motivace",
  hlavni: "Hlavní část",
  procviceni: "Procvičení",
  reflexe: "Reflexe",
  zaver: "Závěr",
};

const PHASE_ORDER = Object.keys(PHASE_TITLES);

/** Převede uložené fáze plánu na seznam, který uvidí žák (prázdné fáze vynechá). */
export function studentPhasesFromInput(input: unknown): StudentPlanPhase[] {
  if (!input || typeof input !== "object") return [];
  const raw = input as Record<string, { timeMin?: string | number; description?: string }>;
  const keys = Object.keys(raw).sort((a, b) => {
    const ia = PHASE_ORDER.indexOf(a);
    const ib = PHASE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const out: StudentPlanPhase[] = [];
  for (const key of keys) {
    const value = raw[key];
    if (!value) continue;
    const description = (value.description ?? "").trim();
    const minutes = Number(value.timeMin);
    const timeMin = Number.isFinite(minutes) && minutes > 0 ? minutes : null;
    if (!description && timeMin === null) continue;
    out.push({ key, title: PHASE_TITLES[key] ?? key, timeMin, description });
  }
  return out;
}

/** Normalizuje čas na „HH:mm“ pro porovnání s hodinou v rozvrhu. */
export function planStartTime(time: string | null): string | null {
  if (!time) return null;
  const start = time.split("-")[0]?.trim() ?? "";
  const match = start.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/** Klíč pro spárování plánu s hodinou v rozvrhu. */
export function planSlotKey(date: string | null, time: string | null): string | null {
  const start = planStartTime(time);
  if (!date || !start) return null;
  return `${date}|${start}`;
}

interface FetchArgs {
  classId?: string;
  groupId?: string;
  subjectLabel?: string;
}

/**
 * Zveřejněné plány hodin pro třídu nebo skupinu žáka. Pravidla přístupu v databázi
 * zajišťují, že se vrátí jen plány, které učitel žákům zobrazil.
 */
export async function fetchStudentLessonPlans({
  classId,
  groupId,
  subjectLabel,
}: FetchArgs): Promise<StudentLessonPlan[]> {
  if (!classId && !groupId) return [];

  let query = supabase
    .from("lesson_plans")
    .select(
      "id, title, subject, input_data, materials, lesson_ref_id, lesson_source, worksheet_ids",
    )
    .eq("visible_to_students", true);
  query = groupId ? query.eq("group_id", groupId) : query.eq("class_id", classId!);

  const { data, error } = await query;
  if (error || !data) return [];

  const labelKey = (subjectLabel ?? "").trim().toLowerCase();
  const plans: StudentLessonPlan[] = [];

  for (const row of data as any[]) {
    const input = (row.input_data ?? {}) as any;
    const subject = (input.subject || row.subject || "").trim();
    if (labelKey && subject.trim().toLowerCase() !== labelKey) continue;
    plans.push({
      id: row.id,
      title: row.title || "Plán hodiny",
      description: (input.description ?? "").trim(),
      subject,
      date: input.linkedDate || null,
      time: input.linkedTime || null,
      phases: studentPhasesFromInput(input.phases),
      materials: parseMaterials(row.materials),
      lessonId: row.lesson_ref_id ?? input.lessonId ?? null,
      lessonSource: (row.lesson_source as LessonSource | null) ?? null,
      worksheets: [],
    });
  }

  // Pracovní listy: připnuté u plánu nebo vytvořené ze stejné lekce.
  const pinned = new Set<string>();
  const lessonIds = new Set<string>();
  (data as any[]).forEach((row) => {
    ((row.worksheet_ids ?? []) as string[]).forEach((w) => pinned.add(w));
    if (row.lesson_ref_id) lessonIds.add(row.lesson_ref_id);
  });

  if (pinned.size > 0 || lessonIds.size > 0) {
    const filters: string[] = [];
    if (pinned.size > 0) filters.push(`id.in.(${[...pinned].join(",")})`);
    if (lessonIds.size > 0) filters.push(`source_lesson_id.in.(${[...lessonIds].join(",")})`);
    const { data: sheets } = await supabase
      .from("worksheets")
      .select("id, title, source_lesson_id, status")
      .eq("status", "published")
      .or(filters.join(","));

    const byId = new Map<string, any>();
    const byLesson = new Map<string, any[]>();
    for (const w of (sheets as any[]) ?? []) {
      byId.set(w.id, w);
      if (w.source_lesson_id) {
        const arr = byLesson.get(w.source_lesson_id) ?? [];
        arr.push(w);
        byLesson.set(w.source_lesson_id, arr);
      }
    }

    const rowById = new Map((data as any[]).map((r) => [r.id, r]));
    for (const plan of plans) {
      const row = rowById.get(plan.id);
      const list: StudentPlanWorksheet[] = [];
      const seen = new Set<string>();
      for (const id of ((row?.worksheet_ids ?? []) as string[])) {
        const w = byId.get(id);
        if (w && !seen.has(w.id)) {
          seen.add(w.id);
          list.push({ id: w.id, title: w.title || "Pracovní list" });
        }
      }
      for (const w of byLesson.get(row?.lesson_ref_id) ?? []) {
        if (!seen.has(w.id)) {
          seen.add(w.id);
          list.push({ id: w.id, title: w.title || "Pracovní list" });
        }
      }
      plan.worksheets = list;
    }
  }

  return plans;
}
