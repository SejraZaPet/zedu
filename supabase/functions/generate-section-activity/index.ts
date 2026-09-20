/**
 * generate-section-activity — jedna cílená úloha z textu JEDNÉ sekce lekce.
 * Malý, rychlý dotaz (sekce je vždy krátká) — žádné dávkování.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED = ["mcq", "true_false", "fill_blank", "matching", "ordering"] as const;
type Allowed = (typeof ALLOWED)[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const sectionText = typeof body?.sectionText === "string" ? body.sectionText.trim() : "";
    const sectionTitle = typeof body?.sectionTitle === "string" ? body.sectionTitle.trim() : "";
    const requested = typeof body?.itemType === "string" ? body.itemType : "auto";
    const hint = typeof body?.hint === "string" ? body.hint.trim().slice(0, 500) : "";

    if (sectionText.length + sectionTitle.length < 10) {
      return json({ error: "Sekce neobsahuje dost textu pro generování." }, 400);
    }

    const forcedType: Allowed | null = (ALLOWED as readonly string[]).includes(requested)
      ? (requested as Allowed)
      : null;

    const systemPrompt = `Jsi zkušený český pedagog. Z KRÁTKÉHO textu jedné sekce lekce vytvoříš PŘESNĚ JEDNU úlohu do pracovního listu.

PRAVIDLA:
- Vycházej výhradně z dodaného textu sekce, nic si nevymýšlej.
- Úloha musí být ověřitelná na papíře a v češtině (cs-CZ).
- ${forcedType ? `Typ úlohy musí být "${forcedType}".` : "Typ úlohy vyber sám podle obsahu sekce (mcq, true_false, fill_blank, matching, ordering)."}
- mcq: 4 možnosti, přesně 1 správná (correctChoice musí být jedna z choices).
- true_false: jedno jasné tvrzení + correctBoolean.
- fill_blank: blankText s mezerami "___" a blankAnswers ve stejném pořadí.
- matching: 3–5 párů left/right.
- ordering: 3–6 kroků ve SPRÁVNÉM pořadí.`;

    const userPrompt = `Sekce lekce: ${sectionTitle || "(bez nadpisu)"}

${sectionText.slice(0, 6000)}

${hint ? `Pokyn učitele: ${hint}` : ""}`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "create_section_item",
              description: "Vytvoří jednu úlohu pracovního listu ze sekce lekce.",
              parameters: {
                type: "object",
                required: ["type", "prompt"],
                properties: {
                  type: { type: "string", enum: [...ALLOWED] },
                  prompt: { type: "string" },
                  choices: { type: "array", items: { type: "string" } },
                  correctChoice: { type: "string" },
                  correctBoolean: { type: "boolean" },
                  blankText: { type: "string" },
                  blankAnswers: { type: "array", items: { type: "string" } },
                  matchPairs: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["left", "right"],
                      properties: { left: { type: "string" }, right: { type: "string" } },
                    },
                  },
                  orderItems: { type: "array", items: { type: "string" } },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_section_item" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Příliš mnoho požadavků, zkuste to za chvíli." }, 429);
      if (response.status === 402) return json({ error: "Nedostatek kreditů pro AI generování." }, 402);
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "Chyba AI služby" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call:", JSON.stringify(data).slice(0, 800));
      return json({ error: "AI nevrátila strukturovaný výstup" }, 500);
    }

    const parsed = JSON.parse(toolCall.function.arguments) as Record<string, any>;
    const type: Allowed = forcedType ??
      ((ALLOWED as readonly string[]).includes(parsed.type) ? parsed.type : "mcq");
    const prompt = String(parsed.prompt ?? "").trim();
    if (!prompt) return json({ error: "AI vrátila neúplnou úlohu" }, 500);

    const item: Record<string, unknown> = { type, prompt };
    if (Array.isArray(parsed.choices)) item.choices = parsed.choices.map(String).filter(Boolean);
    if (typeof parsed.correctChoice === "string") item.correctChoice = parsed.correctChoice;
    if (typeof parsed.correctBoolean === "boolean") item.correctBoolean = parsed.correctBoolean;
    if (typeof parsed.blankText === "string") item.blankText = parsed.blankText;
    if (Array.isArray(parsed.blankAnswers)) item.blankAnswers = parsed.blankAnswers.map(String);
    if (Array.isArray(parsed.matchPairs)) {
      item.matchPairs = parsed.matchPairs
        .filter((p: any) => p?.left && p?.right)
        .map((p: any) => ({ left: String(p.left), right: String(p.right) }));
    }
    if (Array.isArray(parsed.orderItems)) item.orderItems = parsed.orderItems.map(String).filter(Boolean);
    if (typeof parsed.difficulty === "string") item.difficulty = parsed.difficulty;

    return json({ item });
  } catch (e) {
    console.error("generate-section-activity error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
