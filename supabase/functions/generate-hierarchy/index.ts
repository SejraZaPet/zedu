import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { text } = await req.json();
    if (typeof text !== "string" || text.trim().length < 8) {
      return new Response(JSON.stringify({ error: "Missing or too short 'text'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog. Ze zadaného textu vytvoříš hierarchickou strukturu (pyramidu) pro výuku.

PRAVIDLA:
- Rozděl obsah na 3 až 6 úrovní hierarchie od nejobecnější / nejzákladnější (nahoře) po nejkonkrétnější / nejvyšší (dole), nebo naopak – podle logiky obsahu.
- Každá úroveň má krátký label (2–5 slov) a volitelně stručný description (1 věta, max ~120 znaků).
- Vše piš česky (cs-CZ).
- Neopakuj text – shrnuj ho do koncepčních úrovní.`;

    const userPrompt = `Vytvoř hierarchii z tohoto obsahu:

${text.slice(0, 4000)}`;

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
              name: "create_hierarchy",
              description: "Vrátí hierarchickou strukturu s úrovněmi.",
              parameters: {
                type: "object",
                additionalProperties: false,
                required: ["direction", "levels"],
                properties: {
                  direction: {
                    type: "string",
                    enum: ["top-to-bottom", "bottom-to-top"],
                    description: "Směr hierarchie",
                  },
                  levels: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["label"],
                      properties: {
                        label: { type: "string", description: "Krátký název úrovně" },
                        description: { type: "string", description: "Stručný popis úrovně (volitelné)" },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_hierarchy" } },
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

    const parsed = JSON.parse(toolCall.function.arguments) as {
      direction?: "top-to-bottom" | "bottom-to-top";
      levels?: Array<{ label?: string; description?: string }>;
    };

    // Clamp to 3–6 levels; ensure ids and safe strings.
    const rawLevels = Array.isArray(parsed.levels) ? parsed.levels : [];
    const clampedLevels = rawLevels
      .map((l) => ({
        id: crypto.randomUUID(),
        label: typeof l.label === "string" ? l.label.trim().slice(0, 80) : "",
        description: typeof l.description === "string" ? l.description.trim().slice(0, 160) : "",
      }))
      .filter((l) => l.label.length > 0)
      .slice(0, 6);

    if (clampedLevels.length < 2) {
      return new Response(JSON.stringify({ error: "AI vrátila příliš málo úrovní" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        hierarchy: {
          shape: "pyramid",
          direction: parsed.direction === "bottom-to-top" ? "bottom-to-top" : "top-to-bottom",
          levels: clampedLevels,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-hierarchy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
