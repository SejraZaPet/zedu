import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Popis požadovaného JSON tvaru pro každý typ aktivity. */
const SHAPES: Record<string, string> = {
  quiz: `{"quiz":{"questions":[{"question":"...","answers":[{"text":"...","correct":true},{"text":"...","correct":false}],"explanation":"..."}]}} – POLE RŮZNÝCH otázek (nikdy jen jedna!), každá otázka má 4 možnosti a přesně 1 správnou a krátké vysvětlení`,
  flashcards: `{"flashcards":[{"front":"pojem","back":"vysvětlení"}]} – 5 až 8 kartiček`,
  matching: `{"matching":{"left":["A1","A2"],"right":["B1","B2"]}} – 5 až 8 párů, položky na stejné pozici tvoří správný pár`,
  memory_game: `{"memoryGame":{"pairs":[{"left":"pojem","right":"definice"}]}} – 5 až 8 párů`,
  reveal_cards: `{"revealCards":{"cards":[{"title":"název","content":"otázka nebo úkol"}]}} – 4 až 6 kartiček`,
  true_false: `{"trueFalse":{"statements":[{"text":"tvrzení","isTrue":true}]}} – 6 až 8 tvrzení, mix pravdivých i nepravdivých`,
  ordering: `{"ordering":{"items":["1. krok","2. krok"]}} – 4 až 7 kroků ve správném pořadí`,
  sorting: `{"sorting":{"groups":["Skupina A","Skupina B"],"items":[{"text":"položka","group":0}]}} – 2 až 3 skupiny, 6 až 9 položek; group je index skupiny`,
  crossword: `{"crossword":{"entries":[{"answer":"SLOVO","clue":"nápověda"}]}} – 6 až 10 slov bez diakritiky a mezer, VELKÝMI písmeny`,
  fill_blanks: `{"fillBlanks":{"text":"Věta s {{doplňovaným}} slovem."}} – 3 až 6 vět, doplňovaná slova ve dvojitých složených závorkách`,
  fill_choice: `{"fillChoice":{"text":"Věta s {{doplňovaným}} slovem.","options":["chybná možnost 1","chybná možnost 2"]}} – 3 až 6 vět a 3 distraktory`,
  wall: `{"question":"otevřená otázka pro brainstorming celé třídy"}`,
  poll: `{"question":"otázka k hlasování","options":[{"text":"možnost 1"},{"text":"možnost 2"}]} – 3 až 5 možností`,
  image_label: `{"imageLabel":{"markers":[{"label":"popisek","x":50,"y":50}]}} – 4 až 6 popisků, x a y v procentech`,
  image_hotspot: `{"imageHotspot":{"hotspots":[{"label":"otázka nebo název oblasti","x":50,"y":50,"radius":8}]}} – 3 až 5 oblastí`,
  summary: `{"summary":{"title":"Shrnutí lekce","text":"<ul><li>klíčový bod</li><li>klíčový bod</li></ul>"}} – 4 až 7 krátkých klíčových bodů shrnujících učivo, text jako jednoduché HTML (<ul><li>…</li></ul>, případně <p>), bez nadpisů`,
};


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const activityType = typeof body?.activityType === "string" ? body.activityType : "quiz";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const context = typeof body?.context === "string" ? body.context.trim() : "";
    const methods = Array.isArray(body?.methods)
      ? body.methods
          .filter((m: unknown) => typeof m === "string")
          .map((m: string) => m.trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];
    const rawCount = Number(body?.questionCount);
    const questionCount =
      activityType === "quiz" && Number.isFinite(rawCount) && rawCount > 0
        ? Math.min(10, Math.max(1, Math.round(rawCount)))
        : activityType === "quiz"
          ? 5
          : null;
    const rawCardCount = Number(body?.cardCount);
    const cardCount =
      activityType === "flashcards" && Number.isFinite(rawCardCount) && rawCardCount > 0
        ? Math.min(15, Math.max(2, Math.round(rawCardCount)))
        : activityType === "flashcards"
          ? 6
          : null;
    const shape = SHAPES[activityType];

    if (!shape) return json({ error: `Typ aktivity „${activityType}" není podporován.` }, 400);
    if (topic.length + context.length < 3) {
      return json({ error: "Doplňte téma nebo krátký podklad, ze kterého má AI vycházet." }, 400);
    }

    const hasContext = context.length >= 20;

    const systemPrompt = `Jsi zkušený český pedagog a tvoříš obsah interaktivních školních aktivit.
Odpovídáš VÝHRADNĚ jedním platným JSON objektem – bez markdownu, bez komentářů, bez textu okolo.
Vše piš česky (cs-CZ), věcně správně a přiměřeně střední škole.
Do JSON přidej i "title" (krátký název aktivity) a "instructions" (1 věta pokynu pro žáka).${
      hasContext
        ? `
