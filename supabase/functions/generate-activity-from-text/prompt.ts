// Čisté části generate-activity-from-text (testováno ve vitest).
export const FROM_TEXT_MAX_CHARS = 20000;
export const FROM_TEXT_MIN_CHARS = 8;
export const SET_STEP_TYPES = [
  "mcq", "true_false", "open", "explain",
  // Studio etapa 1: celý rozsah typů, které lze navrhnout jen z textu (bez obrázků).
  "matching", "ordering", "fill_blanks", "sorting", "flashcards", "memory_game",
  "reveal_cards", "crossword", "poll", "wordcloud",
] as const;
export type SetStepType = typeof SET_STEP_TYPES[number];
export const SET_MAX_COUNT = 12;

export type ParsedRequest =
  | { mode: "legacy"; text: string }
  | { mode: "set"; text: string; types: SetStepType[]; count: number }
  | { error: string; status: number };

export function parseRequest(body: any): ParsedRequest {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < FROM_TEXT_MIN_CHARS) return { error: "Text je příliš krátký.", status: 400 };
  if (text.length > FROM_TEXT_MAX_CHARS)
    return { error: `Text má ${text.length} znaků, limit je ${FROM_TEXT_MAX_CHARS}. Zkraťte ho.`, status: 413 };
  if (body?.types === undefined) return { mode: "legacy", text };
  const types = Array.isArray(body.types)
    ? [...new Set(body.types.filter((t: unknown) => (SET_STEP_TYPES as readonly unknown[]).includes(t)))] as SetStepType[]
    : [];
  if (types.length === 0) return { error: "Vyberte alespoň jeden typ kroku.", status: 400 };
  const n = Math.round(Number(body.count));
  const count = Number.isFinite(n) ? Math.min(SET_MAX_COUNT, Math.max(1, n)) : 6;
  return { mode: "set", text, types, count };
}

const TYPE_HINT: Record<SetStepType, string> = {
  mcq: "mcq = kvízová otázka se 4 možnostmi, právě 1 správná (correctIndex)",
  true_false: "true_false = tvrzení, statementTrue říká, zda je pravdivé",
  open: "open = otevřená otázka k zamyšlení bez správné odpovědi (třída odpovídá na zeď)",
  explain: "explain = krátký výkladový slide (question = nadpis, body = 2–4 věty)",
  matching: "matching = přiřazování, question = zadání, pairs = 3–6 dvojic {left, right}",
  ordering: "ordering = řazení, question = zadání, items = 3–6 položek ve SPRÁVNÉM pořadí",
  fill_blanks: "fill_blanks = doplňování, question = zadání, text = 1–3 věty, doplňovaná slova ve tvaru {{slovo}} (alespoň 2)",
  sorting: "sorting = třídění, question = zadání, groups = 2–3 skupiny {name, items: 2–4 položky}",
  flashcards: "flashcards = kartičky, question = téma, cards = 4–8 {front = pojem, back = vysvětlení}",
  memory_game: "memory_game = pexeso, question = téma, pairs = 4–8 dvojic {left, right}",
  reveal_cards: "reveal_cards = odkrývací karty, question = téma, cards = 3–6 {front = nadpis, back = skrytý text}",
  crossword: "crossword = křížovka, question = téma, entries = 4–8 {answer = JEDNO slovo bez mezer, clue = nápověda}",
  poll: "poll = anketa bez správné odpovědi, question = otázka, options = 2–5 možností",
  wordcloud: "wordcloud = mrak slov, question = otázka, na kterou žáci odpoví jedním slovem",
};

export function buildSetPrompt(types: SetStepType[], count: number): string {
  return `Jsi zkušený český pedagog. Z dodaného materiálu navrhni sadu ${count} kroků pro živou výuku.
Povolené typy: ${types.join(", ")}.
${types.map((t) => `- ${TYPE_HINT[t]}`).join("\n")}
PRAVIDLA:
- Typy rozumně střídej (je-li jich víc), pořadí od jednoduššího ke složitějšímu.
- Vycházej jen z materiálu, nic si nevymýšlej.
- Ke kvízu a tvrzení přidej krátké vysvětlení (1–2 věty).
- Vše česky (cs-CZ), žákům tykej.`;
}

