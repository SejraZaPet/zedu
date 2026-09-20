import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, hasRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TYPES = [
  "mcq", "true_false", "fill_blank", "matching", "ordering",
  "short_answer", "open_answer", "section_header", "write_lines",
  "instruction_box", "two_boxes", "flow_steps",
  "sorting", "flashcards", "word_search",
];

/** Bloky, které představují aktivitu (žák něco řeší). */
const ACTIVITY_TYPES = [
  "mcq", "matching", "sorting", "crossword", "word_search", "flashcards",
  "image_label", "image_hotspot", "ordering", "fill_blank", "true_false",
  "short_answer", "open_answer",
];

/** Layoutové bloky (prostor na zápis / strukturu listu). */
const LAYOUT_TYPES = ["section_header", "write_lines", "two_boxes", "instruction_box", "flow_steps"];

const RHYTHM_RULE = `RYTMUS ZÁPIS / AKTIVITA (povinné v tomto režimu):
- Po každých 1–2 aktivitových blocích (${ACTIVITY_TYPES.join(", ")}) vlož JEDEN layoutový blok na poznámky: "write_lines", "two_boxes", nebo dvojici "section_header" + "write_lines".
- Nikdy nedávej za sebou 3 a více aktivitových bloků bez prostoru na zápis.
- Layoutové bloky nejsou dekorace — "prompt" u write_lines musí říkat, co si má žák zapsat (např. "Zapiš si definici vlastními slovy").`;

/** Poměr poznámky vs. aktivity. */
const RATIO_GUIDANCE: Record<string, string> = {
  notes:
    "POMĚR: hlavně poznámky — cca 60–70 % bloků layoutových (write_lines s lineCount 6–8, two_boxes, section_header), zbytek jednoduché aktivity. Po každé aktivitě následuje prostor na zápis.",
  balanced:
    "POMĚR: vyvážené — cca 50 % layoutových bloků na zápis (write_lines s lineCount 4–6) a 50 % aktivit, pravidelně se střídají.",
  activities:
    "POMĚR: hlavně aktivity — cca 70 % aktivitových bloků, prostor na zápis (write_lines s lineCount 3–4) vlož po každých 2 aktivitách.",
};

const MODE_GUIDANCE: Record<string, string> = {
  classwork: "Mix typů — kombinuj mcq, true_false, fill_blank, short_answer, matching a sekce.",
  test: "Hlavně mcq, true_false, fill_blank, matching a short_answer. Bez instruction_box.",
  revision: "Hlavně matching, ordering, fill_blank, mcq. Žádné dlouhé otevřené otázky.",
  homework: "Hlavně open_answer, short_answer, reflexivní instruction_box.",
  worksheet: "Hlavně section_header, write_lines, instruction_box, two_boxes, flow_steps. Min. mcq/true_false.",
  study:
    "Výukový list – zápis a aktivity: list slouží k zápisu do hodiny i k procvičení. Prokládej výklad/zápis a aktivity, začni section_header, používej write_lines, two_boxes a instruction_box pro strukturu zápisu.",
  technique:
    "Technika s videi: list popisuje jednu technologickou úpravu / postup. Postupuj takto: (1) první blok section_header = přesný název techniky nebo postupu (např. „Pečení“, „Dušení“) bez dalších slov; (2) hned poté write_lines s promptem typu „Charakteristika – doplň při výkladu“ (lineStyle \"dotted\", lineCount 3–4), kam si žák doplní definici; (3) flow_steps se schématem postupu — konkrétní kroky odvoď z tématu (např. Výběr suroviny → Předběžná úprava → Průběh → Dokončení), 3–6 kroků; (4) dále střídej section_header + write_lines (tečkované doplňovací řádky) pro dílčí postupy (např. „Příprava šťávy“) a two_boxes pro srovnání dvou variant postupu, kde leftContent/rightContent obsahují jen krátké nadpisy bodů k doplnění; (5) doplň max. 1–2 krátké kontrolní otázky (short_answer nebo true_false). Nepoužívej dlouhé otevřené otázky ani mcq.",
};

