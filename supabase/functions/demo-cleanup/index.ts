// Noční úklid demo dvojic po pražské půlnoci D+1. Spouští pg_cron s X-Cron-Secret.
// Maže výhradně účty z demo_pairs; seed, sdílení spolužáci a Demo škola zůstávají.
// Závěrečný e-mail je jen pro souhlas v2, až po úspěšném smazání a nejvýš jeden pokus.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/demo.ts";
import { getInternalSecret } from "../_shared/internal-secret.ts";
import { SEND_INTERVAL_MS, sleep } from "../_shared/email-delivery.ts";
import {
  buildDemoFinalEmail, DEMO_FINAL_CLAIM_TTL_MS, DEMO_FINAL_NOTICE_CONSENT_VERSION, DEMO_REMINDER_EMAIL_TYPE,
  DEMO_REMINDER_FROM, DEMO_REMINDER_REPLY_TO, isDemoFinalNoticeAllowed,
} from "../_shared/demo-contact.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Pair = { pair_id: string; teacher_user_id: string; student_user_id: string };
type FinalClaim = { pair_id: string; email: string; final_email_claimed_at: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = (await getInternalSecret("cron_internal_secret"))?.trim();
  const got = req.headers.get("X-Cron-Secret")?.trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!((secret && got === secret) || (srk && bearer === srk))) return json({ error: "Unauthorized" }, 401);

  const db = adminClient();
  // Nedokončená rezervace se nikdy znovu neodesílá. Kontakt zmizí nejpozději při dalším běhu.
  await db.from("demo_contacts").delete()
    .not("final_email_claimed_at", "is", null)
    .lt("final_email_claimed_at", new Date(Date.now() - DEMO_FINAL_CLAIM_TTL_MS).toISOString());

  const { data: pairs, error } = await db.rpc("demo_cleanup_candidates");
  if (error) return json({ error: error.message }, 500);

  const { data: shared } = await db.from("demo_shared_users").select("user_id");
  const sharedIds = new Set((shared ?? []).map((r: { user_id: string }) => r.user_id));
  const key = Deno.env.get("RESEND_API_KEY");

  const details: Record<string, unknown>[] = [];
  let deleted = 0;
  let finalSent = 0;
  let finalFailed = 0;
  let finalSkipped = 0;

  const finishFinalNotice = async (claim: FinalClaim): Promise<"sent" | "failed" | "skipped"> => {
    let outcome: "sent" | "failed" | "skipped" = "failed";
    try {
      // Odvolaný souhlas mezi rezervací a odesláním znamená žádný e-mail.
      const { data: current } = await db.from("demo_contacts").select("pair_id,consent_version")
        .eq("pair_id", claim.pair_id).eq("final_email_claimed_at", claim.final_email_claimed_at).maybeSingle();
      if (!current || !isDemoFinalNoticeAllowed((current as any).consent_version)) {
        outcome = "skipped";
        return outcome;
      }
      if (!key) return "failed";

      const { data: waitData, error: waitError } = await db.rpc("reserve_email_send_slot", { _interval_ms: SEND_INTERVAL_MS });
      if (waitError) return "failed";
      const wait = Number(waitData ?? 0);
      if (wait > 0) await sleep(wait);

      const email = buildDemoFinalEmail();
      // Jediný pokus: nejasný výsledek se neopakuje, takže zpráva nemůže odejít dvakrát.
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          from: DEMO_REMINDER_FROM, to: [claim.email], reply_to: DEMO_REMINDER_REPLY_TO,
          subject: email.subject, html: email.html, text: email.text,
        }),
      });
      await res.body?.cancel().catch(() => {});
      outcome = res.ok ? "sent" : "failed";
      return outcome;
    } catch {
      return "failed";
    } finally {
      // Bez záznamu příjemce v email_log. Staré demo logy se mažou už při rezervaci níže.
      await db.from("demo_contacts").delete().eq("pair_id", claim.pair_id)
        .eq("final_email_claimed_at", claim.final_email_claimed_at);
      if (outcome === "sent") finalSent++;
      else if (outcome === "skipped") finalSkipped++;
      else finalFailed++;
    }
  };

  for (const p of (pairs ?? []) as Pair[]) {
    let claim: FinalClaim | null = null;
    try {
      if (sharedIds.has(p.teacher_user_id) || sharedIds.has(p.student_user_id)) throw new Error("shared_user");

      const { data: claimRows, error: claimError } = await db.rpc("demo_claim_final_email", { _pair_id: p.pair_id });
      if (claimError) throw new Error("final_claim_failed");
      claim = ((claimRows ?? []) as FinalClaim[])[0] ?? null;
      if (!claim) {
        // Jiný nedokončený pokus se nespustí znovu; počká se na jeho výmaz.
        const { data: pending } = await db.from("demo_contacts").select("pair_id").eq("pair_id", p.pair_id)
          .eq("consent_version", DEMO_FINAL_NOTICE_CONSENT_VERSION).not("final_email_claimed_at", "is", null).maybeSingle();
        if (pending) throw new Error("final_notice_already_claimed");
      } else {
        // Po výmazu kontaktu nesmí zůstat ani starý demo záznam s adresou v email_log.
        const { error: logError } = await db.from("email_log").delete()
          .eq("email_type", DEMO_REMINDER_EMAIL_TYPE).eq("recipient", claim.email);
        if (logError) throw new Error("final_log_cleanup_failed");
      }

      // Soubory ve storage.
      const { data: objs } = await db.rpc("demo_pair_storage_objects", { _pair_id: p.pair_id });
      const byBucket = new Map<string, string[]>();
      for (const o of (objs ?? []) as { bucket_id: string; name: string }[]) {
        byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
      }
      let files = 0;
      for (const [bucket, names] of byBucket) {
        const { error: sErr } = await db.storage.from(bucket).remove(names);
        if (!sErr) files += names.length;
      }
      const { data: rows, error: pErr } = await db.rpc("demo_purge_pair", { _pair_id: p.pair_id });
      if (pErr) throw new Error(pErr.message);
      for (const id of [p.teacher_user_id, p.student_user_id]) {
        const { error: dErr } = await db.auth.admin.deleteUser(id);
        if (dErr) throw new Error("delete_user_failed");
      }

      let finalNotice = "not_applicable";
      if (claim) finalNotice = await finishFinalNotice(claim);
      deleted++;
      details.push({ pair: p.pair_id, files, rows, final_notice: finalNotice });
    } catch (e) {
      if (claim) await db.rpc("demo_release_final_email", {
        _pair_id: claim.pair_id, _claimed_at: claim.final_email_claimed_at,
      });
      details.push({ pair: p.pair_id, error: (e as Error).message });
    }
  }
  await db.from("demo_cleanup_log").insert({
    pairs_deleted: deleted,
    details: { pairs: details, final_notices: { sent: finalSent, failed: finalFailed, skipped: finalSkipped } },
  });
  console.log("demo-cleanup", deleted, JSON.stringify({ details, finalSent, finalFailed, finalSkipped }));
  return json({ pairs_deleted: deleted, final_notices: { sent: finalSent, failed: finalFailed, skipped: finalSkipped }, details });
});
