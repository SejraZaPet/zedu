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

    const { topic = "", teamCount = 2, existingTeamNames = [] } = await req.json();
    const cleanTopic = String(topic || "").trim().slice(0, 4000);
    const count = Math.max(2, Math.min(6, Number(teamCount) || 2));

    if (!cleanTopic) {
      return new Response(JSON.stringify({ error: "Zadejte téma nebo zadání." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamNames: string[] = Array.isArray(existingTeamNames)
      ? existingTeamNames.map((n) => String(n)).slice(0, count)
      : [];

    const systemPrompt = `Jsi Bezlai – zkušený český pedagog. Pro dané téma vytvoříš přesně ${count} různých variant úkolu/otázky, každou pro jinou skupinu žáků ve třídě.

Pravidla:
- Vygeneruj přesně ${count} variant – jednu pro každou skupinu.
- Varianty MUSÍ být skutečně různé – lišit se konkrétními čísly, úhlem pohledu, kontextem, obtížností, materiálem nebo způsobem řešení – podle typu tématu se sám rozhodni, co dává pedagogicky smysl variovat.
- Vyhni se banálním rozdílům (jen přeformulování stejné otázky). Každá varianta musí být samostatný, plnohodnotný úkol.
- Každá varianta má krátký "title" (název úkolu, 3–6 slov) a "content" (samotné zadání pro žáky, 1–4 věty, konkrétní a jasné).
- Piš česky, srozumitelně pro žáky (tykání, běžný jazyk – ne pedagogický žargon).`;

    const teamsHint = teamNames.length
      ? `\nNázvy skupin (jen pro tvou orientaci, do zadání je nepiš): ${teamNames.join(", ")}`
      : "";

    const userPrompt = `Téma / společné zadání od učitele:\n"""${cleanTopic}"""\n\nVytvoř ${count} různých variant.${teamsHint}`;

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
              name: "return_variants",
              description: "Vrať pole variant úkolu.",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                      },
                      required: ["title", "content"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_variants" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to prosím za chvíli znovu." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů pro AI generování. Kontaktujte administrátora." }),
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
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(tc.function.arguments);
    let tasks: Array<{ title: string; content: string }> = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    // Ensure length exactly matches count.
    if (tasks.length > count) tasks = tasks.slice(0, count);
    while (tasks.length < count) {
      tasks.push({ title: `Varianta ${tasks.length + 1}`, content: cleanTopic });
    }
    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-differentiated-tasks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
