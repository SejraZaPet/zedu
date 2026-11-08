/**
 * Více lekcí u MATERIÁLU (settings.lessons, stejný tvar jako u plánů).
 * Úkol zůstává s jednou lekcí v lesson_id/lesson_source.
 */
import { planLessons, type PlanLesson } from "@/lib/planned-assignment";
import { assignmentKind, type AssignmentKind } from "@/lib/assignment-kind";

export interface MaterialWorksheet { id: string; title: string }

/** Only materials read the list; legacy primary ID always remains first. */
export function assignmentWorksheets(a: { worksheet_id?: string | null; settings?: unknown }): MaterialWorksheet[] {
  const settings = a.settings as { worksheets?: unknown } | null;
  const list: MaterialWorksheet[] = [];
  if (assignmentKind(a.settings) === "material" && Array.isArray(settings?.worksheets)) {
    for (const entry of settings.worksheets) {
      if (entry && typeof entry.id === "string" && entry.id && !list.some((w) => w.id === entry.id)) {
        list.push({ id: entry.id, title: typeof entry.title === "string" && entry.title ? entry.title : "Pracovní list" });
      }
    }
  }
  if (a.worksheet_id && list[0]?.id !== a.worksheet_id) {
    const primary = list.find((w) => w.id === a.worksheet_id) ?? { id: a.worksheet_id, title: "Pracovní list" };
    return [primary, ...list.filter((w) => w.id !== primary.id)];
  }
  return list;
}

export function addWorksheet(list: MaterialWorksheet[], worksheet: MaterialWorksheet): MaterialWorksheet[] {
  return !worksheet.id || list.some((w) => w.id === worksheet.id) ? list : [...list, worksheet];
}
export const removeWorksheet = (list: MaterialWorksheet[], id: string) => list.filter((w) => w.id !== id);
export function moveWorksheet(list: MaterialWorksheet[], index: number, dir: -1 | 1): MaterialWorksheet[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function worksheetFieldsForSave(kind: AssignmentKind, list: MaterialWorksheet[], singleId: string) {
  return { worksheet_id: kind === "material" ? list[0]?.id ?? null : singleId || null };
}
export function applyWorksheetsToSettings(settings: Record<string, unknown>, kind: AssignmentKind, list: MaterialWorksheet[]) {
  const next = { ...settings };
  if (kind === "material" && list.length) next.worksheets = list.map(({ id, title }) => ({ id, title }));
  else delete next.worksheets;
  return next;
}
export function materialContentLabel(a: { worksheet_id?: string | null; settings?: unknown; lesson_id?: string | null; lesson_source?: string | null }): string {
  const worksheets = assignmentWorksheets(a).length;
  const lessons = assignmentLessons(a).length;
  return [worksheets ? worksheetCountLabel(worksheets) : "", lessons ? lessonCountLabel(lessons) : ""].filter(Boolean).join(", ");
}
export function worksheetCountLabel(n: number): string {
  return n === 1 ? "1 list" : n >= 2 && n <= 4 ? `${n} listy` : `${n} listů`;
}

/** Lekce materiálu: settings.lessons, jinak fallback na lesson_id (starší záznamy). */
export function assignmentLessons(a: any): PlanLesson[] {
  return planLessons(a);
}

export function addLesson(list: PlanLesson[], l: PlanLesson): PlanLesson[] {
  if (!l?.id || list.some((x) => x.id === l.id)) return list;
  return [...list, l];
}

export function removeLesson(list: PlanLesson[], id: string): PlanLesson[] {
  return list.filter((x) => x.id !== id);
}

export function moveLesson(list: PlanLesson[], index: number, dir: -1 | 1): PlanLesson[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * Pole k uložení. Materiál: lesson_id = první lekce, settings.lessons = celé pořadí
 * (při ≤1 lekci se klíč odstraní, aby záznam vypadal jako dřív).
 * Úkol/oznámení: jedna lekce z formuláře, settings.lessons se odstraní (plány chrání applyLessonsToSettings).
 */
export function lessonFieldsForSave(kind: AssignmentKind, materialLessons: PlanLesson[], single: { id: string; source: string | null }) {
  if (kind !== "material") {
    // Úkol/oznámení mají jednu lekci; případný seznam z dřívějšího materiálu se odstraní (u plánů se nesahá).
    return { lesson_id: single.id || null, lesson_source: single.id ? single.source : null, lessons: "remove" as PlanLesson[] | null | "remove" };
  }
  const first = materialLessons[0];
  return {
    lesson_id: first?.id ?? null,
    lesson_source: first ? first.source : null,
    lessons: (materialLessons.length > 1 ? materialLessons : "remove") as PlanLesson[] | "remove",
  };
}

export function applyLessonsToSettings(settings: Record<string, unknown>, lessons: PlanLesson[] | null | "remove", isPlan: boolean) {
  if (lessons === null || isPlan) return settings;
  const next = { ...settings };
  if (lessons === "remove") delete next.lessons;
  else next.lessons = lessons.map((l) => ({ id: l.id, source: l.source, title: l.title }));
  return next;
}

export function lessonCountLabel(n: number): string {
  if (n === 1) return "1 lekce";
  if (n >= 2 && n <= 4) return `${n} lekce`;
  return `${n} lekcí`;
}
