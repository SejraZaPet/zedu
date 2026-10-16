/**
 * Plán testu/úkolu pro třídu nebo skupinu (z dialogu „Přidat úkol“).
 * Ukládá se jako běžná zveřejněná úloha (status "published") bez obsahu;
 * obsah učitel připojí později v úpravě úlohy. Plán = settings.plan + chybějící obsah.
 */
import type { ExamType } from "@/lib/exam-types";

export type PlanKind = "test" | "pisemka" | "ukol" | "projekt";

export const PLAN_KINDS: { id: PlanKind; label: string; examType: ExamType | null }[] = [
  { id: "test", label: "Test", examType: "digitalni" },
  { id: "pisemka", label: "Písemka", examType: "pisemne" },
  { id: "ukol", label: "Úkol", examType: null },
  { id: "projekt", label: "Projekt", examType: "projekt" },
];

export interface PlanLesson { id: string; source: "textbook_lessons" | "teacher_textbook_lessons"; title: string }

export interface PlanForm {
  /** "class:<uuid>" nebo "group:<uuid>" */
  target: string;
  subjectId: string | null;
  kind: PlanKind;
  title: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  note: string;
  lessons: PlanLesson[];
}

/** Rozloží výběr cíle na class_id XOR group_id. */
export function parsePlanTarget(target: string): { class_id: string | null; group_id: string | null } | null {
  const m = /^(class|group):(.+)$/.exec(target || "");
  if (!m || !m[2].trim()) return null;
  return m[1] === "class" ? { class_id: m[2], group_id: null } : { class_id: null, group_id: m[2] };
}

/** Termín jako ISO; null při neplatném datu. */
export function planDeadlineIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = /^\d{1,2}:\d{2}$/.test(time || "") ? time.split(":").map(Number) : [8, 0];
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (Number.isNaN(dt.getTime()) || dt.getMonth() !== mo - 1) return null;
  return dt.toISOString();
}

/** Chybové hlášky formuláře (prázdné pole = v pořádku). */
export function validatePlanForm(f: PlanForm, now: Date = new Date()): string[] {
  const errors: string[] = [];
  if (!parsePlanTarget(f.target)) errors.push("Vyberte třídu nebo skupinu.");
  if (!PLAN_KINDS.some((k) => k.id === f.kind)) errors.push("Vyberte typ.");
  if (!f.title.trim()) errors.push("Zadejte název.");
  const iso = planDeadlineIso(f.date, f.time);
  if (!iso) errors.push("Zadejte termín.");
  else if (new Date(iso).getTime() < now.getTime()) errors.push("Termín musí být v budoucnosti.");
  return errors;
}

/** Záznam do assignments – zveřejněná úloha bez obsahu. */
export function buildPlanInsert(f: PlanForm, teacherId: string) {
  const target = parsePlanTarget(f.target)!;
  const kind = PLAN_KINDS.find((k) => k.id === f.kind)!;
  const lessons = dedupeLessons(f.lessons);
  return {
    teacher_id: teacherId,
    title: f.title.trim(),
    description: f.note.trim(),
    status: "published",
    deadline: planDeadlineIso(f.date, f.time),
    class_id: target.class_id,
    group_id: target.group_id,
    subject_id: f.subjectId || null,
    exam_type: kind.examType,
    activity_data: [],
    lesson_id: lessons[0]?.id ?? null,
    lesson_source: lessons[0]?.source ?? null,
    settings: { plan: true, lessons },
  };
}

function dedupeLessons(list: PlanLesson[]): PlanLesson[] {
  const seen = new Set<string>();
  return (list || []).filter((l) => l?.id && !seen.has(l.id) && (seen.add(l.id), true));
}

/** Lekce plánu (settings.lessons), s fallbackem na lesson_id. */
export function planLessons(a: any): PlanLesson[] {
  const raw = a?.settings?.lessons;
  if (Array.isArray(raw)) {
    const ok = raw.filter((l: any) => l && typeof l.id === "string")
      .map((l: any) => ({ id: l.id, source: l.source === "textbook_lessons" ? "textbook_lessons" : "teacher_textbook_lessons", title: String(l.title || "Lekce") } as PlanLesson));
    if (ok.length) return dedupeLessons(ok);
  }
  return a?.lesson_id ? [{ id: a.lesson_id, source: a.lesson_source === "textbook_lessons" ? "textbook_lessons" : "teacher_textbook_lessons", title: "Lekce" }] : [];
}

/** Plán, ke kterému zatím není připojen obsah – žák nemá co odevzdat. */
export function isPlanWithoutContent(a: any): boolean {
  if (!a || a.settings?.plan !== true) return false;
  if (a.worksheet_id || a.lesson_plan_id || a.is_portfolio_task) return false;
  const data = a.activity_data;
  return !(Array.isArray(data) && data.length > 0);
}

/** Blok „Co nás čeká“: budoucí termíny (od začátku dneška) vzestupně, max `limit`. */
export function upcomingForSubject<T extends { deadline: string | null }>(items: T[], now: Date = new Date(), limit = 5): T[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (items || [])
    .filter((a) => a.deadline && !Number.isNaN(new Date(a.deadline).getTime()) && new Date(a.deadline).getTime() >= start)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, limit);
}
