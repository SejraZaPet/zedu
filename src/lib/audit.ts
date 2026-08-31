import { supabase } from "@/integrations/supabase/client";

/**
 * Zapíše administrativní akci do auditu.
 *
 * Zápis probíhá výhradně přes serverovou funkci `log_audit_event`, která
 * záznam vždy podepíše skutečným přihlášeným uživatelem a povolí ho jen
 * adminovi, školnímu adminovi nebo učiteli. Přímý INSERT z klienta je
 * zakázaný (jinak by šlo falšovat i „systémové“ záznamy bez autora).
 *
 * Fire-and-forget: chyby se jen logují do konzole.
 */
export async function logAudit(
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit_event" as any, {
      _action: action,
      _target_type: targetType,
      _target_id: targetId,
      _details: details ?? {},
    });

    if (error) {
      console.warn("[audit] failed to log:", action, error.message);
    }
  } catch (e: any) {
    console.warn("[audit] exception:", e?.message ?? e);
  }
}
