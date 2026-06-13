// Shared auth helpers for edge functions.
// All Lovable-managed edge functions deploy with verify_jwt=false by default,
// so we must validate the JWT in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthResult =
  | { ok: true; userId: string; isServiceRole: boolean; authHeader: string }
  | { ok: false; status: number; body: { error: string } };

/**
 * Validate the incoming Authorization header.
 * - Accepts a Supabase user JWT (validated via getClaims)
 * - Optionally accepts the SUPABASE_SERVICE_ROLE_KEY as a bearer token (server-to-server)
 */
export async function requireAuth(
  req: Request,
  opts: { allowServiceRole?: boolean } = {}
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  if (opts.allowServiceRole) {
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (srk && token === srk) {
      return { ok: true, userId: "service_role", isServiceRole: true, authHeader };
    }
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await sb.auth.getClaims(token);
  const userId = data?.claims?.sub as string | undefined;
  if (error || !userId) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  return { ok: true, userId, isServiceRole: false, authHeader };
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return !!data;
}
