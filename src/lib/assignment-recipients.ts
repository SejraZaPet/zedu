import { supabase } from "@/integrations/supabase/client";

/**
 * Úkol/materiál „jen pro vybrané žáky“.
 * Prázdný seznam příjemců = celá třída/skupina (dnešní chování).
 * Oprávnění hlídá DB (RLS `recipients_only`); tady je jen čistá logika a UI pomocníci.
 */
export type AudienceMode = "all" | "selected";

/** Výběr žáků nabízíme jen u úkolů a materiálů, ne u oznámení. */
export function audienceAllowed(kind: string | null | undefined): boolean {
  return kind === "task" || kind === "material" || kind == null;
}

/** Efektivní příjemci = členové (bez testovacích žáků), případně průnik s vybranými. */
export function effectiveRecipients(
  memberIds: string[],
  recipientIds: string[] | null | undefined,
  previewIds: Iterable<string> = [],
): string[] {
  const preview = new Set(previewIds);
  const members = [...new Set(memberIds)].filter((id) => !preview.has(id));
  if (!recipientIds || recipientIds.length === 0) return members;
  const chosen = new Set(recipientIds);
  return members.filter((id) => chosen.has(id));
}

/** Rozdíl pro uložení: koho přidat, koho odebrat. */
export function recipientDiff(current: string[], next: string[]): { add: string[]; remove: string[] } {
  const cur = new Set(current);
  const nxt = new Set(next);
  return {
    add: [...nxt].filter((id) => !cur.has(id)),
    remove: [...cur].filter((id) => !nxt.has(id)),
  };
}

/** Chybová hláška pro formulář, nebo null. */
export function audienceError(mode: AudienceMode, selectedCount: number, targetCount: number): string | null {
  if (mode !== "selected") return null;
  if (targetCount !== 1) return "Výběr žáků jde jen u jedné třídy nebo skupiny.";
  if (selectedCount === 0) return "Vyberte alespoň jednoho žáka.";
  return null;
}

/** Žák, který odevzdal, ale už není mezi příjemci (učitel jeho práci dál vidí). */
export function isFormerRecipient(studentId: string, recipientIds: string[] | null | undefined): boolean {
  return !!recipientIds && recipientIds.length > 0 && !recipientIds.includes(studentId);
}

/** Načte příjemce pro seznam úkolů (jen úkoly s výběrem mají záznam). */
export async function fetchRecipientsMap(assignmentIds: string[]): Promise<Record<string, string[]>> {
  if (assignmentIds.length === 0) return {};
  const { data } = await supabase
    .from("assignment_recipients" as any)
    .select("assignment_id, student_id")
    .in("assignment_id", assignmentIds);
  const map: Record<string, string[]> = {};
  for (const r of ((data ?? []) as any[])) (map[r.assignment_id] ??= []).push(r.student_id);
  return map;
}

/** Uloží výběr (smaže odebrané, přidá nové). Volat PŘED zveřejněním. */
export async function syncRecipients(assignmentId: string, next: string[]): Promise<void> {
  const current = (await fetchRecipientsMap([assignmentId]))[assignmentId] ?? [];
  const { add, remove } = recipientDiff(current, next);
  if (remove.length) {
    const { error } = await supabase
      .from("assignment_recipients" as any)
      .delete()
      .eq("assignment_id", assignmentId)
      .in("student_id", remove);
    if (error) throw error;
  }
  if (add.length) {
    const { error } = await supabase
      .from("assignment_recipients" as any)
      .insert(add.map((student_id) => ({ assignment_id: assignmentId, student_id })) as any);
    if (error) throw new Error("Vybrané žáky se nepodařilo uložit. Jsou stále ve třídě nebo skupině?");
  }
}
