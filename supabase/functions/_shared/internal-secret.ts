// Fetches internal shared secrets from Supabase Vault via the
// `public.get_internal_secret` SECURITY DEFINER RPC. Restricted to service_role.
// Values are cached in-memory for the lifetime of the isolate.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const _cache = new Map<string, string>();

export async function getInternalSecret(
  name: "notify_parent_internal_secret" | "send_push_internal_secret" | "cron_internal_secret",
): Promise<string | null> {
  const cached = _cache.get(name);
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const admin = createClient(url, key);
  const { data, error } = await admin.rpc("get_internal_secret", { _name: name });
  if (error || !data) {
    console.error("[getInternalSecret] failed", name, error?.message);
    return null;
  }
  _cache.set(name, data as string);
  return data as string;
}
