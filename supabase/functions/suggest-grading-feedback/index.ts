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

    const {
      studentAnswer = "",
      question = "",
      score,
      maxScore,
      isCorrect,
    }: {
      studentAnswer?: string | Record<string, any>;
      question?: string;
      score?: number | null;
      maxScore?: number | null;
      isCorrect?: boolean | null;
    } = await req.json();

    const answerText =
      typeof studentAnswer === "string"
        ? studentAnswer
        : JSON.stringify(studentAnswer ?? "", null, 2);

    if (!answerText.trim() && !question.trim()) {
      return new Response(JSON.stringify({ error: "Chybí kontext odpovědi." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scoreLine =
      score != null
        ? `\nSkóre: ${score}${maxScore != null ? ` / ${maxScore}` : ""}`
        : "";
    const correctLine =
      isCorrect === true
        ? "\nOdpověď je vyhodnocena jako správná."
        : isCorrect === false
        ? "\nOdpověď je vyhodnocena jako nesprávná."
        : "";

    const systemPrompt = `Jsi zkušený český pedagog. Napíšeš krátkou, konstruktivní zpětnou vazbu k odpovědi žáka – 2 až 3 věty, česky, formálním tónem (vykání učiteli není potřeba, píšeš žákovi – tykej mu), povzbudivě ale věcně.

ZÁSADY:
- Nejdřív krátce pochval, co je dobře.
- Poté jemně upozorni na nedostatky nebo navrhni, co zlepšit.
- Buď konkrétní, ne obecné fráze.
- Nikdy nediktuj správnou odpověď doslovně – navrhni směr.
- Odpověz pouze samotným textem zpětné vazby, bez uvozovek, bez úvodu, bez podpisu.`;

    const userPrompt = `Zadání / otázka:
"""
${question || "(neuvedeno)"}
"""

Odpověď žáka:
"""
${answerText || "(prázdná odpověď)"}
"""${scoreLine}${correctLine}

Napiš návrh zpětné vazby (2–3 věty).`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to prosím za chvíli." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů pro AI. Kontaktujte administrátora." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const feedback: string = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!feedback) {
      return new Response(JSON.stringify({ error: "Prázdná odpověď z AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-grading-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
