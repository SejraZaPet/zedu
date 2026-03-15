import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const {
      lessonPlanId,
      gradeBand,
      numItems = 10,
      variants = ["A", "B"],
      worksheetMode = "classwork", // "classwork" | "homework"
      deadline,
    } = await req.json();

    if (!lessonPlanId) {
      return new Response(JSON.stringify({ error: "Missing lessonPlanId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: plan, error: planErr } = await sb
      .from("lesson_plans")
      .select("title, subject, grade_band, slides, input_data")
      .eq("id", lessonPlanId)
      .single();

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Lesson plan not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slides = (plan.slides as any[]) || [];
    const slidesSummary = slides.map((s: any, i: number) =>
      `Slide ${i + 1} (${s.type}): ${s.projector?.headline || ""} – ${s.projector?.body || ""}`
    ).join("\n");

    const seedA = Math.floor(Math.random() * 900000) + 100000;
    const seedB = Math.floor(Math.random() * 900000) + 100000;

    const clampedItems = Math.max(5, Math.min(20, numItems));

    // Mode-specific instructions
    const homeworkRules = worksheetMode === "homework"
      ? `
DOMÁCÍ ÚLOHA – speciální pravidla:
- Všechny úlohy musí být řešitelné SAMOSTATNĚ žákem doma, BEZ učitele a BEZ projektoru
- Preferuj typy: mcq, fill_blank, short_answer, true_false (samostatně řešitelné)
- Matching a ordering používej max 2× celkem
- Žádná úloha nesmí vyžadovat skupinovou práci nebo přístup ke speciálnímu vybavení
- Instrukce musí být jednoznačné a kompletní – žák musí pochopit zadání sám
- Přidej ke každé úloze "difficulty" (easy/medium/hard) – začni jednoduššími
- Celková obtížnost: ~40% easy, ~40% medium, ~20% hard
${deadline ? `- Deadline: ${deadline} – uveď v metadatech` : ""}
`
      : `
TŘÍDNÍ PRÁCE – standardní pravidla:
- Mix všech typů úloh
- Minimálně 3 různé typy úloh
`;

    const systemPrompt = `Jsi zkušený český pedagog. Tvoříš pracovní listy (worksheets) pro tisk i online použití.

PRAVIDLA:
- Přesně ${clampedItems} úloh (items), NE více, NE méně
- Typy: mcq (výběr z možností), fill_blank (doplňovačka), true_false (pravda/nepravda), matching (spojování), ordering (seřazení), short_answer (krátká odpověď)
${homeworkRules}
- Každá úloha má: itemNumber, type, question, options (kde relevantní), correctAnswer, difficulty
- Vytvoř DVOUVARIANTNÍ verzi (${variants.join(" a ")}):
  - Varianta A: seed ${seedA} – originální pořadí
  - Varianta B: seed ${seedB} – přeházené pořadí úloh + u MCQ přeházené možnosti
- Answer key musí být konzistentní se změněným pořadím
- Vše česky (cs-CZ)
- Ročník: ${gradeBand || plan.grade_band || "nespecifikováno"}`;

    const userPrompt = `Vytvoř ${worksheetMode === "homework" ? "domácí úlohu" : "pracovní list"} na základě tohoto plánu lekce:

Název: ${plan.title}
Předmět: ${plan.subject}
Ročník: ${gradeBand || plan.grade_band}
${deadline ? `Deadline: ${deadline}` : ""}

Obsah slidů:
${slidesSummary}

Požadavek: ${clampedItems} úloh, varianty: ${variants.join(", ")}`;

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
        tools: [{
          type: "function",
          function: {
            name: "create_worksheet",
            description: "Vytvoří strukturovaný pracovní list s variantami A/B a answer key.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Název pracovního listu" },
                subject: { type: "string" },
                gradeBand: { type: "string" },
                worksheetMode: { type: "string", enum: ["classwork", "homework"] },
                deadline: { type: "string", description: "ISO deadline pokud zadán" },
                variants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", enum: ["A", "B"] },
                      seed: { type: "number" },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            itemNumber: { type: "number" },
                            type: { type: "string", enum: ["mcq", "fill_blank", "true_false", "matching", "ordering", "short_answer"] },
                            question: { type: "string" },
                            options: {
                              type: "array",
                              items: { type: "string" },
                              description: "Možnosti pro mcq, položky pro ordering/matching"
                            },
                            matchPairs: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: { left: { type: "string" }, right: { type: "string" } },
                                required: ["left", "right"],
                              },
                              description: "Páry pro matching typ"
                            },
                            points: { type: "number", description: "Body za úlohu" },
                            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                          },
                          required: ["itemNumber", "type", "question", "points", "difficulty"],
                        },
                      },
                    },
                    required: ["id", "seed", "items"],
                  },
                },
                answerKeys: {
                  type: "object",
                  properties: {
                    A: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          itemNumber: { type: "number" },
                          correctAnswer: { type: "string" },
                          explanation: { type: "string" },
                        },
                        required: ["itemNumber", "correctAnswer"],
                      },
                    },
                    B: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          itemNumber: { type: "number" },
                          correctAnswer: { type: "string" },
                          explanation: { type: "string" },
                        },
                        required: ["itemNumber", "correctAnswer"],
                      },
                    },
                  },
                  required: ["A", "B"],
                },
                randomizationRules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rule: { type: "string" },
                      appliedTo: { type: "string" },
                    },
                    required: ["rule", "appliedTo"],
                  },
                },
                totalPoints: { type: "number" },
                difficultyDistribution: {
                  type: "object",
                  properties: {
                    easy: { type: "number" },
                    medium: { type: "number" },
                    hard: { type: "number" },
                  },
                },
              },
              required: ["title", "variants", "answerKeys", "randomizationRules", "totalPoints"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_worksheet" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const worksheet = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ worksheet }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-worksheet error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
