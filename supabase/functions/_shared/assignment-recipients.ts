// Úkol „jen pro vybrané žáky“: služba obchází RLS, proto příjemce filtrujeme ručně.
// Bez řádků v assignment_recipients = celá třída/skupina (beze změny).

/** Čistá funkce: ponechá jen vybrané žáky, pokud výběr existuje. */
export function filterToRecipients(studentIds: string[], recipientIds: string[] | null): string[] {
  if (!recipientIds || recipientIds.length === 0) return studentIds;
  const set = new Set(recipientIds);
  return studentIds.filter((id) => set.has(id));
}

// deno-lint-ignore no-explicit-any
export async function loadRecipients(db: any, assignmentId: string): Promise<string[] | null> {
  const { data, error } = await db.from("assignment_recipients").select("student_id").eq("assignment_id", assignmentId);
  if (error) throw new Error(`recipients: ${error.message}`);
  const ids = ((data ?? []) as { student_id: string }[]).map((r) => r.student_id);
  return ids.length ? ids : null;
}
