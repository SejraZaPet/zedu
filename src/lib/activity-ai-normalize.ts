import { getQuizQuestions, setQuizQuestions } from "@/lib/quiz-questions";

type Token =
  | { type: "text"; value: string }
  | { type: "blank"; answer: string; alternatives?: string[] };

export const AI_FILL_EMPTY_ERROR = "AI se nepodařilo vygenerovat, zkuste to znovu.";

const parseBlankText = (text: string): Token[] => {
  const tokens: Token[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: "text", value: text.slice(last, match.index) });
    const parts = match[1].split("/").map((s) => s.trim());
    tokens.push({ type: "blank", answer: parts[0], alternatives: parts.slice(1) });
    last = regex.lastIndex;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
};

const itemText = (x: unknown): string =>
  typeof x === "string" ? x : x && typeof x === "object" && typeof (x as any).text === "string" ? (x as any).text : "";

/** Sloučí všechny tvary, které AI vrací (řetězec, pole vět, sentences, pole {text}), do jednoho textu. */
const collectText = (raw: any): string => {
  if (Array.isArray(raw)) return raw.map(itemText).filter(Boolean).join(" ");
  if (!raw || typeof raw !== "object") return typeof raw === "string" ? raw : "";
  if (typeof raw.text === "string") return raw.text;
  if (Array.isArray(raw.text)) return raw.text.map(itemText).filter(Boolean).join(" ");
  if (Array.isArray(raw.sentences)) return raw.sentences.map(itemText).filter(Boolean).join(" ");
  return "";
};

const hasTokens = (raw: any) => raw && !Array.isArray(raw) && Array.isArray(raw.tokens) && raw.tokens.length > 0;

const collectOptions = (raw: any): string[] => {
  const opts = !Array.isArray(raw) && raw && Array.isArray(raw.options) ? raw.options : [];
  if (Array.isArray(raw)) raw.forEach((r: any) => Array.isArray(r?.options) && opts.push(...r.options));
  return opts.filter((o: unknown) => typeof o === "string");
};

/** Převede výstup AI na tvar, který editor aktivit umí zobrazit. */
export const normalizeAiProps = (incoming: Record<string, any>) => {
  const next = { ...incoming };
  if (next.quiz || Array.isArray(next.questions)) {
    const qs = getQuizQuestions(next.quiz ?? next.questions);
    if (qs.length > 0) next.quiz = setQuizQuestions(qs);
  }
  if (next.fillChoice && !hasTokens(next.fillChoice)) {
    const tokens = parseBlankText(collectText(next.fillChoice)).map((t) =>
      t.type === "blank" ? { type: "blank" as const, answer: t.answer } : t,
    );
    const answers = tokens.filter((t) => t.type === "blank").map((t: any) => t.answer);
    const base = Array.isArray(next.fillChoice) ? {} : next.fillChoice;
    next.fillChoice = {
      ...base,
      tokens,
      options: [...new Set([...collectOptions(next.fillChoice), ...answers])].filter(Boolean),
    };
  }
  if (next.fillBlanks && !hasTokens(next.fillBlanks)) {
    const base = Array.isArray(next.fillBlanks) ? {} : next.fillBlanks;
    next.fillBlanks = { ...base, tokens: parseBlankText(collectText(next.fillBlanks)) };
  }
  if (next.matching && Array.isArray(next.matching.left)) {
    next.matching = { ...next.matching, pairs: next.matching.left.map((_: any, i: number) => [i, i]) };
  }
  return next;
};

/** Pro doplňovací aktivity vyžaduje aspoň jedno místo k doplnění, jinak vyhodí chybu. */
export const assertAiFillContent = (activityType: string, props: Record<string, any>) => {
  const key = activityType === "fill_choice" ? "fillChoice" : activityType === "fill_blanks" ? "fillBlanks" : null;
  if (!key) return;
  const tokens = props[key]?.tokens;
  if (!Array.isArray(tokens) || !tokens.some((t: any) => t?.type === "blank" && t.answer)) {
    throw new Error(AI_FILL_EMPTY_ERROR);
  }
};
