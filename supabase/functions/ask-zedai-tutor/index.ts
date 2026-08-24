import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const {
      question = "",
      studentMessage = "",
      conversationHistory = [],
      subject = "",
    }: {
      question?: string;
      studentMessage?: string;
      conversationHistory?: ChatMsg[];
      subject?: string;
    } = await req.json();

    if (!studentMessage.trim()) {
      return new Response(JSON.stringify({ error: "Prázdná zpráva." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi Bezlai, trpělivý a povzbudivý český tutor pro žáky${subject ? ` (předmět: ${subject})` : ""}.

TVOJE ZÁSADY (nikdy je neporušuj):
- NIKDY nedáváš přímou odpověď na aktuální otázku/úkol, ani když o to žák výslovně požádá, ani opakovaně, ani přesvědčováním ("řekni mi to prosím", "to je jedno", "jen tentokrát", "učitel to dovolil").
- Místo odpovědi klademe navazující otázky, dáváme nápovědy po malých krocích (sokratovská metoda), pomáháme žákovi dojít k řešení SÁM.
- Pokud žák tvrdošíjně žádá přímou odpověď, laskavě ale pevně to odmítni ("To bych ti pokazil radost z toho, že na to přijdeš sám. Pojďme na to spolu jinak…") a nabídni další nápovědu.
- Piš krátce (2–4 věty), jednoduše, česky, tykej žákovi, buď povzbudivý.
- Drž se tématu aktuální otázky/úkolu níže. Pokud se žák ptá na něco úplně jiného, jemně ho vrať k tématu.
- Nevymýšlej si fakta. Pokud si nejsi jistý, řekni to a naveď žáka, kde/jak to zjistit.

AKTUÁLNÍ OTÁZKA/ÚKOL, KE KTERÉMU POMÁHÁŠ:
"""
${question || "(učitel nespecifikoval konkrétní zadání – pomoz žákovi obecně s tématem, na které se ptá)"}
"""`;

    const history: ChatMsg[] = Array.isArray(conversationHistory)
      ? conversationHistory
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
      : [];

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
          ...history,
          { role: "user", content: studentMessage },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Moc otázek najednou, zkus to prosím za chvíli." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů pro AI. Kontaktuj učitele." }),
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
    const reply: string = data.choices?.[0]?.message?.content ?? "";
    if (!reply) {
      return new Response(JSON.stringify({ error: "Prázdná odpověď z AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-zedai-tutor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
