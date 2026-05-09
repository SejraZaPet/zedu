import { supabase } from "@/integrations/supabase/client";

/**
 * Records an administrative action into the audit_log table.
 * Fire-and-forget: errors are logged to console but never thrown.
 */
export async function logAudit(
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, any>
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const actorId = auth?.user?.id ?? null;

    const { error } = await supabase.from("audit_log" as any).insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? {},
    });

    if (error) {
      console.warn("[audit] failed to log:", action, error.message);
    }
  } catch (e: any) {
    console.warn("[audit] exception:", e?.message ?? e);
  }
}
