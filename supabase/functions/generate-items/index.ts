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

    const { sourceText, gradeBand, numItems = 10 } = await req.json();

    if (!sourceText || typeof sourceText !== "string" || sourceText.trim().length < 20) {
      return new Response(JSON.stringify({ error: "sourceText je povinný (min. 20 znaků)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!gradeBand) {
      return new Response(JSON.stringify({ error: "gradeBand je povinný." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clamped = Math.max(3, Math.min(20, numItems));

    const systemPrompt = `Jsi zkušený český pedagog. Generuješ úlohy z dodaného textu lekce.

STRIKTNÍ PRAVIDLA:
- Vygeneruj PŘESNĚ ${clamped} úloh — ne více, ne méně.
- Povinný mix typů: mcq (min 2), fill_blank (min 2), short_answer (min 1), matching (min 1). Zbytek libovolně z mcq/fill_blank/short_answer/matching/true_false/ordering.
- Každá úloha MUSÍ mít jednoznačné zadání a přesně jednu správnou odpověď.
- Odpovědi musí být ověřitelné přímo z dodaného textu.
- MCQ: přesně 4 možnosti, distraktory musí být věrohodné ale jednoznačně nesprávné.
- Fill_blank: text s ___ placeholderem, max 2 blanky na úlohu.
- Matching: 3–5 párů.
- Short_answer: odpověď 1–3 slova.
- Ordering: 3–6 položek.
- Jazyk: cs-CZ, ročník: ${gradeBand}.
- Obtížnost: ~40% easy, ~40% medium, ~20% hard.
- Bodování: easy=1, medium=2, hard=3 body.
- Čas: easy=20–30s, medium=45–60s, hard=90–180s.`;

    const userPrompt = `Vygeneruj ${clamped} úloh z tohoto textu lekce (ročník ${gradeBand}):

---
${sourceText.slice(0, 6000)}
---

Požadavek: přesně ${clamped} úloh, mix typů, jednoznačná zadání, konzistentní answer key.`;

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
            name: "generate_items",
            description: "Vygeneruje seznam úloh s answer key z textu lekce.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Unique item id, e.g. q1, q2" },
                      itemNumber: { type: "number" },
                      type: { type: "string", enum: ["mcq", "fill_blank", "true_false", "matching", "ordering", "short_answer"] },
                      prompt: { type: "string", description: "Zadání úlohy" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      points: { type: "number" },
                      timeEstimateSec: { type: "number" },
                      model: {
                        type: "object",
                        description: "Data specifická pro typ úlohy",
                        properties: {
                          choices: { type: "array", items: { type: "string" }, description: "MCQ možnosti (4 položky)" },
                          correctIndex: { type: "number", description: "Index správné odpovědi pro MCQ (0-based)" },
                          correctAnswer: { description: "Správná odpověď (string nebo boolean pro true_false)" },
                          blankText: { type: "string", description: "Text s ___ pro fill_blank" },
                          blanks: { type: "array", items: { type: "string" }, description: "Správné výrazy do mezer" },
                          pairs: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: { left: { type: "string" }, right: { type: "string" } },
                              required: ["left", "right"],
                            },
                            description: "Páry pro matching",
                          },
                          correctOrder: { type: "array", items: { type: "string" }, description: "Správné pořadí pro ordering" },
                          items: { type: "array", items: { type: "string" }, description: "Zamíchané položky pro ordering" },
                          expectedAnswer: { type: "string", description: "Očekávaná odpověď pro short_answer" },
                        },
                      },
                    },
                    required: ["id", "itemNumber", "type", "prompt", "difficulty", "points", "timeEstimateSec", "model"],
                  },
                },
                answerKey: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      itemId: { type: "string" },
                      itemNumber: { type: "number" },
                      correctAnswer: { type: "string", description: "Lidsky čitelná správná odpověď" },
                      explanation: { type: "string", description: "Stručné vysvětlení" },
                    },
                    required: ["itemId", "itemNumber", "correctAnswer"],
                  },
                },
                metadata: {
                  type: "object",
                  properties: {
                    totalPoints: { type: "number" },
                    totalTimeMin: { type: "number" },
                    difficultyDistribution: {
                      type: "object",
                      properties: { easy: { type: "number" }, medium: { type: "number" }, hard: { type: "number" } },
                    },
                    typeDistribution: { type: "object", description: "Počet úloh per typ" },
                  },
                  required: ["totalPoints", "totalTimeMin", "difficultyDistribution", "typeDistribution"],
                },
              },
              required: ["items", "answerKey", "metadata"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_items" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků. Zkuste to za chvíli." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate item count
    if (!result.items || result.items.length !== clamped) {
      console.warn(`Expected ${clamped} items, got ${result.items?.length}`);
    }

    // Validate answer key consistency
    if (result.answerKey && result.items) {
      const itemIds = new Set(result.items.map((i: any) => i.id));
      const keyIds = new Set(result.answerKey.map((k: any) => k.itemId));
      const missing = result.items.filter((i: any) => !keyIds.has(i.id));
      if (missing.length > 0) {
        console.warn(`Answer key missing for items: ${missing.map((m: any) => m.id).join(", ")}`);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-items error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Neznámá chyba" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
