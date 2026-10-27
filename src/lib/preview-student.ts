import { supabase } from "@/integrations/supabase/client";

/** Uložená relace admina (jen tato záložka) pro „Zpět na admina“. */
export const PREVIEW_RETURN_KEY = "bezli.previewStudent.return";

export function isPreviewStudentSession(): boolean {
  try { return !!window.sessionStorage.getItem(PREVIEW_RETURN_KEY); } catch { return false; }
}

export async function switchToPreviewStudent(): Promise<void> {
  const { data: cur } = await supabase.auth.getSession();
  const s = cur.session;
  if (!s) throw new Error("Nejste přihlášen(a).");
  const { data, error } = await supabase.functions.invoke("preview-student-switch", { body: {} });
  if (error || !data?.session) {
    let msg = "Přepnutí na testovacího žáka se nepodařilo.";
    try { const j = await (error as any)?.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(data?.error || msg);
  }
  window.sessionStorage.setItem(PREVIEW_RETURN_KEY, JSON.stringify({
    access_token: s.access_token, refresh_token: s.refresh_token,
  }));
  try { window.localStorage.removeItem("zedu_view_as_role"); } catch { /* ignore */ }
  const { error: setErr } = await supabase.auth.setSession(data.session);
  if (setErr) {
    window.sessionStorage.removeItem(PREVIEW_RETURN_KEY);
    throw new Error("Přepnutí na testovacího žáka se nepodařilo.");
  }
}

/** Obnoví relaci admina. Vrací false, pokud ji nelze obnovit (pak je nutné přihlášení). */
export async function returnFromPreviewStudent(): Promise<boolean> {
  let saved: { access_token: string; refresh_token: string } | null = null;
  try { saved = JSON.parse(window.sessionStorage.getItem(PREVIEW_RETURN_KEY) || "null"); } catch { saved = null; }
  window.sessionStorage.removeItem(PREVIEW_RETURN_KEY);
  if (!saved) { await supabase.auth.signOut(); return false; }
  const { error } = await supabase.auth.setSession(saved);
  if (error) { await supabase.auth.signOut(); return false; }
  return true;
}
