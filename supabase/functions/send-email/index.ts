import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY") || "re_LCFx8wny_3ZdSostB5aZbqbBJ6UarFyzQ";

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY chybí. Dostupné proměnné:", JSON.stringify(
        Object.keys(Deno.env.toObject()).filter(k => !k.toLowerCase().includes("key") && !k.toLowerCase().includes("secret"))
      ));
      return new Response(JSON.stringify({ error: "RESEND_API_KEY není nakonfigurován" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, html, text } = await req.json();

    const payload: Record<string, unknown> = {
      from: "ZEdu <noreply@zedu.cz>",
      to,
      subject,
      html,
    };
    if (text) payload.text = text;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Resend response:", res.status, JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 400,
    });
  } catch (error: any) {
    console.error("send-email error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
