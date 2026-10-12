/** Ikonky a zvýraznění řádků hodin v záložce Průběh (učitel i žák). Jen čtení. */
export interface BadgeAssignment {
  id: string;
  deadline: string | null;
  lesson_id?: string | null;
  worksheet_id?: string | null;
}

export interface RowBadges {
  attachments: number;
  worksheets: number;
  assignment: { deadline: string | null } | null;
}

/** Hodina je dnes (podle data začátku) a ještě neskončila — včetně probíhající. */
export function isTodayLesson(e: { start: Date; end: Date }, now: Date): boolean {
  return e.start.toDateString() === now.toDateString() && e.end.getTime() >= now.getTime();
}

/** Nadcházející = ještě neskončila (probíhající hodina sem patří, minulé ne). */
export function isUpcomingLesson(e: { end: Date }, now: Date): boolean {
  return e.end.getTime() >= now.getTime();
}

export function computeRowBadges(input: {
  topicMaterials?: number;
  planMaterials?: number;
  planWorksheetIds?: string[];
  lessonWorksheetIds?: string[];
  lessonId?: string | null;
  assignments?: BadgeAssignment[];
}): RowBadges {
  const ws = new Set([...(input.planWorksheetIds ?? []), ...(input.lessonWorksheetIds ?? [])]);
  const matches = (input.assignments ?? []).filter(
    (a) =>
      (!!input.lessonId && a.lesson_id === input.lessonId) ||
      (!!a.worksheet_id && ws.has(a.worksheet_id)),
  );
  const deadlines = matches.map((a) => a.deadline).filter(Boolean) as string[];
  deadlines.sort();
  return {
    attachments: (input.topicMaterials ?? 0) + (input.planMaterials ?? 0),
    worksheets: ws.size,
    assignment: matches.length ? { deadline: deadlines[0] ?? null } : null,
  };
}

export function pluralAttachments(n: number): string {
  if (n === 1) return "1 příloha";
  if (n >= 2 && n <= 4) return `${n} přílohy`;
  return `${n} příloh`;
}

export function worksheetLabel(n: number): string {
  if (n === 1) return "Pracovní list";
  if (n >= 2 && n <= 4) return `${n} pracovní listy`;
  return `${n} pracovních listů`;
}

export function assignmentLabel(deadline: string | null): string {
  if (!deadline) return "Úkol";
  const d = new Date(deadline);
  return `Úkol do ${d.getDate()}. ${d.getMonth() + 1}.`;
}