export const SET_TOOL = {
  type: "function",
  function: {
    name: "create_activity_set",
    description: "Vytvoří sadu kroků.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["steps"],
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "question"],
            properties: {
              type: { type: "string", enum: [...SET_STEP_TYPES] },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctIndex: { type: "integer" },
              statementTrue: { type: "boolean" },
              explanation: { type: "string" },
              body: { type: "string" },
              text: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              pairs: { type: "array", items: { type: "object", additionalProperties: false, properties: { left: { type: "string" }, right: { type: "string" } } } },
              cards: { type: "array", items: { type: "object", additionalProperties: false, properties: { front: { type: "string" }, back: { type: "string" } } } },
              entries: { type: "array", items: { type: "object", additionalProperties: false, properties: { answer: { type: "string" }, clue: { type: "string" } } } },
              groups: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, items: { type: "array", items: { type: "string" } } } } },
            },
          },
        },
      },
    },
  },
};

export interface SetStep {
  type: SetStepType; question: string; options?: string[]; correctIndex?: number;
  statementTrue?: boolean; explanation?: string; body?: string;
  text?: string; items?: string[];
  pairs?: { left: string; right: string }[];
  cards?: { front: string; back: string }[];
  entries?: { answer: string; clue: string }[];
  groups?: { name: string; items: string[] }[];
}

/** Ponechá jen platné kroky povolených typů; nic nedoplňuje vymyšlenými daty. */
export function normalizeSetSteps(raw: unknown, allowed: SetStepType[], count: number): SetStep[] {
  const list = Array.isArray((raw as any)?.steps) ? (raw as any).steps : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const out: SetStep[] = [];
  for (const s of list) {
    const type = s?.type as SetStepType;
    if (!allowed.includes(type)) continue;
    const question = str(s.question);
    if (!question) continue;
    const explanation = str(s.explanation) || undefined;
    if (type === "mcq") {
      const options = (Array.isArray(s.options) ? s.options : []).map(str).filter(Boolean).slice(0, 6);
      const ci = Number(s.correctIndex);
      if (options.length < 2 || !Number.isInteger(ci) || ci < 0 || ci >= options.length) continue;
      out.push({ type, question, options, correctIndex: ci, explanation });
    } else if (type === "true_false") {
      if (typeof s.statementTrue !== "boolean") continue;
      out.push({ type, question, statementTrue: s.statementTrue, explanation });
    } else if (type === "explain") {
      out.push({ type, question, body: str(s.body) });
    } else if (type === "matching" || type === "memory_game") {
      const pairs = (Array.isArray(s.pairs) ? s.pairs : []).map((p: any) => ({ left: str(p?.left), right: str(p?.right) })).filter((p: any) => p.left && p.right).slice(0, 10);
      if (pairs.length < 2) continue;
      out.push({ type, question, pairs, explanation });
    } else if (type === "ordering") {
      const items = strList(s.items).slice(0, 10);
      if (items.length < 2) continue;
      out.push({ type, question, items, explanation });
    } else if (type === "fill_blanks") {
      const text = str(s.text);
      if (!/\{\{[^}]+\}\}/.test(text)) continue;
      out.push({ type, question, text, explanation });
    } else if (type === "sorting") {
      const groups = (Array.isArray(s.groups) ? s.groups : []).map((g: any) => ({ name: str(g?.name), items: strList(g?.items) })).filter((g: any) => g.name && g.items.length).slice(0, 4);
      if (groups.length < 2) continue;
      out.push({ type, question, groups, explanation });
    } else if (type === "flashcards" || type === "reveal_cards") {
      const cards = (Array.isArray(s.cards) ? s.cards : []).map((c: any) => ({ front: str(c?.front), back: str(c?.back) })).filter((c: any) => c.front && c.back).slice(0, 12);
      if (cards.length < 1) continue;
      out.push({ type, question, cards });
    } else if (type === "crossword") {
      const entries = (Array.isArray(s.entries) ? s.entries : []).map((e: any) => ({ answer: str(e?.answer).toUpperCase(), clue: str(e?.clue) })).filter((e: any) => /^[\p{L}]{2,}$/u.test(e.answer) && e.clue).slice(0, 10);
      if (entries.length < 2) continue;
      out.push({ type, question, entries });
    } else if (type === "poll") {
      const options = strList(s.options).slice(0, 6);
      if (options.length < 2) continue;
      out.push({ type, question, options });
    } else {
      out.push({ type, question });
    }
    if (out.length >= count) break;
  }
  return out;
}
