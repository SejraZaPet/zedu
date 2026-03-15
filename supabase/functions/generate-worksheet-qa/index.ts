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

    const { items, answerKey, metadata, includeTeacherNotes = true } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items[] je povinný a nesmí být prázdný." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!answerKey || !Array.isArray(answerKey)) {
      return new Response(JSON.stringify({ error: "answerKey[] je povinný." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build prompt ──
    const systemPrompt = `Jsi zkušený český pedagog a recenzent vzdělávacích materiálů.

Dostaneš seznam úloh pracovního listu a klíč odpovědí. Tvým úkolem je:

1. **answerKey** — Přeformátuj klíč odpovědí do čistého formátu pro učitele:
   - Pro každou úlohu: číslo, správná odpověď, stručné vysvětlení (1–2 věty).
   - Přidej bodování a poznámku k částečnému hodnocení (kde má smysl).

2. **teacherNotes** — ${includeTeacherNotes ? "Vytvoř 3–6 krátkých poznámek pro učitele:" : "Vynech teacherNotes (vrať prázdné pole)."}
   ${includeTeacherNotes ? `- "Na co si dát pozor" při zadávání/hodnocení
   - Časté chyby studentů u daného tématu
   - Tipy na rozvedení diskuse
   - Česky, stručně (max 2 věty na poznámku)` : ""}

3. **qaReport** — Proveď kontrolu kvality úloh:
   - Zkontroluj: nejednoznačná zadání, gramatické chyby, chybějící/nesprávné odpovědi, duplicitní úlohy, nevyvážená obtížnost
   - Každý problém: severity (low/med/high), message (popis), suggestion (konkrétní návrh opravy)
   - Pokud je vše OK, vrať prázdné pole issues

JAZYK: cs-CZ. Buď konkrétní a praktický.`;

    const userPrompt = `Zde jsou úlohy pracovního listu:

${JSON.stringify(items, null, 2)}

Klíč odpovědí:
${JSON.stringify(answerKey, null, 2)}

Metadata: ${JSON.stringify(metadata ?? {})}

Proveď analýzu a vrať strukturovaný výstup.`;

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
            name: "generate_qa_report",
            description: "Generuje klíč odpovědí, učitelské poznámky a QA report pro pracovní list.",
            parameters: {
              type: "object",
              properties: {
                answerKey: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      itemId: { type: "string" },
                      itemNumber: { type: "number" },
                      correctAnswer: { type: "string", description: "Lidsky čitelná správná odpověď" },
                      explanation: { type: "string", description: "Stručné pedagogické vysvětlení (1–2 věty)" },
                      partialCredit: { type: "string", description: "Poznámka k částečnému hodnocení (volitelné)" },
                      points: { type: "number" },
                    },
                    required: ["itemId", "itemNumber", "correctAnswer", "explanation", "points"],
                  },
                },
                teacherNotes: {
                  type: "array",
                  items: { type: "string" },
                  description: "3–6 krátkých poznámek pro učitele (česky)",
                },
                qaReport: {
                  type: "object",
                  properties: {
                    overallQuality: { type: "string", enum: ["excellent", "good", "needs_review"], description: "Celková kvalita" },
                    issues: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          severity: { type: "string", enum: ["low", "med", "high"] },
                          itemId: { type: "string", description: "ID dotčené úlohy (nebo 'general')" },
                          category: { type: "string", enum: ["ambiguity", "grammar", "missing_answer", "duplicate", "difficulty_balance", "factual_error", "other"] },
                          message: { type: "string", description: "Popis problému" },
                          suggestion: { type: "string", description: "Konkrétní návrh opravy" },
                        },
                        required: ["severity", "itemId", "category", "message", "suggestion"],
                      },
                    },
                    summary: { type: "string", description: "Shrnutí QA v 1–2 větách" },
                  },
                  required: ["overallQuality", "issues", "summary"],
                },
              },
              required: ["answerKey", "teacherNotes", "qaReport"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_qa_report" } },
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

    // Validate answer key covers all items
    const itemIds = new Set(items.map((i: any) => i.id));
    const keyIds = new Set((result.answerKey ?? []).map((k: any) => k.itemId));
    const uncovered = [...itemIds].filter((id) => !keyIds.has(id));
    if (uncovered.length > 0) {
      // Add QA issue for missing answer keys
      if (!result.qaReport) result.qaReport = { overallQuality: "needs_review", issues: [], summary: "" };
      for (const id of uncovered) {
        result.qaReport.issues.push({
          severity: "high",
          itemId: id,
          category: "missing_answer",
          message: `Klíč odpovědí chybí pro úlohu ${id}.`,
          suggestion: "Doplňte správnou odpověď do answer key.",
        });
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-worksheet-qa error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Neznámá chyba" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
