import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_CONSENT_VERSION } from "../../supabase/functions/_shared/demo-contact";

export { DEMO_CONSENT_TEXT, DEMO_CONSENT_VERSION, showCountdown, normalizeDemoEmail, demoCountdownText, demoExtendedText } from "../../supabase/functions/_shared/demo-contact";

export const DEMO_SAVE_OFFERED_KEY = "Bezli:demo-save-offered";

export interface DemoStatus {
  deletesAt: string | null;
  daysLeft: number | null;
  extended: boolean;
  hasContact: boolean;
  emailMasked: string | null;
}

/** Stav ze serveru (termín + kontakt), aby se dialog neukázal znovu na jiném zařízení. */
export function useDemoStatus(enabled: boolean) {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const rpc = (supabase.rpc as any).bind(supabase);
    const [e, c] = await Promise.all([rpc("get_my_demo_expiry"), rpc("get_my_demo_contact_status")]);
    const er = Array.isArray(e.data) ? e.data[0] : null;
    const cr = Array.isArray(c.data) ? c.data[0] : null;
    setStatus({
      deletesAt: er?.deletes_at ?? null, daysLeft: er?.days_left ?? null, extended: !!er?.extended,
      hasContact: !!cr?.has_contact, emailMasked: cr?.email_masked ?? null,
    });
  }, [enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return { status, reload };
}

async function invokeSave(body: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke("demo-save-contact", { body });
  if (error) {
    let msg = "Něco se nepovedlo. Zkuste to prosím znovu.";
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
}
export const saveDemoContact = (email: string) => invokeSave({ action: "save", email, consent: true, consent_version: DEMO_CONSENT_VERSION });
export const deleteDemoContact = () => invokeSave({ action: "delete" });

export async function extendDemoOnce() {
  const { data, error } = await (supabase.rpc as any)("demo_extend_once");
  if (error) {
    throw new Error(/Already/.test(error.message)
      ? "Prodloužení už jste využili."
      : "Prodloužení se nepodařilo. Zkontrolujte připojení a zkuste to prosím znovu.");
  }
  return data as string;
}

/** Má návštěvník (učitel) aspoň jednu vlastní položku? Seed se nepočítá. */
export async function hasOwnDemoContent(uid: string): Promise<boolean> {
  const head = { count: "exact" as const, head: true };
  const checks = await Promise.all([
    supabase.from("worksheets").select("id", head).eq("teacher_id", uid).eq("is_demo_seed", false),
    supabase.from("teacher_presentations").select("id", head).eq("teacher_id", uid).eq("is_demo_seed", false),
    supabase.from("teacher_game_templates").select("id", head).eq("teacher_id", uid).is("demo_seed_key", null),
    supabase.from("teacher_textbooks").select("id", head).eq("teacher_id", uid).eq("is_demo_seed", false),
  ]);
  return checks.some((r) => (r.count ?? 0) > 0);
}
