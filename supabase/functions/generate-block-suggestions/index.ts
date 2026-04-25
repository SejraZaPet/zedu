// Generate 3 variant worksheet block suggestions from a snippet of lesson content.
// Uses Lovable AI Gateway (google/gemini-2.5-flash) with tool calling for structured output.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SUGGESTION_TOOL = {
  type: "function",
  function: {
    name: "propose_blocks",
    description:
      "Vrať 3 variantní návrhy bloků pracovního listu k dané pasáži z lekce. Každý návrh má jiný typ úlohy nebo obtížnost.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        suggestions: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "difficulty", "points", "prompt", "rationale"],
            properties: {
              type: {
                type: "string",
                enum: [
                  "mcq",
                  "true_false",
                  "fill_blank",
                  "matching",
                  "ordering",
                  "short_answer",
                  "open_answer",
                  "offline_activity",
                ],
              },
              difficulty: {
                type: "string",
                enum: ["easy", "medium", "hard"],
              },
              points: { type: "number", minimum: 1, maximum: 10 },
              prompt: { type: "string", minLength: 5 },
              rationale: { type: "string", minLength: 5 },
              choices: { type: "array", items: { type: "string" } },
              correctChoice: { type: "string" },
              correctBoolean: { type: "boolean" },
              blankText: { type: "string" },
              blankAnswers: { type: "array", items: { type: "string" } },
              matchPairs: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["left", "right"],
                  properties: {
                    left: { type: "string" },
                    right: { type: "string" },
                  },
                },
              },
              orderItems: { type: "array", items: { type: "string" } },
              shortAnswer: { type: "string" },
              rubric: { type: "string" },
              offlineMode: {
                type: "string",
                enum: [
                  "discussion",
                  "group_work",
                  "practical",
                  "observation",
                  "reflection",
                ],
              },
              groupSize: {
                type: "string",
                enum: ["individual", "pair", "small_group", "class"],
              },
              durationMin: { type: "number", minimum: 1, maximum: 90 },
            },
          },
        },
      },
      required: ["suggestions"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const blockText = String(body.blockText ?? "").slice(0, 4000);
    const lessonTitle = String(body.lessonTitle ?? "").slice(0, 200);
    const lessonSubject = String(body.lessonSubject ?? "").slice(0, 100);
    const userInstruction = String(body.userInstruction ?? "").slice(0, 500);
    const variantCount = 3;

    if (!blockText || blockText.length < 10) {
      return new Response(
        JSON.stringify({ error: "blockText is too short" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Jsi pedagogický asistent pro tvorbu pracovních listů.
Vytváříš návrhy úloh navázaných na konkrétní pasáž z výukové lekce.
Vždy vrať PŘESNĚ ${variantCount} různorodé návrhy s odlišným typem úlohy nebo obtížností.
Pokud je úloha typu mcq, doplň choices a correctChoice.
Pokud true_false, doplň correctBoolean.
Pokud fill_blank, doplň blankText (s ___) a blankAnswers.
Pokud matching, doplň matchPairs.
Pokud ordering, doplň orderItems v správném pořadí.
Pokud short_answer, doplň shortAnswer (vzorová odpověď).
Pokud open_answer, doplň rubric.
Pokud offline_activity, doplň offlineMode, groupSize a durationMin.
Rationale je krátké (1 věta) zdůvodnění, proč je tato varianta vhodná.
Vše česky.`;

    const userPrompt = `Předmět: ${lessonSubject || "neuvedeno"}
Lekce: ${lessonTitle || "neuvedeno"}

Pasáž z lekce:
"""
${blockText}
"""

${userInstruction ? `Speciální požadavek učitele: ${userInstruction}\n` : ""}Navrhni ${variantCount} variantní úlohy do pracovního listu k této pasáži.`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
          tools: [SUGGESTION_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "propose_blocks" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Překročen limit AI dotazů. Zkuste za chvíli." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Vyčerpaný kredit AI. Doplňte v Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway selhalo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-block-suggestions error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
