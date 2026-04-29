// AI návrhy textu notifikace pro učitele/admina.
// Vrací { title, content } v češtině podle typu (reminder / message / info / warning / update).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const TOOL = {
  type: "function",
  function: {
    name: "compose_notification",
    description:
      "Navrhni krátký český text notifikace (titulek + obsah) podle typu a kontextu. Tonalita: vstřícný učitel, tykání žákům.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["title", "content"],
      properties: {
        title: {
          type: "string",
          minLength: 3,
          maxLength: 120,
          description: "Stručný titulek (max 120 znaků), bez emoji.",
        },
        content: {
          type: "string",
          minLength: 10,
          maxLength: 600,
          description:
            "Tělo zprávy v češtině, 1–3 věty, přátelský tón, bez podpisu.",
        },
      },
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY není nastaven" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const type: string = body.type ?? "message";
    const subject: string = (body.subject ?? "").toString().slice(0, 200);
    const dueDate: string | null = body.dueDate ?? null;
    const audience: string = body.audience ?? "žáky"; // "žáky" / "učitele" / "celou třídu"
    const extra: string = (body.extra ?? "").toString().slice(0, 500);

    const userPrompt = [
      `Typ notifikace: ${type}`,
      subject ? `Předmět/kontext: ${subject}` : null,
      dueDate ? `Termín: ${dueDate}` : null,
      `Oslovuji: ${audience}`,
      extra ? `Doplňující info: ${extra}` : null,
      "Napiš krátký titulek a obsah notifikace v češtině.",
    ]
      .filter(Boolean)
      .join("\n");

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
            {
              role: "system",
              content:
                "Jsi pomocník učitele. Generuješ stručné, přátelské české notifikace. Tykáš žákům, vykáš učitelům. Bez emoji, bez podpisu.",
            },
            { role: "user", content: userPrompt },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "compose_notification" } },
        }),
      },
    );

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Příliš mnoho požadavků. Zkus to za chvíli." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Vyčerpaný kredit AI. Doplň ho v Nastavení." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(
        JSON.stringify({ error: "AI chyba", detail: txt }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    let parsed: { title?: string; content?: string } = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args ?? {};
    } catch {
      parsed = {};
    }

    return new Response(
      JSON.stringify({
        title: parsed.title ?? "",
        content: parsed.content ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
