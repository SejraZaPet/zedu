import { supabase } from "@/integrations/supabase/client";

export interface PendingTermsAcceptance { version: string; acceptedAt: string }

/** Souhlas uložený při registraci v registračních údajích účtu; null = není co zapisovat. */
export function pendingTermsAcceptance(meta: Record<string, unknown> | null | undefined): PendingTermsAcceptance | null {
  const v = meta?.terms_version;
  if (typeof v !== "string" || !v.trim() || v.length > 20) return null;
  const at = typeof meta?.terms_accepted_at === "string" ? Date.parse(meta.terms_accepted_at as string) : NaN;
  const acceptedAt = Number.isFinite(at) && at <= Date.now() ? new Date(at).toISOString() : new Date().toISOString();
  return { version: v.trim(), acceptedAt };
}

const done = new Set<string>();

/** Po přihlášení zapíše doklad o souhlasu do terms_acceptances (idempotentně, chyby ignoruje). */
export async function recordTermsAcceptance(userId: string, meta: Record<string, unknown> | null | undefined) {
  const p = pendingTermsAcceptance(meta);
  if (!p) return;
  const key = `${userId}:${p.version}`;
  if (done.has(key)) return;
  done.add(key);
  const { error } = await supabase
    .from("terms_acceptances")
    .upsert({ user_id: userId, terms_version: p.version, accepted_at: p.acceptedAt }, { onConflict: "user_id,terms_version", ignoreDuplicates: true });
  if (error) done.delete(key);
}
