// Návrat do demo účtu podle návratového kódu (vrací relaci učitele dvojice).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient, constantTimeEqual, countRecent, ipHash, issueSession, normalizeCode, recordEvent,
} from "../_shared/demo.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GENERIC = "Kód se nepodařilo ověřit. Zkontrolujte ho a zkuste to znovu.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: GENERIC }, 405);

  const db = adminClient();
  const hash = await ipHash(req);
  if ((await countRecent(db, "restore", 60 * 1000, hash)) >= 10) {
    return json({ error: "Příliš mnoho pokusů. Počkejte prosím minutu." }, 429);
  }
  await recordEvent(db, "restore", hash);

  const body = await req.json().catch(() => ({}));
  const code = normalizeCode(body?.code);
  const started = Date.now();
  const fail = async () => {
    // Vyrovnání doby odpovědi, ať neúspěch neprozradí, jestli kód existuje.
    const wait = 400 - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return json({ error: GENERIC }, 400);
  };
  if (code.length < 5) return fail();

  const { data: pair } = await db.from("demo_pairs")
    .select("id, teacher_user_id, return_code").eq("return_code", code).maybeSingle();
  if (!pair || !constantTimeEqual(code, pair.return_code)) return fail();

  const { data: u } = await db.auth.admin.getUserById(pair.teacher_user_id);
  if (!u?.user?.email) return fail();
  try {
    const session = await issueSession(db, u.user.email);
    await db.from("demo_pairs").update({ last_active_at: new Date().toISOString() }).eq("id", pair.id);
    return json({ session, role: "teacher" });
  } catch {
    return fail();
  }
});
