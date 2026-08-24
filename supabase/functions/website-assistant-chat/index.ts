import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Jsi Bezlai – AI asistent na veřejném webu vzdělávací platformy Bezli. Mluvíš česky, profesionálně a věcně, vykáš. Nejsi hravý ani sokratovský – na dotazy odpovídáš PŘÍMO a konkrétně.

Tvoje cílová skupina: ředitelé škol, učitelé, lektoři a rodiče, kteří platformu Bezli zvažují.

ZÁSADY:
- Odpovídej krátce a konkrétně (2–6 věty nebo odrážky).
- Nepoužívej markdown formátování (žádné **, ##, tabulky) – piš čistý text; odrážky uváděj znakem „• “.
- Vycházej POUZE z faktů níže. Co nevíš, přiznej a nasměruj na kontaktní formulář na webu (odkaz „Nechat na sebe kontakt“ přímo v tomto chatu nebo poptávkový formulář na stránce Licence). NIKDY neuváděj konkrétní osobní e-maily, telefony ani jména zaměstnanců.
- Nevymýšlej si funkce, ceny, termíny ani reference.
- Jsi AI, ne člověk – pokud se na to někdo zeptá, potvrď to.

FAKTA O Bezli:
- Bezli je vzdělávací platforma pro školy. Hlavní části: digitální učebnice; živé interaktivní hry a kvízy (podobné Kahootu, ale s AI a více herními režimy); adaptivní procvičování; AI tutor pro žáky (dává nápovědy, ne hotová řešení); žákovské portfolio; BezliMarket pro sdílení výukových materiálů mezi učiteli; Bezli Akademie pro vzdělávání učitelů.
- Spuštění platformy: 19. 8. 2026.
- Ceník – zakladatelská cena: 70 Kč za žáka a rok, časově omezená nabídka pro první školy.
- Ceník – standardní: Start (do 70 žáků) 100 Kč/žák/rok; Růst (do 250 žáků) 110 Kč/žák/rok; Škola (250+ žáků) pásmová cena podle velikosti.
- Lektor (samostatný učitel či lektor bez školy): 490 Kč/rok nebo 49 Kč/měsíc.
- Učitelé platformu používají zdarma – platí se pouze za aktivní žáky.
- Zájem o nabídku, cenovou kalkulaci nebo ukázku: nasměruj na formulář „Nechat na sebe kontakt“ v tomto chatu nebo na poptávkový formulář na webu.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "chat");

    // --- Explicit contact capture (visitor filled the form themselves) ---
    if (action === "lead") {
      const name = String(body?.name ?? "").trim().slice(0, 120);
      const email = String(body?.email ?? "").trim().slice(0, 160);
      const organization = String(body?.organization ?? "").trim().slice(0, 160);
      const note = String(body?.note ?? "").trim().slice(0, 1000);
      const honeypot = String(body?.website ?? "").trim();

      if (honeypot) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "Zadejte prosím platný e-mail." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const orgName = organization || (name ? `Kontakt: ${name}` : email);
      const { data: org, error: orgErr } = await admin
        .from("crm_organizations")
        .insert({
          name: orgName,
          status: "novy",
          source: "web_chat",
          notes: note || null,
        })
        .select("id")
        .single();
      if (orgErr) throw orgErr;

      if (name) {
        const { error: contactErr } = await admin.from("crm_contacts").insert({
          organization_id: org.id,
          name,
          email,
          contact_category: "jine",
          is_primary: true,
          notes: note || null,
        });
        if (contactErr) console.error("crm_contacts insert error:", contactErr);
      } else {
        const { error: contactErr } = await admin.from("crm_contacts").insert({
          organization_id: org.id,
          name: email,
          email,
          contact_category: "jine",
          is_primary: true,
          notes: note || null,
        });
        if (contactErr) console.error("crm_contacts insert error:", contactErr);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = () =>
      createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

    // --- Feedback on a logged answer ---
    if (action === "feedback") {
      const logId = String(body?.logId ?? "").trim();
      const feedback = String(body?.feedback ?? "").trim();
      if (!logId || (feedback !== "up" && feedback !== "down")) {
        return new Response(JSON.stringify({ error: "Neplatná zpětná vazba." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: fbErr } = await adminClient()
        .from("website_chat_logs")
        .update({ feedback })
        .eq("id", logId);
      if (fbErr) throw fbErr;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Chat ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const visitorMessage = String(body?.visitorMessage ?? "").trim().slice(0, 2000);
    const sessionId = String(body?.sessionId ?? "").trim().slice(0, 100) || "unknown";
    if (!visitorMessage) {
      return new Response(JSON.stringify({ error: "Prázdná zpráva." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = body?.conversationHistory;
    const history: ChatMsg[] = Array.isArray(raw)
      ? raw
          .filter(
            (m: ChatMsg) =>
              m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
          )
          .slice(-20)
          .map((m: ChatMsg) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
      : [];

    // Doplňkové znalosti spravované adminem – mají přednost před obecnými fakty.
    const admin = adminClient();
    let systemPrompt = SYSTEM_PROMPT;
    const { data: faqs, error: faqErr } = await admin
      .from("website_assistant_faq")
      .select("question, answer")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(200);
    if (faqErr) console.error("faq load error:", faqErr);
    if (faqs && faqs.length > 0) {
      const block = faqs
        .map((f: { question: string; answer: string }) => `Otázka: ${f.question}\nOdpověď: ${f.answer}`)
        .join("\n\n");
      systemPrompt += `\n\nDOPLŇKOVÉ ZNALOSTI (aktualizováno adminem) – tyto informace jsou nejaktuálnější a mají PŘEDNOST před obecnými fakty výše:\n${block}`;
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: visitorMessage },
        ],
      }),
    });


    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Právě je vysoký zájem, zkuste to prosím za chvíli." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({
            error: "Asistent je momentálně nedostupný. Použijte prosím kontaktní formulář.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      console.error("AI gateway error:", resp.status, await resp.text());
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

    let logId: string | null = null;
    const { data: logRow, error: logErr } = await admin
      .from("website_chat_logs")
      .insert({ session_id: sessionId, question: visitorMessage, answer: reply })
      .select("id")
      .single();
    if (logErr) console.error("website_chat_logs insert error:", logErr);
    else logId = logRow?.id ?? null;

    return new Response(JSON.stringify({ reply, logId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("website-assistant-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
