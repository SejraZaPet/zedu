import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { topic, textbook } = await req.json();
    if (!topic || !textbook) {
      return new Response(JSON.stringify({ error: "Missing required fields: topic, textbook" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog a didaktik. Tvoříš osnovy lekcí pro české školy.

PRAVIDLA:
- Vygeneruj 8–14 slidů pro zadané téma
- Každý slide má: slideNumber, title, type (text/mcq/image/discussion/activity/summary), summary
- Typy slidů: text (výklad), mcq (kvízová otázka), image (obrázek/diagram), discussion (diskuse), activity (aktivita/cvičení), summary (shrnutí)
- Osnova musí pokrývat: úvod, klíčové pojmy, výklad, příklady, procvičení, shrnutí
- Vše piš česky (cs-CZ)
- Summary má být stručný popis obsahu slidu (1–2 věty)`;

    const userPrompt = `Vytvoř osnovu lekce:

Téma: ${topic}
Učebnice: ${textbook}

Vygeneruj strukturovanou osnovu se slidy.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_lesson_outline",
              description: "Vytvoří osnovu lekce se slidy.",
              parameters: {
                type: "object",
                properties: {
                  outline: {
                    type: "array",
                    minItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        slideNumber: { type: "number", description: "Číslo slidu" },
                        title: { type: "string", description: "Nadpis slidu" },
                        type: {
                          type: "string",
                          enum: ["text", "mcq", "image", "discussion", "activity", "summary"],
                          description: "Typ obsahu slidu",
                        },
                        summary: { type: "string", description: "Stručný popis obsahu slidu" },
                      },
                      required: ["slideNumber", "title", "type", "summary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["outline"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_lesson_outline" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatek kreditů pro AI generování." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lesson-outline error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
