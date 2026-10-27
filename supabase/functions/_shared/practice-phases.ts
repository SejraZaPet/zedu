/**
 * Fáze studijních technik „Učím se“. Definice drží server v kódu (ne AI);
 * AI dodá jen obsah (otázky, pojmy, části textu). Čistý TS bez Deno importů –
 * testuje ho Vitest.
 */
export type PracticeQType = "multiple_choice" | "true_false" | "short_answer" | "open";
export type PhaseKind =
  | "questions" | "read" | "terms" | "letters" | "acrostic"
  | "loci_route" | "loci_images" | "loci_walk" | "section" | "pomodoro";

export interface PhaseQuestion {
  type: PracticeQType;
  text: string;
  options?: string[];
  correct_index?: number;
  correct_answer?: string | boolean;
  hint?: string;
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
}

export interface PhaseDef {
  key: string;
  title: string;
  instruction: string;
  kind: PhaseKind;
  /** AI generuje mc/tf otázky do této fáze (podíl ze zbytku). */
  aiQuiz?: boolean;
  /** Pevný počet AI kvízových otázek (místo podílu). */
  fixedQuiz?: number;
}

export interface PracticePhase {
  key: string;
  title: string;
  instruction: string;
  kind: PhaseKind;
  questions: PhaseQuestion[];
  content?: {
    text?: string;
    outline?: string[];
    points?: string[];
    terms?: { term: string; meaning?: string }[];
  };
}

export const SOURCE_TEXT_LIMIT = 8000;
export const MIN_SOURCE_TEXT_LENGTH = 150;
export const SOURCE_KINDS = ["text", "file", "notebook", "portfolio"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export function prepareSourceText(raw: unknown):
  { ok: true; text: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Chybí text ke procvičení." };
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, SOURCE_TEXT_LIMIT);
  if (text.length < MIN_SOURCE_TEXT_LENGTH) {
    return { ok: false, error: `Text je moc krátký. Potřebuju aspoň ${MIN_SOURCE_TEXT_LENGTH} znaků.` };
  }
  return { ok: true, text };
}

const P = (key: string, title: string, instruction: string, kind: PhaseKind, extra: Partial<PhaseDef> = {}): PhaseDef =>
  ({ key, title, instruction, kind, ...extra });

const readStep = (key: string, title: string) =>
  P(key, title, "Teď si text v klidu přečti. Hledej odpovědi na své otázky.", "read");

