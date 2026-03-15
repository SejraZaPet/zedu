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

    const { textbookLesson, style, language, mode, allowImmediateFeedback } = await req.json();
    if (!textbookLesson?.title || !textbookLesson?.sourceText) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, sourceText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isStudentPaced = mode === "student-paced";

    const baseRules = `- Rozděl lekci na 8–12 slidů
- U každého slidu urči, co patří na projektor (headline, body, assetRefs) a co na zařízení žáka (instructions, activityRefs)
- Neuváděj žádná osobní data žáků
- Vše piš česky (cs-CZ)
- Styl: ${style || "přehledný, školní, minimalistický"}
- Typy slidů: intro, objective, explain, practice, activity, summary, exit, checkpoint
- Každý slide musí mít unikátní slideId (formát: slide-01, slide-02, ...)`;

    const teacherLedRules = `${baseRules}
- Struktura: cíl → aktivace → výklad → procvičení → exit ticket`;

    const studentPacedRules = `${baseRules}
- Režim: STUDENT-PACED – žák postupuje sám, bez učitele
- Každý slide MUSÍ mít v device.instructions jasné, konkrétní instrukce co má žák udělat (min. 1 věta)
- Instrukce formuluj jako přímý pokyn žákovi (2. osoba: "Přečti si…", "Odpověz…", "Zapiš…")
- Přidej přesně 1–2 slidy typu "checkpoint" – krátké ověřovací otázky (1–3), které ověří pochopení dosavadního učiva
- Checkpoint slide musí mít pole "checkpoints" s otázkami, očekávanými odpověďmi a vysvětlením
- Pokud allowImmediateFeedback=true, uveď u každého checkpointu "feedback" s nápovědou pro žáka
- Struktura: intro → výklad s instrukcemi → checkpoint → další výklad → procvičení → checkpoint/exit`;

    const systemPrompt = `Jsi zkušený český pedagog a didaktik. Tvoříš strukturované plány lekcí.

PRAVIDLA:
${isStudentPaced ? studentPacedRules : teacherLedRules}`;

    const userPrompt = `Vytvoř plán lekce pro tuto lekci (režim: ${isStudentPaced ? "student-paced – žák postupuje sám" : "teacher-led – učitel řídí výuku"}):

Název: ${textbookLesson.title}
Předmět: ${textbookLesson.subject || "nespecifikováno"}
Ročník: ${textbookLesson.gradeBand || "nespecifikováno"}
Délka: ${textbookLesson.durationMin || 45} minut
Klíčové pojmy: ${(textbookLesson.keyConcepts || []).join(", ") || "nespecifikováno"}
${isStudentPaced ? `Okamžitá zpětná vazba: ${allowImmediateFeedback !== false ? "ano" : "ne"}` : ""}

Zdrojový text lekce:
${textbookLesson.sourceText}`;

    const checkpointSchema = {
      type: "object" as const,
      properties: {
        question: { type: "string" as const, description: "Ověřovací otázka" },
        expectedAnswer: { type: "string" as const, description: "Očekávaná odpověď" },
        explanation: { type: "string" as const, description: "Vysvětlení správné odpovědi" },
        feedback: { type: "string" as const, description: "Nápověda/zpětná vazba pro žáka" },
      },
      required: ["question", "expectedAnswer", "explanation"],
      additionalProperties: false,
    };

    const slideSchema: Record<string, unknown> = {
      type: "object",
      properties: {
        slideId: { type: "string" },
        type: { type: "string", enum: ["intro", "objective", "explain", "practice", "activity", "summary", "exit", "checkpoint"] },
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
        checkpoints: { type: "array", items: checkpointSchema },
      },
      required: ["slideId", "type", "projector", "device", "teacherNotes"],
      additionalProperties: false,
    };

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
              description: "Vytvoří strukturovaný plán lekce se slidy.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Název plánu lekce" },
                  subject: { type: "string" },
                  gradeBand: { type: "string" },
                  mode: { type: "string", enum: ["teacher-led", "student-paced"] },
                  slides: {
                    type: "array",
                    minItems: 8,
                    items: slideSchema,
                  },
                },
                required: ["title", "subject", "gradeBand", "mode", "slides"],
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
