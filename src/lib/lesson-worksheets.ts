/**
 * Pracovní listy zobrazené žákům přímo u lekce (`worksheets.show_in_lesson`).
 * Přístup hlídá databáze (politika „Students can read worksheets shown in lesson“);
 * tady jen druhá pojistka na klientu a párování s úkolem, aby se pokus nezdvojil.
 */
export interface LessonWorksheetRow {
  id: string;
  title: string;
  status: string;
  show_in_lesson: boolean | null;
  scheduled_publish_at: string | null;
  source_lesson_id: string | null;
}

export interface LessonWorksheetAssignment {
  id: string;
  worksheet_id: string | null;
  deadline: string | null;
  status: string;
}

export function isShownInLesson(w: LessonWorksheetRow, lessonId: string, nowMs = Date.now()): boolean {
  if (w.source_lesson_id !== lessonId) return false;
  if (w.show_in_lesson !== true) return false;
  if (w.status !== "published") return false;
  if (w.scheduled_publish_at && new Date(w.scheduled_publish_at).getTime() > nowMs) return false;
  return true;
}

export function pickLessonWorksheets(rows: LessonWorksheetRow[], lessonId: string, nowMs = Date.now()) {
  return rows.filter((w) => isShownInLesson(w, lessonId, nowMs));
}

/** Publikovaný úkol k listu: nejbližší budoucí termín, jinak nejnovější. */
export function assignmentForWorksheet(
  worksheetId: string,
  assignments: LessonWorksheetAssignment[],
  nowMs = Date.now(),
): LessonWorksheetAssignment | null {
  const list = assignments.filter((a) => a.worksheet_id === worksheetId && a.status === "published");
  if (!list.length) return null;
  const ts = (a: LessonWorksheetAssignment) => (a.deadline ? new Date(a.deadline).getTime() : Infinity);
  const upcoming = list.filter((a) => ts(a) >= nowMs).sort((a, b) => ts(a) - ts(b));
  if (upcoming.length) return upcoming[0];
  return list.sort((a, b) => ts(b) - ts(a))[0];
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return "bez termínu";
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