function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Převede nové bloky na starší tvar variants/answerKeys (zpětná kompatibilita UI plánů hodin). */
function toLegacyWorksheet(
  items: any[],
  meta: { title: string; subject?: string; gradeBand?: string; worksheetMode?: string; deadline?: string },
  variantIds: string[],
) {
  const base = items.map((it, i) => ({
    itemNumber: i + 1,
    type: it.type,
    question: it.prompt ?? it.blankText ?? "",
    options: it.choices ?? it.orderItems ?? undefined,
    matchPairs: it.matchPairs ?? undefined,
    points: typeof it.points === "number" ? it.points : 0,
    difficulty: it.difficulty ?? "medium",
    correctAnswer: it.correctAnswer ?? "",
  }));

  const variants = variantIds.map((vid, vi) => {
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const ordered = vi === 0 ? base : shuffleSeeded(base, seed);
    return {
      id: vid,
      seed,
      items: ordered.map((it, i) => ({ ...it, itemNumber: i + 1 })),
    };
  });

  const answerKeys: Record<string, any[]> = {};
  for (const v of variants) {
    answerKeys[v.id] = v.items
      .filter((it) => !LAYOUT_TYPES.includes(it.type))
      .map((it) => ({ itemNumber: it.itemNumber, correctAnswer: String(it.correctAnswer ?? "") }));
  }

  return {
    ...meta,
    variants,
    answerKeys,
    randomizationRules: [{ rule: "Přeházené pořadí úloh", appliedTo: variantIds.slice(1).join(", ") || "—" }],
    totalPoints: base.reduce((a, b) => a + (b.points || 0), 0),
    difficultyDistribution: {
      easy: base.filter((b) => b.difficulty === "easy").length,
      medium: base.filter((b) => b.difficulty === "medium").length,
      hard: base.filter((b) => b.difficulty === "hard").length,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      worksheetMode = "classwork",
      itemCount = 8,
      difficulty = "mixed",
      hint = "",
      availableTypes,
      notesRatio = "balanced",
      // Vstup z lekce (původní použití)
      lessonContent: rawLessonContent,
      lessonTitle: rawLessonTitle = "",
      // Vstup z plánu hodiny (dřív generate-worksheet)
      lessonPlanId,
      gradeBand,
      numItems,
      variants,
      deadline,
      // Vstup z tématu ŠVP
      topicTitle,
      topicRocnik,
      subject,
      // Kontext z konkrétní lekce: tabulky 1:1, QR odkazy na aktivity, aktivity k přetvoření
      tables,
      qrLinks,
      activityPlan,
    } = body ?? {};

    /** Tabulky z lekce – reprodukují se 1:1, AI je negeneruje. */
    const lessonTables: Array<{ rows: string[][]; caption?: string }> = Array.isArray(tables)
      ? tables
          .filter((t: any) => t && Array.isArray(t.rows) && t.rows.length > 0)
          .map((t: any) => ({
            rows: t.rows.map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c ?? "")) : [])),
            caption: typeof t.caption === "string" ? t.caption : undefined,
          }))
      : [];

    /** QR odkazy na aktivity v lekci (žák si aktivitu otevře v appce). */
    const lessonQrLinks: Array<{ label: string; url: string }> = Array.isArray(qrLinks)
      ? qrLinks
          .filter((q: any) => q && typeof q.url === "string" && q.url)
          .map((q: any) => ({ label: String(q.label ?? "Aktivita"), url: String(q.url) }))
      : [];

    /** Aktivity, které má AI přetvořit na tisknutelné úlohy. */
    const lessonActivityPlan: Array<{ title: string; activityType: string; detail?: string }> =
      Array.isArray(activityPlan)
        ? activityPlan
            .filter((a: any) => a && typeof a.title === "string")
            .map((a: any) => ({
              title: String(a.title),
              activityType: String(a.activityType ?? ""),
              detail: typeof a.detail === "string" ? a.detail : undefined,
            }))
        : [];

    let lessonContent: string = typeof rawLessonContent === "string" ? rawLessonContent : "";
    let lessonTitle: string = rawLessonTitle || "";
    let planSubject: string | undefined = subject || undefined;
    let planGradeBand: string | undefined = gradeBand || undefined;

    // ── Kontext z plánu hodiny ──
    if (lessonPlanId) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: plan, error: planErr } = await sb
        .from("lesson_plans")
        .select("title, subject, grade_band, slides, teacher_id")
        .eq("id", lessonPlanId)
        .single();
      if (planErr || !plan) {
        return new Response(JSON.stringify({ error: "Plán hodiny nenalezen" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isAdmin = await hasRole(auth.userId, "admin");
      if (!isAdmin && plan.teacher_id !== auth.userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const slides = (plan.slides as any[]) || [];
      const slidesText = slides
        .map((s: any, i: number) =>
          `Slide ${i + 1} (${s?.type ?? ""}): ${s?.projector?.headline ?? ""} – ${s?.projector?.body ?? ""}`)
        .join("\n");
      lessonContent = [lessonContent, slidesText].filter((x) => x && x.trim()).join("\n\n");
      lessonTitle = lessonTitle || plan.title || "";
      planSubject = planSubject || plan.subject || undefined;
      planGradeBand = planGradeBand || plan.grade_band || undefined;
    }

    // ── Kontext z tématu ŠVP ──
    if (topicTitle) {
      lessonTitle = lessonTitle || topicTitle;
      lessonContent = [
        `Téma ŠVP: ${topicTitle}`,
        planSubject ? `Předmět: ${planSubject}` : "",
        topicRocnik ? `Ročník: ${topicRocnik}. ročník` : "",
        lessonContent,
      ].filter(Boolean).join("\n");
    }

    if (!lessonContent || lessonContent.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Chybí dostatek vstupního obsahu pro generování pracovního listu." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requestedCount = Math.max(1, Math.min(40, Number(numItems ?? itemCount) || 8));
    const types: string[] = Array.isArray(availableTypes) && availableTypes.length > 0
      ? availableTypes.filter((t: string) => DEFAULT_TYPES.includes(t))
      : DEFAULT_TYPES;

    const diffGuidance: Record<string, string> = {
      easy: "Snadná obtížnost (1. ročník SŠ, základy). Většina difficulty: easy.",
      mixed: "Smíšená obtížnost — kombinuj easy/medium/hard, hlavně medium.",
      hard: "Náročná (maturita) — většina medium/hard, hlubší aplikace pojmů.",
    };

    const isStudyMode = worksheetMode === "study";
    const rhythmSection = isStudyMode
      ? `\n${RHYTHM_RULE}\n${RATIO_GUIDANCE[notesRatio] ?? RATIO_GUIDANCE.balanced}\n`
      : `\nDoporučený rytmus: pokud si režim nebo pokyn učitele vyžádá prostor na poznámky, po každých 1–2 aktivitových blocích vlož jeden layoutový blok (write_lines / two_boxes / section_header + write_lines).\n`;

    /** Nadpisy (sekce) ve zdrojovém textu — list je musí pokrýt všechny. */
    const headingsOf = (text: string): string[] =>
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^#{1,6}\s+/.test(l))
        .map((l) => l.replace(/^#{1,6}\s+/, "").trim())
        .filter(Boolean);

    const allSections = headingsOf(lessonContent);
    // Počet bloků se odvozuje od počtu sekcí (min. 1–2 bloky na sekci).
    const targetCount = Math.max(
      requestedCount,
      Math.min(40, allSections.length * 2),
    );

    /** Dlouhý obsah rozdělíme na dávky na hranicích nadpisů — nic se nezahazuje. */
    const MAX_CHUNK = 9000;
    const chunkContent = (text: string): string[] => {
      if (text.length <= 14000) return [text];
      const lines = text.split(/\r?\n/);
      const chunks: string[] = [];
      let cur: string[] = [];
      let len = 0;
      for (const line of lines) {
        const isHeading = /^#{1,6}\s+/.test(line.trim());
        if (len > 0 && len + line.length > MAX_CHUNK && (isHeading || len > MAX_CHUNK * 1.5)) {
          chunks.push(cur.join("\n"));
          cur = [];
          len = 0;
        }
        cur.push(line);
        len += line.length + 1;
      }
      if (cur.join("").trim()) chunks.push(cur.join("\n"));
      return chunks;
    };

    const chunks = chunkContent(lessonContent);
    const totalLen = chunks.reduce((a, c) => a + c.length, 0) || 1;

    class AiError extends Error {
      status: number;
      constructor(status: number, message: string) {
        super(message);
        this.status = status;
      }
    }

    const buildSystemPrompt = (count: number, sections: string[], isFirst: boolean) =>
      `Jsi expert na tvorbu pracovních listů pro české školy. Na základě vstupního obsahu vygeneruj kompletní pracovní list.

PRAVIDLA:
- Použij VÝHRADNĚ informace z dodaného obsahu, nevymýšlej fakta, čísla ani jména mimo text.
- POKRYTÍ OBSAHU (nejdůležitější pravidlo): pracovní list MUSÍ pokrýt VŠECHNY hlavní nadpisy / sekce dodaného textu, v jejich původním pořadí. Na každou hlavní sekci vytvoř alespoň 1–2 bloky. Nikdy nevybírej jen některé sekce a ostatní neignoruj.${
        sections.length > 0
          ? `\n- Sekce, které MUSÍŠ pokrýt (${sections.length}): ${sections.join(" | ")}.`
          : ""
      }
- Vygeneruj přibližně ${count} bloků (počítáno včetně section_header) — pokud je sekcí víc, vygeneruj raději více bloků, ať je pokrytí úplné.
- Před úlohami k nové sekci vlož "section_header" s názvem té sekce.${
        isFirst
          ? `\n- Začni blokem typu "section_header" s krátkým názvem tématu (prompt = název).`
          : ""
      }
- ${MODE_GUIDANCE[worksheetMode] ?? MODE_GUIDANCE.classwork}
- ${diffGuidance[difficulty] ?? diffGuidance.mixed}
- Povolené typy: ${types.join(", ")}.
${rhythmSection}- Každý blok MUSÍ mít: type, prompt, points (int), difficulty ("easy"|"medium"|"hard"), timeEstimateSec (int).
- section_header / instruction_box / write_lines / two_boxes / flow_steps mají points = 0.
- mcq: pole "choices" (přesně 4) + "correctAnswer" = text správné volby.
- true_false: "correctAnswer" = "true" nebo "false".
- fill_blank: "blankText" obsahující "___" místo klíčových slov.
- matching: "matchPairs" (3–5 párů { left, right }).
- ordering: "orderItems" (3–6 položek ve správném pořadí).
- short_answer / open_answer: "correctAnswer" = vzorová odpověď (krátká věta).
- write_lines: "lineCount" (3–8), "lineStyle" ("dotted"|"solid"|"dashed").
- instruction_box: "instructionVariant" ("blue"|"yellow"|"green"|"purple"), "instructionIcon" ("info"|"video"|"write"|"discuss"|"group").
- two_boxes: "leftTitle", "leftContent", "rightTitle", "rightContent" (krátké).
- flow_steps: "flowSteps" (3–6 stručných kroků).
- sorting: "sortingCategories" (2–4 prvky { id, label }), "sortingItems" (6–12 prvků { text, categoryId }).
- flashcards: "flashcards" (4–8 prvků { front, back }).
- word_search: "wordSearchWords" (4–8 slov VELKÝMI PÍSMENY bez diakritiky), volitelně "wordSearchSize" (8–16).
- Jazyk: čeština (cs-CZ), formálně ale srozumitelně pro studenty.${planGradeBand ? `\n- Ročník / úroveň: ${planGradeBand}.` : ""}${topicRocnik ? `\n- Cílový ročník: ${topicRocnik}. ročník.` : ""}`;

    const buildUserPrompt = (
      chunk: string,
      count: number,
      sections: string[],
      partInfo: string,
    ) => `Téma: ${lessonTitle || "(bez názvu)"}
${planSubject ? `Předmět: ${planSubject}\n` : ""}${deadline ? `Termín odevzdání: ${deadline}\n` : ""}${partInfo}
Obsah:
${chunk}

${sections.length > 0 ? `Sekce v této části textu, které musíš pokrýt: ${sections.join(" | ")}.\n\n` : ""}${lessonTables.length > 0 ? `Pozor: pracovní list už bude obsahovat ${lessonTables.length} tabulku/tabulky převzatou z lekce (vloží se automaticky). Tabulky sám negeneruj, ale můžeš na ně v úlohách odkazovat („podle tabulky…“).\n\n` : ""}${lessonQrLinks.length > 0 ? `Pozor: pro tyto aktivity z lekce se automaticky vloží QR kód, takže je NEpřepisuj do úloh: ${lessonQrLinks.map((q) => q.label).join(", ")}.\n\n` : ""}${lessonActivityPlan.length > 0 ? `Pozor: tyto aktivity z lekce už budou v listu převedené na tisknutelné úlohy (mcq / matching / ordering / true_false / fill_blank) se stejným zadáním – NEgeneruj je znovu, jen na ně navazuj:\n${lessonActivityPlan.map((a) => `- ${a.title} (${a.activityType})${a.detail ? `: ${a.detail}` : ""}`).join("\n")}\n\n` : ""}${hint ? `Doplňující pokyn učitele: ${hint}\n\n` : ""}Vytvoř pracovní list (cca ${count} bloků, režim: ${worksheetMode}, obtížnost: ${difficulty}${isStudyMode ? `, poměr: ${notesRatio}` : ""}) tak, aby pokrýval všechny sekce výše.`;

    const runAi = async (
      chunk: string,
      count: number,
      isFirst: boolean,
      partInfo: string,
    ): Promise<any[]> => {
      const sections = headingsOf(chunk);
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: buildSystemPrompt(count, sections, isFirst) },
            { role: "user", content: buildUserPrompt(chunk, count, sections, partInfo) },
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_full_worksheet",
              description: "Vytvoří kompletní pracovní list z obsahu lekce.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: DEFAULT_TYPES },
                        prompt: { type: "string" },
                        points: { type: "number" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                        timeEstimateSec: { type: "number" },
                        choices: { type: "array", items: { type: "string" } },
                        correctAnswer: { type: "string" },
                        blankText: { type: "string" },
                        matchPairs: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: { left: { type: "string" }, right: { type: "string" } },
                            required: ["left", "right"],
                          },
                        },
                        orderItems: { type: "array", items: { type: "string" } },
                        lineCount: { type: "number" },
                        lineStyle: { type: "string", enum: ["dotted", "solid", "dashed"] },
                        instructionVariant: { type: "string", enum: ["blue", "yellow", "green", "purple"] },
                        instructionIcon: { type: "string", enum: ["info", "video", "write", "discuss", "group"] },
                        leftTitle: { type: "string" },
                        leftContent: { type: "string" },
                        rightTitle: { type: "string" },
                        rightContent: { type: "string" },
                        flowSteps: { type: "array", items: { type: "string" } },
                        sortingCategories: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: { id: { type: "string" }, label: { type: "string" } },
                            required: ["id", "label"],
                          },
                        },
                        sortingItems: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: { text: { type: "string" }, categoryId: { type: "string" } },
                            required: ["text", "categoryId"],
                          },
                        },
                        flashcards: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: { front: { type: "string" }, back: { type: "string" } },
                            required: ["front", "back"],
                          },
                        },
                        wordSearchWords: { type: "array", items: { type: "string" } },
                        wordSearchSize: { type: "number" },
                      },
                      required: ["type", "prompt"],
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_full_worksheet" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) throw new AiError(429, "Příliš mnoho požadavků, zkuste to později.");
        if (response.status === 402) throw new AiError(402, "Nedostatek kreditů pro AI generování.");
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new AiError(500, "Chyba AI služby");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        console.error("No tool call in response:", JSON.stringify(data).slice(0, 2000));
        throw new AiError(500, "AI nevrátila strukturovaný výstup");
      }
      const parsed = JSON.parse(toolCall.function.arguments);
      return Array.isArray(parsed.items) ? parsed.items : [];
    };

    const result: { items: any[] } = { items: [] };
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const share = chunk.length / totalLen;
        const count = chunks.length === 1
          ? targetCount
          : Math.max(3, Math.min(20, Math.round(targetCount * share)));
        const partInfo = chunks.length > 1
          ? `Toto je část ${i + 1} z ${chunks.length} delšího výukového textu — zpracuj POUZE tuto část.\n`
          : "";
        const batch = await runAi(chunk, count, i === 0, partInfo);
        result.items.push(...batch);
      }
    } catch (e) {
      if (e instanceof AiError) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    if (result.items.length === 0) {
      return new Response(JSON.stringify({ error: "AI nevygenerovala žádné bloky" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // ── Deterministické bloky: tabulky z lekce 1:1 a QR kódy na aktivity ──
    const generatedItems: any[] = Array.isArray(result.items) ? result.items : [];
    for (const t of lessonTables) {
      generatedItems.push({
        type: "table",
        prompt: "",
        points: 0,
        difficulty: "easy",
        timeEstimateSec: 0,
        tableRows: t.rows,
        ...(t.caption ? { tableCaption: t.caption } : {}),
      });
    }
    for (const q of lessonQrLinks) {
      generatedItems.push({
        type: "qr_link",
        prompt: `${q.label} – naskenuj QR kód a aktivitu vyplň v appce.`,
        points: 0,
        difficulty: "easy",
        timeEstimateSec: 0,
        qrUrl: q.url,
      });
    }
    result.items = generatedItems;

    // Zpětně kompatibilní tvar pro UI, které čekalo varianty A/B (plány hodin).
    const variantIds: string[] = Array.isArray(variants) && variants.length > 0
      ? variants.map(String)
      : [];
    const payload: Record<string, unknown> = { ...result };
    if (variantIds.length > 0) {
      payload.worksheet = toLegacyWorksheet(
        Array.isArray(result.items) ? result.items : [],
        {
          title: lessonTitle || "Pracovní list",
          subject: planSubject,
          gradeBand: planGradeBand,
          worksheetMode,
          deadline,
        },
        variantIds,
      );
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-full-worksheet error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
