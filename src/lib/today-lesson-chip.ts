/** Pomocné funkce pro kompaktní mobilní řádek dnešní hodiny (jen prezentace). */

export const subjectAbbreviation = (abbreviation: string | null | undefined, name: string): string => {
  const abbr = abbreviation?.trim();
  if (abbr) return abbr;
  const letters = (name ?? "").replace(/[^\p{L}]/gu, "");
  return (letters.slice(0, 3) || "?").toLocaleUpperCase("cs-CZ");
};

/** Stabilní záložní barva podle názvu (tmavší odstín kvůli bílému textu). */
export const fallbackSubjectColor = (name: string): string => {
  let hash = 0;
  for (const ch of name ?? "") hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return `hsl(${hash % 360} 55% 38%)`;
};

export const subjectChipColor = (color: string | null | undefined, name: string): string =>
  color?.trim() ? color.trim() : fallbackSubjectColor(name);

const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "8:50–9:35" – bez mezer kolem pomlčky. */
export const compactTimeRange = (start: Date, end: Date): string => `${hm(start)}–${hm(end)}`;

export type LessonPhase = "past" | "current" | "future";

export const lessonPhaseLabel = (phase: LessonPhase): string | null =>
  phase === "past" ? "hotovo" : phase === "current" ? "právě teď" : null;
