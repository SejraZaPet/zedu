import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { curriculumText = "" } = await req.json();
    const clean = String(curriculumText || "").trim().slice(0, 30000);
    if (!clean) {
      return new Response(JSON.stringify({ error: "Prázdný ŠVP text." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog. Z předloženého textu školního vzdělávacího plánu (ŠVP) rozpoznáš jednotlivá učební témata nebo výukové výstupy a vrátíš je jako pole krátkých titulků.

Pravidla:
- Vrať 5–20 položek podle délky a rozsahu textu (kratší text = méně témat).
- Každý titulek je KONKRÉTNÍ a STRUČNÝ (typicky 2–8 slov), např. "Sčítání a odčítání do 20", "Slovní druhy – přídavná jména", "Fotosyntéza".
- Vyhni se obecným frázím jako "žák umí", "žák chápe", "rozvoj klíčových kompetencí" – vytáhni z nich konkrétní téma.
- Nepiš celé věty ani odrážky s uvozením typu "Žák:" – jen samotný název tématu.
- Piš česky.
- Nevymýšlej si témata, která v textu nejsou.
- Neduplikuj – každé téma jen jednou.`;

    const userPrompt = `Text ŠVP:\n"""${clean}"""\n\nRozpoznej jednotlivá témata/výstupy.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_topics",
              description: "Vrať pole rozpoznaných témat ŠVP.",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["topics"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_topics" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to prosím za chvíli znovu." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů pro AI generování. Kontaktujte administrátora." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(tc.function.arguments);
    let topics: string[] = Array.isArray(parsed?.topics)
      ? parsed.topics.map((t: unknown) => String(t || "").trim()).filter(Boolean)
      : [];
    // dedupe (case-insensitive), keep first order
    const seen = new Set<string>();
    topics = topics.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (topics.length > 20) topics = topics.slice(0, 20);

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-curriculum-topics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
