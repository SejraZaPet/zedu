// notify-parent: posílá rodičům emailové notifikace.
// Volá se z DB triggerů (pg_net) nebo přímo přes invoke.
// Body: { kind: 'new_assignment', assignment_id } | { kind: 'new_result', attempt_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://www.zedu.cz";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function emailShell(title: string, bodyHtml: string, ctaUrl: string, ctaLabel: string) {
  return `
  <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1A1F2C; background: #F8FAFC;">
    <div style="background: linear-gradient(135deg, #3FB8AF 0%, #9B87C9 100%); padding: 28px 24px; border-radius: 14px 14px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">ZEdu<span style="color:#a5f3fc;">.cz</span></h1>
    </div>
    <div style="background:#ffffff; padding: 24px; border-radius: 0 0 14px 14px;">
      <h2 style="margin: 0 0 12px; color:#1A1F2C; font-size: 20px;">${title}</h2>
      ${bodyHtml}
      <div style="text-align:center; margin: 24px 0 8px;">
        <a href="${ctaUrl}" style="background:#0F9A8B; color:#ffffff; padding:12px 22px; border-radius:14px; text-decoration:none; font-weight:600; display:inline-block;">${ctaLabel}</a>
      </div>
      <p style="font-size:12px; color:#64748B; text-align:center; margin-top:18px;">
        Tyto notifikace můžete vypnout v profilu rodiče na ZEdu.
      </p>
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error("send-email failed", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const kind: string = body.kind;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let studentIds: string[] = [];
    let subject = "";
    let html = "";

    if (kind === "new_assignment") {
      const assignmentId = body.assignment_id;
      if (!assignmentId) throw new Error("assignment_id required");

      const { data: a } = await supabase
        .from("assignments")
        .select("id, title, deadline, class_id")
        .eq("id", assignmentId)
        .maybeSingle();
      if (!a || !a.class_id) {
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: members } = await supabase
        .from("class_members")
        .select("user_id")
        .eq("class_id", a.class_id);
      studentIds = (members ?? []).map((m: any) => m.user_id);

      const deadlineStr = a.deadline
        ? new Date(a.deadline).toLocaleString("cs-CZ", { dateStyle: "long", timeStyle: "short" })
        : "bez termínu";
      subject = `Nový úkol: ${a.title}`;
      html = emailShell(
        "Nový úkol pro vaše dítě",
        `<p style="font-size:14px; color:#1A1F2C;">Učitel zadal nový úkol:</p>
         <div style="background:#F8FAFC; padding:14px 16px; border-radius:14px; margin:12px 0;">
           <p style="margin:0 0 6px; font-weight:600; color:#1A1F2C;">${a.title}</p>
           <p style="margin:0; color:#64748B; font-size:13px;">Termín: <strong style="color:#1A1F2C;">${deadlineStr}</strong></p>
         </div>`,
        `${APP_URL}/rodic`,
        "Zobrazit v ZEdu",
      );
    } else if (kind === "new_result") {
      const attemptId = body.attempt_id;
      if (!attemptId) throw new Error("attempt_id required");

      const { data: att } = await supabase
        .from("assignment_attempts")
        .select("id, student_id, score, max_score, assignment_id")
        .eq("id", attemptId)
        .maybeSingle();
      if (!att || !att.student_id) {
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: a } = await supabase
        .from("assignments")
        .select("title")
        .eq("id", att.assignment_id)
        .maybeSingle();

      studentIds = [att.student_id];
      subject = `Nový výsledek: ${a?.title ?? "úkol"}`;
      const scoreLine =
        att.max_score != null ? `${att.score} / ${att.max_score} bodů` : `${att.score} bodů`;
      html = emailShell(
        "Vaše dítě má nový výsledek",
        `<p style="font-size:14px; color:#1A1F2C;">Úkol <strong>${a?.title ?? ""}</strong> byl vyhodnocen.</p>
         <div style="background:#F8FAFC; padding:14px 16px; border-radius:14px; margin:12px 0;">
           <p style="margin:0; color:#64748B; font-size:13px;">Skóre: <strong style="color:#0F9A8B; font-size:16px;">${scoreLine}</strong></p>
         </div>`,
        `${APP_URL}/rodic`,
        "Zobrazit detail",
      );
    } else {
      return new Response(JSON.stringify({ error: "unknown kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Najdi rodiče napojené na tyto žáky
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("parent_id, student_id")
      .in("student_id", studentIds);

    const parentIds = Array.from(new Set((links ?? []).map((l: any) => l.parent_id)));
    if (parentIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: parents } = await supabase
      .from("profiles")
      .select("id, email, parent_email_notifications")
      .in("id", parentIds);

    let sent = 0;
    for (const p of parents ?? []) {
      if (!p.email) continue;
      if ((p as any).parent_email_notifications === false) continue;
      const ok = await sendEmail(p.email, subject, html);
      if (ok) sent++;
    }

    return new Response(JSON.stringify({ sent, candidates: parents?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notify-parent error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
