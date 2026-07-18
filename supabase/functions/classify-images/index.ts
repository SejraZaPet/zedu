import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_IMAGES = 40;

const SYSTEM = `Klasifikuj obrázky z výukového materiálu. Pro každý obrázek rozhodni:
- "decorative_text" = obrázek je primárně velký nadpis, banner s titulkem, ozdobné písmo nebo dekorativní grafika s textem (informace už jsou zachyceny v textovém obsahu stránky).
- "content" = skutečný informační obsah: diagram, schéma, graf, fotografie, ilustrace, mapa, kresba, tabulka jako obrázek.
Vrať čistě strukturovaný výstup přes tool klasifikace ve stejném pořadí, v jakém dostáváš obrázky.`;

const TOOL = {
  type: "function",
  function: {
    name: "classify",
    description: "Klasifikace obrázků v pořadí vstupu.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["classifications"],
      properties: {
        classifications: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["category"],
            properties: {
              category: { type: "string", enum: ["decorative_text", "content"] },
            },
          },
        },
      },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY není nakonfigurován.");

    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return jsonResponse({ classifications: [] });
    }
    const clean = urls
      .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http"))
      .slice(0, MAX_IMAGES);

    if (clean.length === 0) return jsonResponse({ classifications: [] });

    const content: any[] = [
      {
        type: "text",
        text: `Klasifikuj následujících ${clean.length} obrázků v pořadí, v jakém jsou uvedeny. Odpověz přesně ${clean.length} položkami.`,
      },
    ];
    clean.forEach((url, idx) => {
      content.push({ type: "text", text: `Obrázek ${idx + 1}:` });
      content.push({ type: "image_url", image_url: { url } });
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "classify" } },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Gateway classify failed: ${response.status} - ${errText.slice(0, 400)}`);
    }

    const aiResult = await response.json();
    const argsRaw = aiResult?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) throw new Error("AI nevrátila strukturovanou klasifikaci.");
    const parsed = JSON.parse(argsRaw);
    const list = Array.isArray(parsed?.classifications) ? parsed.classifications : [];

    // Pad/trim to match input length; unknown => "content" (safe default keeps image)
    const classifications = clean.map((_, idx) => {
      const cat = list[idx]?.category;
      return cat === "decorative_text" ? "decorative_text" : "content";
    });

    return jsonResponse({ classifications });
  } catch (err) {
    console.error("classify-images error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Neznámá chyba", classifications: [] },
      500,
    );
  }
});
