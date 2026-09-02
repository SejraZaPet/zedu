/**
 * Koš pro učebnice (soft delete).
 *
 * Mazání učebnice NIKDY neprovádí přímé DELETE. Nastaví se `deleted_at`
 * a `deleted_by`, takže učebnice zmizí ze seznamů, ale zůstane 30 dní
 * obnovitelná v Koši. Skutečné DELETE se provádí výhradně přes
 * `permanentlyDeleteTextbook()` z Koše (nebo serverovou úlohou
 * `purge_deleted_textbooks`).
 */
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export const TRASH_RETENTION_DAYS = 30;

/** Odloží učebnici do Koše. */
export async function softDeleteTextbook(id: string, title?: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("teacher_textbooks")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: auth?.user?.id ?? null,
    } as any)
    .eq("id", id);
  if (!error) logAudit("textbook_soft_deleted", "textbook", id, { title });
  return { error };
}

/** Obnoví učebnici z Koše. */
export async function restoreTextbook(id: string, title?: string) {
  const { error } = await supabase
    .from("teacher_textbooks")
    .update({ deleted_at: null, deleted_by: null } as any)
    .eq("id", id);
  if (!error) logAudit("textbook_restored", "textbook", id, { title });
  return { error };
}

/** Nevratné smazání – povoleno pouze z Koše. */
export async function permanentlyDeleteTextbook(id: string, title?: string) {
  const { error } = await supabase.from("teacher_textbooks").delete().eq("id", id);
  if (!error) logAudit("textbook_permanently_deleted", "textbook", id, { title });
  return { error };
}

/** Počet dní, které učebnici v Koši zbývají do automatického smazání. */
export function daysLeftInTrash(deletedAt: string | null | undefined): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsed));
}
