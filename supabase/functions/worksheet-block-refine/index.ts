// Refine a single worksheet block based on a quick action or custom instruction.
// Returns the refined block + a human-readable summary of changes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const REFINE_TOOL = {
  type: "function",
  function: {
    name: "refine_block",
    description:
      "Vrať upravený worksheet blok a lidsky čitelný souhrn změn (česky).",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["refinedBlock", "changesSummary"],
      properties: {
        refinedBlock: {
          type: "object",
          additionalProperties: true,
          description:
            "Celý upravený blok ve stejné struktuře jako vstup (zachovej id, itemNumber, type, answerSpace).",
        },
        changesSummary: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "string", minLength: 3 },
          description:
            "Pole krátkých vět popisujících jednotlivé změny (např. 'Prompt: zjednodušený text', 'Body: 2 → 1', 'Hint přidán').",
        },
      },
    },
  },
};

const QUICK_ACTION_INSTRUCTIONS: Record<string, string> = {
  simplify:
    "Zjednoduš text otázky tak, aby byla srozumitelná pro mladší/slabší žáky. Sníž obtížnost o jeden stupeň pokud má smysl.",
  harder:
    "Ztěž otázku – přidej náročnější formulaci, abstrakci nebo požaduj hlubší porozumění. Zvyš obtížnost o jeden stupeň pokud má smysl.",
  rephrase:
    "Přeformuluj zadání jiným stylem, ale zachovej obsah, typ úlohy a obtížnost.",
  add_hint:
    "Přidej do pole `hints` jeden užitečný nápovědný tip, který žákovi pomůže, ale neprozradí odpověď.",
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
    const block = body.block;
    const action = String(body.action ?? "custom");
    const customInstruction = String(body.customInstruction ?? "").slice(0, 800);

    if (!block || typeof block !== "object" || !block.type) {
      return new Response(
        JSON.stringify({ error: "Invalid block payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const instruction =
      QUICK_ACTION_INSTRUCTIONS[action] || customInstruction ||
      "Vylepši blok – zlepši formulaci a srozumitelnost, zachovej typ a body.";

    const systemPrompt = `Jsi pedagogický asistent. Upravuješ jeden blok pracovního listu podle pokynu učitele.
Zachovej tato pole beze změny: id, itemNumber, type, answerSpace.
Můžeš měnit: prompt, points, difficulty, timeEstimateSec, choices, matchPairs, orderItems, blankText, hints, tags, offlineMode, durationMin, groupSize.
changesSummary obsahuje krátké česky psané věty popisující skutečné změny.
Pokud nic neměníš v daném poli, NEZMIŇUJ ho v changesSummary.`;

    const userPrompt = `Pokyn: ${instruction}

Aktuální blok (JSON):
${JSON.stringify(block, null, 2)}

Vrať upravený blok + souhrn změn.`;

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
          tools: [REFINE_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "refine_block" },
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

    // Hard-protect immutable fields
    const refined = {
      ...parsed.refinedBlock,
      id: block.id,
      itemNumber: block.itemNumber,
      type: block.type,
      answerSpace: block.answerSpace,
    };

    return new Response(
      JSON.stringify({
        refinedBlock: refined,
        changesSummary: parsed.changesSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("worksheet-block-refine error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
