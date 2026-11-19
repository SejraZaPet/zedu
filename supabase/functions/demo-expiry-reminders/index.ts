// Denní připomínky D−3 / D−1 před smazáním dema. Spouští pg_cron s X-Cron-Secret (jako demo-cleanup).
// Nejvýš demo_config.reminder_max_per_run e-mailů za běh, D−1 přednost; co selže, zkusí se další den.
// email_log: jen typ, stav a příjemce – žádný obsah.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/demo.ts";
import { getInternalSecret } from "../_shared/internal-secret.ts";
import { sendWithRetry, SEND_INTERVAL_MS } from "../_shared/email-delivery.ts";
import {
  buildDemoReminderEmail, DEMO_BATCH_SIZE, DEMO_BATCH_THRESHOLD, DEMO_REMINDER_EMAIL_TYPE, DEMO_REMINDER_FROM,
  DEMO_REMINDER_REPLY_TO, randomToken, sha256Hex,
} from "../_shared/demo-contact.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Claim = { pair_id: string; email: string; kind: "1d" | "3d"; deletes_at: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = (await getInternalSecret("cron_internal_secret"))?.trim();
  const got = req.headers.get("X-Cron-Secret")?.trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!((secret && got === secret) || (srk && bearer === srk))) return json({ error: "Unauthorized" }, 401);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "RESEND_API_KEY missing" }, 503);
  const db = adminClient();

  // Uchování: řádky demo připomínek starší než 30 dní.
  await db.from("email_log").delete().eq("email_type", DEMO_REMINDER_EMAIL_TYPE)
    .lt("created_at", new Date(Date.now() - 30 * 86400_000).toISOString());

  const { data: cfg } = await db.from("demo_config").select("reminder_max_per_run").limit(1).maybeSingle();
  const limit = Math.max(0, Math.min(500, Number((cfg as any)?.reminder_max_per_run ?? 60)));
  if (limit === 0) return json({ sent: 0, failed: 0, skipped: "limit_zero" });

  // Rezervace před odesláním (sent_at) = idempotence při souběhu či opakovaném spuštění.
  const { data: claims, error } = await db.rpc("demo_claim_reminders", { _limit: limit });
  if (error) return json({ error: "claim_failed" }, 500);
  const list = (claims ?? []) as Claim[];

  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/demo-unsubscribe`;
  const prepared: { c: Claim; payload: Record<string, unknown> }[] = [];
  for (const c of list) {
    const token = randomToken();
    const hash = await sha256Hex(token);
    const { data: row } = await db.from("demo_contacts").select("unsubscribe_token_hashes").eq("pair_id", c.pair_id).maybeSingle();
    const hashes = [...(((row as any)?.unsubscribe_token_hashes ?? []) as string[]), hash].slice(-4);
    await db.from("demo_contacts").update({ unsubscribe_token_hashes: hashes }).eq("pair_id", c.pair_id);
    const url = `${fnBase}?t=${token}`;
    const e = buildDemoReminderEmail({ kind: c.kind, deletesAt: c.deletes_at, unsubscribeUrl: url });
    prepared.push({ c, payload: {
      from: DEMO_REMINDER_FROM, to: [c.email], reply_to: DEMO_REMINDER_REPLY_TO, subject: e.subject, html: e.html, text: e.text,
      headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    } });
  }

  const reserveSlot = async () => {
    const { data, error } = await db.rpc("reserve_email_send_slot", { _interval_ms: SEND_INTERVAL_MS });
    if (error) throw error;
    return Number(data ?? 0);
  };
  const post = (path: string, body: unknown) => () => fetch(`https://api.resend.com${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
  });
  const log = (c: Claim, ok: boolean, status: number) => db.from("email_log").insert({
    recipient: c.email, subject: DEMO_REMINDER_EMAIL_TYPE, email_type: DEMO_REMINDER_EMAIL_TYPE,
    status: ok ? "sent" : "failed", error_message: ok ? null : `HTTP ${status}`, from_address: DEMO_REMINDER_FROM, metadata: { kind: c.kind },
  });
  // Po selhání D−1 zůstane D−3 označené (D−1 má přednost, D−3 by už nedávalo smysl).
  const release = (c: Claim) => db.rpc("demo_release_reminder", { _pair_id: c.pair_id, _kind: c.kind, _had_3d: c.kind === "1d" });

  let sent = 0, failed = 0;
  const useBatch = prepared.length > DEMO_BATCH_THRESHOLD;
  const groups = useBatch
    ? Array.from({ length: Math.ceil(prepared.length / DEMO_BATCH_SIZE) }, (_, i) => prepared.slice(i * DEMO_BATCH_SIZE, (i + 1) * DEMO_BATCH_SIZE))
    : prepared.map((p) => [p]);
  for (const g of groups) {
    let status = 0;
    try {
      const res = await sendWithRetry({ reserveSlot, doFetch: useBatch ? post("/emails/batch", g.map((x) => x.payload)) : post("/emails", g[0].payload) });
      status = res.status;
      await res.body?.cancel().catch(() => {});
    } catch { status = 0; }
    const ok = status >= 200 && status < 300;
    for (const x of g) {
      await log(x.c, ok, status);
      if (ok) sent++; else { failed++; await release(x.c); }
    }
  }
  console.log("demo-expiry-reminders", JSON.stringify({ claimed: list.length, sent, failed, batch: useBatch }));
  return json({ claimed: list.length, sent, failed, batch: useBatch });
});
