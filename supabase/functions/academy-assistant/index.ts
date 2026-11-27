import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { AI_MODEL_QUALITY } from "../_shared/ai-models.ts";
import { academyModuleText } from "../_shared/academy-module-text.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const demoBlock = await demoAiGuard(auth, "academy-assistant");
    if (demoBlock) return demoBlock;
  }
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const moduleId = body?.moduleId;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (typeof moduleId !== "string" || !UUID.test(moduleId)) return json({ error: "Neplatný modul." }, 400);
    if (!message || message.length > 2000) return json({ error: "Napište prosím otázku (nejvýše 2000 znaků)." }, 400);
    const history = Array.isArray(body?.history)
      ? (body!.history as Array<Record<string, unknown>>)
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .slice(-10).map((m) => ({ role: m.role as string, content: (m.content as string).slice(0, 3000) }))
      : [];

    // Modul se čte JWT uživatele — RLS rozhoduje, co smí vidět. Text od klienta se nepřijímá.
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth.authHeader } },
    });
    const { data: mod } = await db.from("academy_modules").select("id, title, content, content_blocks, course_id").eq("id", moduleId).maybeSingle();
    if (!mod) return json({ error: "Modul nebyl nalezen." }, 404);
    const { data: siblings } = await db.from("academy_modules").select("title, content, content_blocks").eq("course_id", mod.course_id).neq("id", mod.id).order("sort_order").limit(60);

    const moduleText = academyModuleText(mod.content_blocks, mod.content);
    const others = (siblings ?? []).map((s) => `## ${s.title}\n${academyModuleText(s.content_blocks, s.content, 600)}`).join("\n").slice(0, 12000);

    const system = `Jsi AI asistent Bezli Akademie pro učitele. Vykej, piš česky, stručně a prakticky (nejvýše 6 vět nebo krátký číslovaný postup).
Odpovídej POUZE z podkladů níže. Primárně z aktuálního modulu; z ostatních modulů kurzu jen pro propojení funkcí — pak uveď název modulu.
Pokud odpověď v podkladech není, řekni to otevřeně a doporuč nejbližší modul kurzu podle názvu. Nic si nevymýšlej (tlačítka, nabídky, funkce).
Odkazuj na čísla kroků ze snímku, např. „krok 3 na snímku".

# Aktuální modul: ${mod.title}
${moduleText}

# Ostatní moduly kurzu
${others}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL_QUALITY, messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }] }),
    });
    if (!resp.ok) {
      if (resp.status === 429) return json({ error: "Příliš mnoho dotazů najednou. Zkuste to prosím za chvíli." }, 429);
      if (resp.status === 402) return json({ error: "Došly kredity pro AI. Obraťte se prosím na správce." }, 402);
      if (resp.status === 403) return json({ error: "AI asistent teď není pro Váš účet dostupný." }, 403);
      console.error("academy-assistant gateway", resp.status);
      return json({ error: "AI asistent teď neodpovídá. Zkuste to prosím znovu." }, 502);
    }
    const data = await resp.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "";
    if (!reply) return json({ error: "AI nevrátila odpověď." }, 502);
    return json({ reply });
  } catch {
    console.error("academy-assistant failed");
    return json({ error: "AI asistent teď není dostupný. Zkuste to prosím znovu." }, 500);
  }
});
