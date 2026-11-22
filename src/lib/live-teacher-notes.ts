export interface TeacherNoteTarget {
  slideId?: string;
  index: number;
}

export interface TeacherNoteSlide {
  slideId?: string;
  teacherNotes?: string;
  speakerNotes?: string;
  [key: string]: unknown;
}

/** Poznámky starších AI plánů zůstávají čitelné, nové úpravy ukládáme do teacherNotes. */
export function teacherNotesForSlide(
  slide: { teacherNotes?: string; speakerNotes?: string } | null | undefined,
): string {
  if (!slide) return "";
  if (typeof slide.teacherNotes === "string") return slide.teacherNotes;
  return typeof slide.speakerNotes === "string" ? slide.speakerNotes : "";
}

/**
 * Upraví pouze poznámku jednoho slidu nad čerstvě načtenou řadou.
 * Primárně se zaměřuje stabilním slideId; index je záloha pro staré slidy bez ID.
 */
export function patchTeacherNotes<T extends TeacherNoteSlide>(
  slides: T[],
  target: TeacherNoteTarget,
  notes: string,
): T[] | null {
  const index = target.slideId
    ? slides.findIndex((slide) => slide?.slideId === target.slideId)
    : target.index;
  if (index < 0 || index >= slides.length) return null;
  const next = [...slides];
  next[index] = { ...next[index], teacherNotes: notes };
  return next;
}

const storagePrefix = "bezli.live-teacher-notes-collapsed.";

export function loadTeacherNotesCollapsed(teacherId: string | undefined): boolean {
  if (!teacherId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${storagePrefix}${teacherId}`) === "1";
  } catch {
    return false;
  }
}

export function saveTeacherNotesCollapsed(teacherId: string | undefined, collapsed: boolean): void {
  if (!teacherId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${storagePrefix}${teacherId}`, collapsed ? "1" : "0");
  } catch {
    // Soukromý režim prohlížeče nesmí blokovat promítání.
  }
}
