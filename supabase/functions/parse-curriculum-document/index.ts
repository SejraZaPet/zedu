import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_CHARS = 20000;

/** Sekce předmětového ŠVP – musí odpovídat CURRICULUM_SECTIONS v src/lib/curriculum-template.ts */
const SECTIONS = [
  "Pojetí a cíl předmětu",
  "Charakteristika učiva",
  "Strategie výuky – Metody výuky",
  "Strategie výuky – Metody ověřování",
  "Hodnocení výsledků žáků",
  "Přínos ke klíčovým kompetencím a průřezovým tématům",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.extractedText ?? "").trim();
    const subject = String(body?.subject ?? "").trim();

    if (raw.length < 100) {
      return json(
        {
          error:
            "Ze souboru se nepodařilo získat dost textu (méně než 100 znaků). Zkuste jiný soubor nebo obsah vložte ručně.",
        },
        400,
      );
    }

    const truncated = raw.length > MAX_CHARS;
    const clean = truncated ? raw.slice(0, MAX_CHARS) : raw;

    const systemPrompt = `Jsi zkušený český pedagog a metodik. Z předloženého textu školního vzdělávacího plánu (ŠVP) vytvoříš strukturovaný návrh PŘEDMĚTOVÉHO ŠVP.

Pravidla:
- Piš česky, věcně a formálně (jazyk pedagogické dokumentace).
- Vyplň všech ${SECTIONS.length} sekcí v tomto přesném pořadí a s přesně těmito nadpisy: ${SECTIONS.map((s) => `"${s}"`).join(", ")}.
- Každou sekci napiš jako 2–6 vět souvislého textu vycházejícího Z TEXTU. Pokud text k sekci nic neobsahuje, napiš krátký návrh vycházející z oboru předmětu a začni věty slovem "Návrh:".
- Rozpis učiva: rozděl učivo po ročnících. Počet ročníků odhadni z textu; pokud to z textu nejde poznat, použij 3 ročníky.
- Každý ročník má 3–10 řádků. Každý řádek: "results" = výsledky vzdělávání (co žák umí), "content" = učivo, "timing" = časové rozvržení (např. "16 hodin" nebo "září–listopad").
- Nevymýšlej si obory ani témata, která z textu vůbec nevyplývají.`;

    const userPrompt = `${subject ? `Předmět: ${subject}\n\n` : ""}Text ŠVP:\n"""${clean}"""\n\nVytvoř strukturovaný návrh předmětového ŠVP.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "return_curriculum",
              description: "Vrať strukturovaný návrh předmětového ŠVP.",
              parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    description: "Sekce ŠVP v daném pořadí.",
                    items: {
                      type: "object",
                      properties: {
                        heading: { type: "string" },
                        text: { type: "string" },
                      },
                      required: ["heading", "text"],
                      additionalProperties: false,
                    },
                  },
                  years: {
                    type: "array",
                    description: "Rozpis učiva po ročnících.",
                    items: {
                      type: "object",
                      properties: {
                        year: { type: "number" },
                        rows: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              results: { type: "string" },
                              content: { type: "string" },
                              timing: { type: "string" },
                            },
                            required: ["results", "content", "timing"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["year", "rows"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sections", "years"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_curriculum" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return json({ error: "Příliš mnoho požadavků, zkuste to prosím za chvíli znovu." }, 429);
      if (resp.status === 402)
        return json(
          { error: "Nedostatek kreditů pro AI generování. Kontaktujte administrátora." },
          402,
        );
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return json({ error: "Chyba AI služby. Zkuste to prosím znovu." }, 500);
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return json({ error: "AI nevrátila strukturovaný výstup." }, 500);

    let parsed: any;
    try {
      parsed = JSON.parse(tc.function.arguments);
    } catch {
      return json({ error: "AI vrátila poškozený výstup. Zkuste to prosím znovu." }, 500);
    }

    const str = (v: unknown) => String(v ?? "").trim();

    // Sekce srovnáme na kanonické pořadí/nadpisy.
    const aiSections: { heading: string; text: string }[] = Array.isArray(parsed?.sections)
      ? parsed.sections.map((s: any) => ({ heading: str(s?.heading), text: str(s?.text) }))
      : [];
    const sections = SECTIONS.map((heading, i) => {
      const match =
        aiSections.find((s) => s.heading.toLowerCase() === heading.toLowerCase()) ?? aiSections[i];
      return { heading, text: match?.text ?? "" };
    });

    const years = (Array.isArray(parsed?.years) ? parsed.years : [])
      .map((y: any, i: number) => ({
        year: Number(y?.year) > 0 ? Math.min(Math.round(Number(y.year)), 12) : i + 1,
        rows: (Array.isArray(y?.rows) ? y.rows : [])
          .map((r: any) => ({
            results: str(r?.results),
            content: str(r?.content),
            timing: str(r?.timing),
          }))
          .filter((r: any) => r.results || r.content || r.timing)
          .slice(0, 30),
      }))
      .filter((y: any) => y.rows.length > 0)
      .slice(0, 12);

    const filledSections = sections.filter((s) => s.text.length > 20).length;
    if (filledSections === 0 && years.length === 0) {
      return json(
        {
          error:
            "AI z dokumentu nedokázala vytěžit použitelný obsah. Zkuste jiný soubor nebo vyplňte ŠVP ručně.",
        },
        422,
      );
    }

    return json({
      sections,
      years,
      truncated,
      inputChars: raw.length,
      usedChars: clean.length,
      filledSections,
    });
  } catch (e) {
    console.error("parse-curriculum-document error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
