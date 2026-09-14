import { requireAuth, hasRole } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Jediný povolený odesílatel – ověřená doména send.bezli.cz. */
export const FROM_ADDRESS = "Bezli <noreply@send.bezli.cz>";

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Require either a service-role caller (other trusted edge functions / triggers)
  // or an authenticated admin user. Prevents unauthenticated phishing/spam abuse.
  const auth = await requireAuth(req, { allowServiceRole: true });
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!auth.isServiceRole) {
    const isAdmin = await hasRole(auth.userId, "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let logId: string | null = null;
  const db = admin();

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY");

    const body = await req.json();
    const { to, subject, html, text } = body ?? {};
    const emailType = typeof body?.emailType === "string" ? body.emailType : "other";
    const replyTo = typeof body?.replyTo === "string" ? body.replyTo : undefined;

    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = Array.isArray(to) ? to : [to];

    // Záznam pokusu o odeslání (stav "pending"), aby šel dohledat i pád funkce.
    const { data: logRow } = await db
      .from("email_log")
      .insert({
        recipient: recipients.join(", "),
        subject: String(subject),
        email_type: emailType,
        status: "pending",
        html: html ? String(html) : null,
        body_text: text ? String(text) : null,
        from_address: FROM_ADDRESS,
        metadata: replyTo ? { reply_to: replyTo } : {},
      })
      .select("id")
      .maybeSingle();
    logId = logRow?.id ?? null;

    const finish = async (status: "sent" | "failed", extra: Record<string, unknown>) => {
      if (!logId) return;
      await db.from("email_log").update({ status, updated_at: new Date().toISOString(), ...extra }).eq("id", logId);
    };

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      await finish("failed", { error_message: "Email service not configured (missing RESEND_API_KEY)" });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      from: FROM_ADDRESS,
      to: recipients,
      subject,
      html,
    };
    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason =
        (data as any)?.message || (data as any)?.error?.message || `Resend HTTP ${res.status}`;
      console.error("Resend error", res.status, reason);
      await finish("failed", { error_message: String(reason).slice(0, 1000) });
    } else {
      await finish("sent", { provider_message_id: (data as any)?.id ?? null, error_message: null });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 400,
    });
  } catch (error: any) {
    console.error("send-email error:", error?.message);
    if (logId) {
      await db
        .from("email_log")
        .update({
          status: "failed",
          error_message: String(error?.message ?? "Internal error").slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