export const METHOD_PHASES: Record<string, PhaseDef[]> = {
  sq4r: [
    P("survey", "Survey – přehled", "Projdi nadpisy a odhadni, o čem lekce bude.", "questions", { fixedQuiz: 2 }),
    P("question", "Question – otázky", "Z nadpisů jsme udělali otázky. Klidně je přepiš po svém.", "questions"),
    readStep("read", "Read – čtení"),
    P("recite", "Recite – řekni to", "Bez dívání do textu řekni vlastními slovy, co sis zapamatoval/a. Po vyhodnocení si to porovnáš s klíčovými body.", "questions"),
    P("write", "wRite – zapiš", "Napiš krátké shrnutí. Stačí pár vět.", "questions"),
    P("review", "Review – opakování", "Ověř si, co ti zůstalo v hlavě.", "questions", { aiQuiz: true }),
  ],
  pqrst: [
    P("preview", "Preview – náhled", "Prohlédni si osnovu a odpověz na jednu otázku.", "questions", { fixedQuiz: 1 }),
    P("question", "Question – otázky", "Než začneš číst, napiš si, co chceš zjistit.", "questions"),
    readStep("read", "Read – čtení"),
    P("recite", "Self-recitation – zopakuj", "Řekni vlastními slovy, co jsi přečetl/a. Pak to porovnej s klíčovými body.", "questions"),
    P("test", "Test – ověření", "Krátký kvíz na závěr.", "questions", { aiQuiz: true }),
  ],
  "5p": [
    P("prolistuj", "Prolistuj", "Projdi osnovu a odpověz na jednu otázku.", "questions", { fixedQuiz: 1 }),
    P("ptej", "Ptej se", "Napiš si, co chceš z textu zjistit.", "questions"),
    readStep("prectii", "Přečti"),
    P("povez", "Pověz", "Řekni vlastními slovy, co sis zapamatoval/a. Pak to porovnej s klíčovými body.", "questions"),
    P("proveř", "Prověř", "Krátký kvíz na závěr.", "questions", { aiQuiz: true }),
  ],
  neana: [
    P("nahled", "Náhled", "Prohlédni si osnovu a odpověz na jednu otázku.", "questions", { fixedQuiz: 1 }),
    P("eseje", "Eseje – otázky", "Napiš dvě otázky, na které chceš v textu najít odpověď.", "questions"),
    P("aktivni_cteni", "Aktivní čtení", "Přečti text a vyber 3 klíčové pojmy.", "read"),
    P("notace", "Notace", "Napiš krátké shrnutí vlastními slovy.", "questions"),
    P("aplikace", "Aplikace", "Použij, co ses naučil/a, na nový případ.", "questions", { aiQuiz: true }),
  ],
  sekvencni: [
    // Části (section) doplní buildPhases podle AI; tady je jen závěr.
    P("spojeni", "Spojení", "Propoj, co jsi zjistil/a ve všech částech.", "questions", { fixedQuiz: 2 }),
  ],
  akrostika: [
    P("pojmy", "Pojmy", "Tohle jsou pojmy, které si zapamatuješ. Pořadí je důležité.", "terms"),
    P("pismena", "Písmena", "Z prvních písmen pojmů si složíš větu nebo zkratku.", "letters"),
    P("veta", "Tvoje věta", "Napiš větu (akrostik) nebo slovo (akronym). Každé slovo musí začínat správným písmenem v pořadí.", "acrostic"),
    P("test", "Test", "Doplň pojmy podle své věty a vyber jejich význam.", "questions", { aiQuiz: true }),
  ],
  loci: [
    P("trasa", "Trasa", "Vymysli trasu, kterou dobře znáš (třeba cestu do školy), a pojmenuj zastávky.", "loci_route"),
    P("obrazy", "Pojmy a obrazy", "Ke každé zastávce si představ živý, třeba i bláznivý obraz s pojmem a popiš ho.", "loci_images"),
    P("prochazeni", "Procházení", "Projdi trasu v duchu a na každé zastávce doplň pojem.", "loci_walk"),
  ],
  pomodoro: [
    P("plan", "Co se budeš učit", "Přečti si zadání a vyber si jednu část, na kterou se soustředíš.", "read"),
    P("blok", "Pracovní blok", "Spusť časovač a pracuj jen na jedné věci. Mobil stranou.", "pomodoro"),
    P("otazky", "Otázky po bloku", "Na konci bloku si ověř, co sis zapamatoval/a.", "questions", { fixedQuiz: 3 }),
  ],
};

export const LOCI_WARNING = "Metoda nesedí každému; když ti nejde, zkus jinou techniku.";
export const KNOWN_METHODS = Object.keys(METHOD_PHASES);

export const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

/** Kolik pojmů (akrostika/loci) a částí (sekvenční) chtít podle počtu otázek. */
export function methodShape(slug: string, total: number) {
  return {
    terms: slug === "loci" ? clampInt(total * 0.6, 5, 8) : clampInt(total * 0.6, 4, 8),
    sections: clampInt((total - 2) / 2, 3, 5),
  };
}

/** Rozdělí AI kvízové otázky do fází: pevné počty první, zbytek do aiQuiz fází (min. 1). */
export function allocateQuiz(slug: string, total: number): Record<string, number> {
  const defs = METHOD_PHASES[slug] ?? [];
  const out: Record<string, number> = {};
  let used = 0;
  for (const d of defs) if (d.fixedQuiz) { out[d.key] = d.fixedQuiz; used += d.fixedQuiz; }
  // pevné otevřené úkoly „spotřebují“ část rozpočtu otázek
  const openSlots = defs.filter((d) => !d.fixedQuiz && !d.aiQuiz && d.kind === "questions").length;
  const flex = defs.filter((d) => d.aiQuiz);
  let rest = Math.max(flex.length, total - used - openSlots);
  if (slug === "akrostika") rest = Math.max(1, Math.round(total / 3)); // zbytek = doplňování pojmů
  flex.forEach((d, i) => {
    const share = i === flex.length - 1 ? rest : Math.max(1, Math.floor(rest / flex.length));
    out[d.key] = share; rest -= share;
  });
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).map(str).filter(Boolean).slice(0, max);

