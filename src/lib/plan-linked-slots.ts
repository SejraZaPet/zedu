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
