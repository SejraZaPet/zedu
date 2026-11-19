// Uložení / smazání e-mailu návštěvníka dema se souhlasem. Pár se odvozuje jen z JWT.
// E-mail se nikdy nevrací ani neloguje; klient dostane jen maskovaný stav.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, countRecent, recordEvent } from "../_shared/demo.ts";
import { requireAuth } from "../_shared/auth.ts";
import { DEMO_CONSENT_TEXT, DEMO_CONSENT_VERSION, normalizeDemoEmail, sha256Hex } from "../_shared/demo-contact.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  const db = adminClient();
  const { data: pair } = await db.from("demo_pairs").select("id")
    .or(`teacher_user_id.eq.${auth.userId},student_user_id.eq.${auth.userId}`).maybeSingle();
  if (!pair) return json({ error: "Tato volba je jen pro ukázkový účet." }, 403);

  if ((await countRecent(db, "save_contact", 60 * 60 * 1000, pair.id)) >= 5) {
    return json({ error: "Příliš mnoho pokusů. Zkuste to prosím za hodinu." }, 429);
  }
  await recordEvent(db, "save_contact", pair.id);

  const body = await req.json().catch(() => ({}));
  if (body?.action === "delete") {
    const { error } = await db.from("demo_contacts").delete().eq("pair_id", pair.id);
    if (error) return json({ error: "E-mail se nepodařilo smazat. Zkuste to prosím znovu." }, 500);
    return json({ ok: true, has_contact: false });
  }

  const email = normalizeDemoEmail(body?.email);
  if (!email) return json({ error: "Zadejte prosím platný e-mail." }, 400);
  if (body?.consent !== true || body?.consent_version !== DEMO_CONSENT_VERSION) {
    return json({ error: "Bez souhlasu e-mail uložit nemůžeme." }, 400);
  }
  const { error } = await db.from("demo_contacts").upsert({
    pair_id: pair.id, email, consent_at: new Date().toISOString(),
    consent_version: DEMO_CONSENT_VERSION, consent_text_hash: await sha256Hex(DEMO_CONSENT_TEXT),
    updated_at: new Date().toISOString(),
  }, { onConflict: "pair_id" });
  if (error) {
    console.error("demo-save-contact upsert failed", error.code);
    return json({ error: "E-mail se nepodařilo uložit. Zkuste to prosím znovu." }, 500);
  }
  return json({ ok: true, has_contact: true });
});