export function sanitizeQuestion(raw: any): PhaseQuestion | null {
  const type = raw?.type;
  const text = str(raw?.text ?? raw?.prompt);
  if (!text) return null;
  if (type === "multiple_choice") {
    const options = strList(raw.options, 6);
    const ci = Number(raw.correct_index);
    if (options.length < 2 || !Number.isInteger(ci) || ci < 0 || ci >= options.length) return null;
    return { type, text, options, correct_index: ci, hint: str(raw.hint) || undefined, difficulty: raw.difficulty, topic: str(raw.topic) || undefined };
  }
  if (type === "true_false") {
    if (typeof raw.correct_answer !== "boolean") return null;
    return { type, text, correct_answer: raw.correct_answer, hint: str(raw.hint) || undefined, difficulty: raw.difficulty, topic: str(raw.topic) || undefined };
  }
  if (type === "short_answer") {
    const ca = str(raw.correct_answer);
    if (!ca) return null;
    return { type, text, correct_answer: ca };
  }
  if (type === "open") return { type, text };
  return null;
}

const quiz = (ai: any, key: string, n: number) =>
  (Array.isArray(ai?.quiz?.[key]) ? ai.quiz[key] : [])
    .map(sanitizeQuestion)
    .filter((q: PhaseQuestion | null): q is PhaseQuestion => !!q && (q.type === "multiple_choice" || q.type === "true_false"))
    .slice(0, n);

const open = (text: string): PhaseQuestion => ({ type: "open", text });
const firstLetter = (term: string) => (term.trim()[0] ?? "").toUpperCase();

