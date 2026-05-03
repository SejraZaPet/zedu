import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHASE_KEYS = ["uvod", "motivace", "hlavni", "procviceni", "reflexe", "zaver"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { lessonTitle, lessonContent, subject, customInstructions, totalMin } = await req.json();

    const target = Number.isFinite(totalMin) && totalMin > 0 ? totalMin : 45;
    const sysPrompt = `Jsi zkušený český pedagog. Navrhni rozvržení vyučovací hodiny (${target} minut) do 6 pevných fází:
- uvod (Úvod)
- motivace (Motivace)
- hlavni (Hlavní část)
- procviceni (Procvičení)
- reflexe (Reflexe)
- zaver (Závěr)

U každé fáze vrať timeMin (celé číslo minut) a description (1–3 věty, konkrétní aktivita pro tuto fázi). Součet timeMin = ${target}. Vše česky.`;

    const userPrompt = [
      subject ? `Předmět: ${subject}` : "",
      lessonTitle ? `Lekce: ${lessonTitle}` : "",
      lessonContent ? `Obsah lekce:\n${String(lessonContent).slice(0, 6000)}` : "",
      customInstructions ? `Pokyny učitele:\n${customInstructions}` : "",
    ].filter(Boolean).join("\n\n") || "Navrhni obecný plán vyučovací hodiny.";

    const phaseProps: Record<string, unknown> = {};
    for (const k of PHASE_KEYS) {
      phaseProps[k] = {
        type: "object",
        properties: {
          timeMin: { type: "integer", minimum: 0 },
          description: { type: "string" },
        },
        required: ["timeMin", "description"],
        additionalProperties: false,
      };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_phases",
            description: "Návrh fází hodiny s časovou dotací.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                phases: {
                  type: "object",
                  properties: phaseProps,
                  required: [...PHASE_KEYS],
                  additionalProperties: false,
                },
              },
              required: ["title", "phases"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_phases" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Nedostatek kreditů pro AI generování." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-lesson-phases error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
