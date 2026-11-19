// Čisté části generate-activity-from-text (testováno ve vitest).
export const FROM_TEXT_MAX_CHARS = 20000;
export const FROM_TEXT_MIN_CHARS = 8;
export const SET_STEP_TYPES = ["mcq", "true_false", "open", "explain"] as const;
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
}

/** Ponechá jen platné kroky povolených typů; nic nedoplňuje vymyšlenými daty. */
export function normalizeSetSteps(raw: unknown, allowed: SetStepType[], count: number): SetStep[] {
  const list = Array.isArray((raw as any)?.steps) ? (raw as any).steps : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
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
    } else {
      out.push({ type, question });
    }
    if (out.length >= count) break;
  }
  return out;
}