/** Sestaví fáze z definice + obsahu od AI. Chybějící obsah doplní fallbackem. */
export function buildPhases(slug: string, ai: any, total: number, sourceText: string): PracticePhase[] {
  const defs = METHOD_PHASES[slug];
  if (!defs) return [];
  const alloc = allocateQuiz(slug, total);
  const shape = methodShape(slug, total);
  const outline = strList(ai?.outline, 8);
  const points = strList(ai?.key_points, 6);
  const headingQs = strList(ai?.heading_questions, 3);
  const terms = (Array.isArray(ai?.terms) ? ai.terms : [])
    .map((t: any) => ({ term: str(t?.term), meaning: str(t?.meaning) || undefined }))
    .filter((t: { term: string }) => t.term && /\p{L}/u.test(t.term[0]))
    .slice(0, shape.terms);
  const readText = sourceText.slice(0, SOURCE_TEXT_LIMIT);

  const phases: PracticePhase[] = [];
  if (slug === "sekvencni") {
    const sections = (Array.isArray(ai?.sections) ? ai.sections : []).slice(0, shape.sections);
    const usable = sections.length >= 2 ? sections : [{ title: "Celý text", text: readText, questions: ai?.quiz?.spojeni ?? [] }];
    usable.forEach((s: any, i: number) => {
      const qs = (Array.isArray(s?.questions) ? s.questions : []).map(sanitizeQuestion)
        .filter((q: PhaseQuestion | null): q is PhaseQuestion => !!q && q.type !== "open" && q.type !== "short_answer").slice(0, 2);
      phases.push({
        key: `cast_${i + 1}`, title: `Část ${i + 1}${str(s?.title) ? ` – ${str(s.title)}` : ""}`,
        instruction: "Přečti tuto část a odpověz na otázky. Další část se odemkne, když budeš mít aspoň 70 %.",
        kind: "section", content: { text: str(s?.text).slice(0, 2500) || readText.slice(0, 2500) },
        questions: qs.length ? qs : [open("Napiš jednou větou, o čem tato část byla.")],
      });
    });
  }

  for (const d of defs) {
    const base = { key: d.key, title: d.title, instruction: d.instruction, kind: d.kind };
    let questions: PhaseQuestion[] = [];
    let content: PracticePhase["content"] | undefined;
    const n = alloc[d.key] ?? 0;
    switch (d.key) {
      case "survey": case "preview": case "prolistuj": case "nahled":
        content = outline.length ? { outline } : undefined;
        questions = quiz(ai, d.key, n);
        break;
      case "question": case "ptej":
        questions = (headingQs.length ? headingQs.slice(0, 2) : ["Co chci z textu zjistit?", "Co už o tématu vím?"])
          .map((q) => open(`Uprav nebo doplň otázku: ${q}`));
        break;
      case "eseje":
        questions = [open("Moje 1. otázka k textu:"), open("Moje 2. otázka k textu:")];
        break;
      case "read": case "prectii": case "plan":
        content = { text: readText };
        break;
      case "aktivni_cteni":
        content = { text: readText };
        questions = [open("Napiš 3 klíčové pojmy z textu a ke každému pár slov.")];
        break;
      case "recite": case "povez":
        questions = [open("Řekni (nebo napiš) vlastními slovy, co sis zapamatoval/a.")];
        content = points.length ? { points } : undefined;
        break;
      case "write": case "notace":
        questions = [open("Moje shrnutí:")];
        break;
      case "pojmy":
        content = { terms };
        break;
      case "pismena":
        content = { terms: terms.map((t: { term: string }) => ({ term: firstLetter(t.term) })) };
        break;
      case "veta":
        content = { terms };
        questions = [open("Moje věta nebo zkratka:")];
        break;
      case "trasa":
        content = { terms };
        break;
      case "obrazy":
        content = { terms };
        questions = terms.map((_: unknown, i: number) => open(`{{stop:${i}}} – popiš obraz`));
        break;
      case "prochazeni":
        content = { terms };
        questions = terms.map((t: { term: string }, i: number) => ({
          type: "short_answer" as const, text: `Zastávka {{stop:${i}}}: jaký pojem tu leží?`, correct_answer: t.term,
        }));
        break;
      default:
        if (d.key === "test" && slug === "akrostika") {
          questions = [
            ...terms.map((t: { term: string }, i: number) => ({
              type: "short_answer" as const, text: `Doplň pojem č. ${i + 1} (začíná na „${firstLetter(t.term)}“).`, correct_answer: t.term,
            })),
            ...quiz(ai, d.key, n),
          ];
        } else if (d.aiQuiz || d.fixedQuiz) {
          questions = quiz(ai, d.key, n);
          if (d.key === "aplikace") questions.push(open("Vymysli vlastní příklad, kde to, co ses naučil/a, použiješ."));
        }
    }
    if (d.kind === "questions" && questions.length === 0) {
      questions = [open("Napiš vlastními slovy, co sis z textu zapamatoval/a.")];
    }
    phases.push({ ...base, questions, ...(content ? { content } : {}) });
  }
  return phases;
}

/** Popis pro AI: co má vrátit pro danou techniku. */
export function aiContentSpec(slug: string, total: number): string {
  const alloc = allocateQuiz(slug, total);
  const shape = methodShape(slug, total);
  const quizKeys = Object.entries(alloc).filter(([, n]) => n > 0)
    .map(([k, n]) => `"${k}": ${n} otázek (mix multiple_choice a true_false)`).join(", ");
  const parts = [
    `"outline": až 6 hlavních bodů osnovy (nadpisy)`,
    `"heading_questions": 2 otázky vytvořené z nadpisů`,
    `"key_points": 3–5 klíčových bodů textu (krátké věty)`,
    `"quiz": objekt { ${quizKeys} }`,
  ];
  if (slug === "akrostika" || slug === "loci") {
    parts.push(`"terms": přesně ${shape.terms} důležitých pojmů v logickém pořadí, každý { "term": "jedno až dvě slova", "meaning": "krátký význam" }`);
  }
  if (slug === "sekvencni") {
    parts.push(`"sections": ${shape.sections} po sobě jdoucích částí textu, každá { "title", "text": doslovný úryvek té části (max 1500 znaků), "questions": 2 otázky multiple_choice/true_false jen z té části }`);
  }
  return parts.join("\n- ");
}

export const flattenPhaseQuestions = (phases: PracticePhase[]) => phases.flatMap((p) => p.questions);
