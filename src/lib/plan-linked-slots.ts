/** Čisté pomocné funkce pro termíny plánu hodiny (`lesson_plans.input_data.linkedSlots`). */
export interface PlanLinkedSlot {
  subject?: string;
  classId?: string;
  groupId?: string;
  className?: string;
  date?: string;
  time?: string;
}

export interface SlotContext {
  /** yyyy-MM-dd */
  date: string;
  isGroup: boolean;
  contextId?: string;
  /** Předmět v malých písmenech bez mezer okolo. */
  subjectKey: string;
}

/** Patří termín ke stejné hodině (datum + třída/skupina + předmět)? */
export function slotMatches(s: PlanLinkedSlot, ctx: SlotContext): boolean {
  if (s.date !== ctx.date) return false;
  const targetOk = ctx.isGroup
    ? s.groupId === ctx.contextId || (!s.classId && !s.groupId)
    : s.classId === ctx.contextId || (!s.classId && !s.groupId);
  if (!targetOk) return false;
  return !s.subject || s.subject.trim().toLowerCase() === ctx.subjectKey;
}

/** Vrátí termíny bez těch, které patří k dané hodině. */
export function removeSlotsForLesson(slots: PlanLinkedSlot[] | undefined, ctx: SlotContext): PlanLinkedSlot[] {
  return (slots ?? []).filter((s) => !slotMatches(s, ctx));
}

/** Nové `input_data` bez termínu dané hodiny; ostatní pole zachová. Vrací null, pokud se nic nemění. */
export function inputDataWithoutLesson<T extends { linkedSlots?: PlanLinkedSlot[] }>(
  inputData: T | null | undefined,
  ctx: SlotContext,
): (T & { linkedSlots: PlanLinkedSlot[] }) | null {
  const current = inputData?.linkedSlots ?? [];
  const next = removeSlotsForLesson(current, ctx);
  if (next.length === current.length) return null;
  return { ...(inputData as T), linkedSlots: next };
}

/** Proběhlé hodiny nabízené v dialogu přiřazení: posledních `weeks` týdnů (od nejnovější), plus právě zvolené datum. */
export function assignablePastLessons<T extends { start: Date }>(past: T[], now: Date, keepDate?: string, weeks = 8): T[] {
  const from = now.getTime() - weeks * 7 * 86400000;
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return past
    .filter((e) => e.start.getTime() <= now.getTime() && (e.start.getTime() >= from || key(e.start) === keepDate))
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

/** Začátek aktuálního pololetí: září–leden → 1. 9., únor–srpen → 1. 2. (lokální čas). */
export function semesterStart(now: Date): Date {
  const m = now.getMonth();
  if (m >= 8) return new Date(now.getFullYear(), 8, 1);
  if (m === 0) return new Date(now.getFullYear() - 1, 8, 1);
  return new Date(now.getFullYear(), 1, 1);
}

/**
 * Proběhlé hodiny nabízené v dialogu přiřazení: celé aktuální pololetí (od nejnovější),
 * bez zrušených/neodučených hodin; právě zvolené datum zůstane vždy.
 */
export function assignableLessonDates<T extends { start: Date; scheduleStatus?: string | null }>(
  past: T[],
  now: Date,
  keepDate?: string,
): T[] {
  const from = semesterStart(now).getTime();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const notHeld = (s?: string | null) => s === "cancelled" || s === "moved_from" || s === "replaced";
  return past
    .filter((e) => e.start.getTime() <= now.getTime() && !notHeld(e.scheduleStatus))
    .filter((e) => e.start.getTime() >= from || key(e.start) === keepDate)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}
