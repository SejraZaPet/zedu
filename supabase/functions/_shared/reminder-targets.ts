/** Čistá logika auto-připomínek (sdílí edge funkce i vitest). */
export interface ReminderAssignment {
  class_id?: string | null;
  group_id?: string | null;
  deadline?: string | null;
  settings?: any;
  worksheet_id?: string | null;
  activity_data?: unknown;
  is_portfolio_task?: boolean | null;
}

/** Odkud vzít žáky: skupina má přednost (class_id XOR group_id), jinak třída. */
export function reminderMemberSource(a: ReminderAssignment):
  | { table: "subject_group_members"; idColumn: "group_id"; userColumn: "student_id"; id: string }
  | { table: "class_members"; idColumn: "class_id"; userColumn: "user_id"; id: string }
  | null {
  if (!a?.deadline) return null;
  if (a.group_id) return { table: "subject_group_members", idColumn: "group_id", userColumn: "student_id", id: a.group_id };
  if (a.class_id) return { table: "class_members", idColumn: "class_id", userColumn: "user_id", id: a.class_id };
  return null;
}

/** Plán bez obsahu: připomínka „připrav se“ místo „odevzdej“. */
export function isPlanReminder(a: ReminderAssignment): boolean {
  if (a?.settings?.plan !== true || a.worksheet_id || a.is_portfolio_task) return false;
  return !(Array.isArray(a.activity_data) && a.activity_data.length > 0);
}

export function reminderBody(a: ReminderAssignment & { title: string }, dueDateLabel: string): string {
  return isPlanReminder(a)
    ? `Blíží se „${a.title}" (${dueDateLabel}). Připrav se včas.`
    : `Tvůj úkol „${a.title}" má termín ${dueDateLabel}. Odevzdej ho prosím včas.`;
}
