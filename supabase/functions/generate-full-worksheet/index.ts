import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TYPES = [
  "mcq", "true_false", "fill_blank", "matching", "ordering",
  "short_answer", "open_answer", "section_header", "write_lines",
  "instruction_box", "two_boxes", "flow_steps",
  "sorting", "flashcards", "word_search",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      lessonContent,
      worksheetMode = "classwork",
      itemCount = 8,
      difficulty = "mixed",
      hint = "",
      availableTypes,
      lessonTitle = "",
    } = body ?? {};

    if (!lessonContent || typeof lessonContent !== "string" || lessonContent.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Lekce neobsahuje dostatek textu pro generování pracovního listu." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safeCount = Math.max(1, Math.min(20, Number(itemCount) || 8));
    const types: string[] = Array.isArray(availableTypes) && availableTypes.length > 0
      ? availableTypes.filter((t: string) => DEFAULT_TYPES.includes(t))
      : DEFAULT_TYPES;

    const modeGuidance: Record<string, string> = {
      classwork: "Mix typů — kombinuj mcq, true_false, fill_blank, short_answer, matching a sekce.",
      test: "Hlavně mcq, true_false, fill_blank, matching a short_answer. Bez instruction_box.",
      revision: "Hlavně matching, ordering, fill_blank, mcq. Žádné dlouhé otevřené otázky.",
      homework: "Hlavně open_answer, short_answer, reflexivní instruction_box.",
      worksheet: "Hlavně section_header, write_lines, instruction_box, two_boxes, flow_steps. Min. mcq/true_false.",
    };

    const diffGuidance: Record<string, string> = {
      easy: "Snadná obtížnost (1. ročník SŠ, základy). Většina difficulty: easy.",
      mixed: "Smíšená obtížnost — kombinuj easy/medium/hard, hlavně medium.",
      hard: "Náročná (maturita) — většina medium/hard, hlubší aplikace pojmů.",
    };

    const systemPrompt = `Jsi expert na tvorbu pracovních listů pro české školy. Na základě obsahu lekce vygeneruj kompletní pracovní list.

PRAVIDLA:
- Použij VÝHRADNĚ informace z obsahu lekce, nevymýšlej fakta, čísla ani jména mimo text.
- Vygeneruj přesně ${safeCount} bloků (počítáno včetně section_header).
- Začni blokem typu "section_header" s krátkým názvem tématu (prompt = název).
- ${modeGuidance[worksheetMode] ?? modeGuidance.classwork}
- ${diffGuidance[difficulty] ?? diffGuidance.mixed}
- Povolené typy: ${types.join(", ")}.
- Každý blok MUSÍ mít: type, prompt, points (int), difficulty ("easy"|"medium"|"hard"), timeEstimateSec (int).
- section_header / instruction_box / write_lines / two_boxes / flow_steps mají points = 0.
- mcq: pole "choices" (přesně 4) + "correctAnswer" = text správné volby.
- true_false: "correctAnswer" = "true" nebo "false".
- fill_blank: "blankText" obsahující "___" místo klíčových slov.
- matching: "matchPairs" (3–5 párů { left, right }).
- ordering: "orderItems" (3–6 položek ve správném pořadí).
- short_answer / open_answer: "correctAnswer" = vzorová odpověď (krátká věta).
- write_lines: "lineCount" (3–8), "lineStyle" ("dotted"|"solid"|"dashed").
- instruction_box: "instructionVariant" ("blue"|"yellow"|"green"|"purple"), "instructionIcon" ("info"|"video"|"write"|"discuss"|"group").
- two_boxes: "leftTitle", "leftContent", "rightTitle", "rightContent" (krátké).
- flow_steps: "flowSteps" (3–6 stručných kroků).
- sorting: "sortingCategories" (2–4 prvky { id, label }), "sortingItems" (6–12 prvků { text, categoryId }).
- flashcards: "flashcards" (4–8 prvků { front, back }).
- word_search: "wordSearchWords" (4–8 slov VELKÝMI PÍSMENY bez diakritiky), volitelně "wordSearchSize" (8–16).
- Jazyk: čeština (cs-CZ), formálně ale srozumitelně pro studenty.`;

    const userPrompt = `Téma lekce: ${lessonTitle || "(bez názvu)"}

Obsah lekce:
${lessonContent.slice(0, 12000)}

${hint ? `Doplňující pokyn učitele: ${hint}\n\n` : ""}Vytvoř pracovní list (${safeCount} bloků, režim: ${worksheetMode}, obtížnost: ${difficulty}).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [{
          type: "function",
          function: {
            name: "create_full_worksheet",
            description: "Vytvoří kompletní pracovní list z obsahu lekce.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: DEFAULT_TYPES },
                      prompt: { type: "string" },
                      points: { type: "number" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      timeEstimateSec: { type: "number" },
                      choices: { type: "array", items: { type: "string" } },
                      correctAnswer: { type: "string" },
                      blankText: { type: "string" },
                      matchPairs: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { left: { type: "string" }, right: { type: "string" } },
                          required: ["left", "right"],
                        },
                      },
                      orderItems: { type: "array", items: { type: "string" } },
                      lineCount: { type: "number" },
                      lineStyle: { type: "string", enum: ["dotted", "solid", "dashed"] },
                      instructionVariant: { type: "string", enum: ["blue", "yellow", "green", "purple"] },
                      instructionIcon: { type: "string", enum: ["info", "video", "write", "discuss", "group"] },
                      leftTitle: { type: "string" },
                      leftContent: { type: "string" },
                      rightTitle: { type: "string" },
                      rightContent: { type: "string" },
                      flowSteps: { type: "array", items: { type: "string" } },
                    },
                    required: ["type", "prompt"],
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_full_worksheet" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatek kreditů pro AI generování." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-full-worksheet error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
