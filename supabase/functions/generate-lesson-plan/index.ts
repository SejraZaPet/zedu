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

    const { textbookLesson, style, language } = await req.json();
    if (!textbookLesson?.title || !textbookLesson?.sourceText) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, sourceText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog a didaktik. Tvoříš strukturované plány lekcí pro živou výuku ve třídě, kde učitel promítá na projektor a žáci odpovídají na svých zařízeních.

PRAVIDLA:
- Rozděl lekci na 8–12 slidů podle struktury: cíl → aktivace → výklad → procvičení → exit ticket
- U každého slidu urči, co patří na projektor (headline, body, assetRefs) a co na zařízení žáka (instructions, activityRefs)
- Neuváděj žádná osobní data žáků
- Vše piš česky (cs-CZ)
- Styl: ${style || "přehledný, školní, minimalistický"}
- Typy slidů: intro, objective, explain, practice, activity, summary, exit
- Každý slide musí mít unikátní slideId (formát: slide-01, slide-02, ...)`;

    const userPrompt = `Vytvoř plán lekce pro tuto lekci:

Název: ${textbookLesson.title}
Předmět: ${textbookLesson.subject || "nespecifikováno"}
Ročník: ${textbookLesson.gradeBand || "nespecifikováno"}
Délka: ${textbookLesson.durationMin || 45} minut
Klíčové pojmy: ${(textbookLesson.keyConcepts || []).join(", ") || "nespecifikováno"}

Zdrojový text lekce:
${textbookLesson.sourceText}`;

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
              name: "create_lesson_plan",
              description: "Vytvoří strukturovaný plán lekce se slidy pro projektor a zařízení žáků.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Název plánu lekce" },
                  subject: { type: "string" },
                  gradeBand: { type: "string" },
                  slides: {
                    type: "array",
                    minItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        slideId: { type: "string" },
                        type: { type: "string", enum: ["intro", "objective", "explain", "practice", "activity", "summary", "exit"] },
                        projector: {
                          type: "object",
                          properties: {
                            headline: { type: "string" },
                            body: { type: "string" },
                            assetRefs: { type: "array", items: { type: "string" } },
                          },
                          required: ["headline", "body"],
                        },
                        device: {
                          type: "object",
                          properties: {
                            instructions: { type: "string" },
                            activityRefs: { type: "array", items: { type: "string" } },
                          },
                          required: ["instructions"],
                        },
                        teacherNotes: { type: "string" },
                      },
                      required: ["slideId", "type", "projector", "device", "teacherNotes"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "subject", "gradeBand", "slides"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_lesson_plan" } },
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

    const lessonPlan = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ lessonPlan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lesson-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