DŮLEŽITÉ: Uživatel dodal konkrétní PODKLAD. Veškerý obsah aktivity musí vycházet VÝHRADNĚ z faktů,
pojmů a formulací v tomto podkladu. Nevymýšlej si vlastní téma ani fakta, která v podkladu nejsou,
a nedoplňuj obecné učivo. Otázky, tvrzení, páry i kartičky parafrázuj z konkrétních vět podkladu.
Pokud je podkladu málo, vytvoř méně položek, ale nikdy nepřidávej cizí obsah.`
        : ""
    }`;

    const methodsPart = methods.length
      ? `\n\nVýukové metody, které máš zohlednit: ${methods.join(", ")}.
Přizpůsob jim formu a znění aktivity i pokyn v "instructions" (např. u kooperativních metod zadání pro dvojice
nebo skupiny, u badatelských metod otázky vedoucí k objevování).`
      : "";

    const quizPart = questionCount
      ? `\n\nPOČET OTÁZEK: vytvoř přesně ${questionCount} různých otázek (pole "questions" má mít ${questionCount} prvků),
pokud na to podklad látkou stačí. Každá otázka musí mít 4 možnosti a přesně 1 správnou.${
          hasContext
            ? `
POKRYTÍ PODKLADU: rozlož otázky rovnoměrně po CELÉM podkladu – od začátku do konce, ne jen z prvních vět.
Nejprve si v duchu vypiš všechny odlišné faktické informace v podkladu a ke každé otázce použij JINOU z nich.
Otázky se nesmí obsahově opakovat. Pokud podklad nabízí méně odlišných faktů než ${questionCount},
vytvoř méně otázek – ale nikdy nezůstávej u zlomku obsahu, když lze pokrýt více.`
            : ""
        }`
      : "";

    const userPrompt = hasContext
      ? `Typ aktivity: ${activityType}
Požadovaný tvar JSON: ${shape}

PODKLAD (jediný zdroj obsahu – čerpej pouze z něj):
"""
${context.slice(0, 6000)}
"""

${topic ? `Pomocný popisek sekce (jen orientační, NENÍ téma k vymýšlení): ${topic.slice(0, 120)}` : ""}

Vytvoř obsah aktivity založený na konkrétních faktech výše. Každá položka musí mít oporu v podkladu.${methodsPart}${quizPart}`
      : `Typ aktivity: ${activityType}
Požadovaný tvar JSON: ${shape}

Téma / název aktivity: ${topic || "(neuvedeno)"}

Podklad nebyl dodán – vytvoř obsah k uvedenému tématu.${methodsPart}${quizPart}`;

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
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Příliš mnoho požadavků, zkuste to za chvíli." }, 429);
      if (response.status === 402) return json({ error: "Nedostatek kreditů pro AI generování." }, 402);
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "Chyba AI služby" }, 500);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed || typeof parsed !== "object") {
      console.error("Unparsable AI output:", raw);
      return json({ error: "AI nevrátila použitelný výstup. Zkuste to znovu." }, 500);
    }

    // Sjednocení tvaru kvízu na { questions: [...] } – model může vrátit
    // pole otázek, jednu otázku, nebo pole pod jiným klíčem.
    const q = (parsed as any).quiz;
    if (Array.isArray(q)) (parsed as any).quiz = { questions: q };
    else if (q && typeof q === "object" && !Array.isArray(q.questions) && q.question) {
      (parsed as any).quiz = { questions: [q] };
    } else if (!q && Array.isArray((parsed as any).questions)) {
      (parsed as any).quiz = { questions: (parsed as any).questions };
    }

    return json({ props: { ...parsed, activityType } });
  } catch (e) {
    console.error("generate-activity-content error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
