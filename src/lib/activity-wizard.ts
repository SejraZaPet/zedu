/**
 * Čistá logika průvodce „Použít aktivitu“ na /aktivity.
 * Bez importů Supabase/Reactu, aby šla testovat.
 */
import { blocksToText } from "../../supabase/functions/_shared/lesson-text";

export const SOURCE_TEXT_LIMIT = 6000; // stejně jako generate-activity-content čte podklad
export const MIN_SOURCE_TEXT = 20;
export const MIN_ITEMS = 4;
export const MAX_ITEMS = 12;

export type CatalogId =
  | "quiz" | "truefalse" | "matching" | "ordering" | "fillblanks"
  | "open" | "imagelabel" | "flashcards" | "table" | "summary";

export interface WizardTypeInfo {
  /** Typ bloku v editoru lekce; null = editor neumí → „Brzy“. */
  blockType: "activity" | "summary" | null;
  /** activityType pro blok activity (a pro generate-activity-content). */
  activityType: string | null;
  /** Lze spustit jako živou hru (knihovna her = MCQ). */
  liveGame: boolean;
  /** Lze uložit do „Moje aktivity“ (activity_templates). */
  template: boolean;
}

/** Které z 10 typů na stránce umí editor lekce opravdu vytvořit. */
export const WIZARD_TYPES: Record<CatalogId, WizardTypeInfo> = {
  quiz:       { blockType: "activity", activityType: "quiz",        liveGame: true,  template: true },
  truefalse:  { blockType: "activity", activityType: "true_false",  liveGame: true, template: true },
  matching:   { blockType: "activity", activityType: "matching",    liveGame: true, template: true },
  ordering:   { blockType: "activity", activityType: "ordering",    liveGame: false, template: true },
  fillblanks: { blockType: "activity", activityType: "fill_blanks", liveGame: false, template: true },
  imagelabel: { blockType: "activity", activityType: "image_label", liveGame: false, template: true },
  flashcards: { blockType: "activity", activityType: "flashcards",  liveGame: false, template: true },
  summary:    { blockType: "summary",  activityType: "summary",     liveGame: false, template: false },
  open:       { blockType: null, activityType: null, liveGame: false, template: false },
  table:      { blockType: null, activityType: null, liveGame: false, template: false },
};

export function wizardTypeFor(id: string): WizardTypeInfo | null {
  return (WIZARD_TYPES as Record<string, WizardTypeInfo>)[id] ?? null;
}

export function isSupported(id: string): boolean {
  return !!wizardTypeFor(id)?.blockType;
}

export function clampItemCount(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 8;
  return Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, v));
}

export function limitSourceText(text: string, max = SOURCE_TEXT_LIMIT): string {
  return (text ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max);
}

export type SourceMode = "lesson" | "text" | "empty";

export interface SourceInput {
  mode: SourceMode;
  lessons?: { title: string; blocks: unknown }[];
  text?: string;
}

export type ResolvedSource =
  | { kind: "ai"; text: string }
  | { kind: "empty" }
  | { kind: "error"; message: string };

/** Výběr zdroje: z lekcí / vloženého textu → podklad pro AI, „Prázdná“ → bez AI. */
export function resolveSource(input: SourceInput): ResolvedSource {
  if (input.mode === "empty") return { kind: "empty" };
  let text = "";
  if (input.mode === "lesson") {
    const lessons = input.lessons ?? [];
    if (lessons.length === 0) return { kind: "error", message: "Vyberte alespoň jednu lekci." };
    text = lessons
      .map((l) => [l.title, blocksToText(l.blocks)].filter(Boolean).join("\n\n"))
      .join("\n\n");
  } else {
    text = input.text ?? "";
  }
  const limited = limitSourceText(text);
  if (limited.length < MIN_SOURCE_TEXT) {
    return {
      kind: "error",
      message: input.mode === "lesson"
        ? "Vybrané lekce zatím nemají dost textu. Zvolte jinou lekci nebo vložte text."
        : "Vložte alespoň pár vět textu nebo nahrajte dokument.",
    };
  }
  return { kind: "ai", text: limited };
}

export type Difficulty = "easy" | "medium" | "hard";

export interface WizardSettings {
  itemCount: number;
  difficulty: Difficulty;
  optionCount: number; // kvíz
  wordBank: boolean;   // doplňovačka
}

export function buildAiRequest(id: CatalogId, title: string, text: string, s: WizardSettings) {
  const info = WIZARD_TYPES[id];
  const n = clampItemCount(s.itemCount);
  return {
    activityType: info.activityType,
    topic: title.slice(0, 120),
    context: text,
    itemCount: n,
    difficulty: s.difficulty,
    ...(info.activityType === "quiz" ? { questionCount: Math.min(10, n), optionCount: s.optionCount } : {}),
    ...(info.activityType === "flashcards" ? { cardCount: n } : {}),
  };
}

const newId = () =>
  (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Sestaví blok lekce z výstupu AI (nebo prázdný). AI výstup je označen ai_generated. */
export function buildBlock(
  id: CatalogId,
  aiProps: Record<string, any> | null,
  s: WizardSettings,
  title: string,
): { id: string; type: "activity" | "summary"; visible: boolean; props: Record<string, any> } {
  const info = WIZARD_TYPES[id];
  if (!info.blockType) throw new Error("Tento typ aktivity zatím editor lekce neumí.");
  const ai = aiProps ? { ai_generated: true, ai_generated_at: new Date().toISOString() } : {};
  if (info.blockType === "summary") {
    const sum = (aiProps?.summary ?? {}) as Record<string, any>;
    return {
      id: newId(), type: "summary", visible: true,
      props: { title: sum.title || aiProps?.title || title || "Shrnutí lekce", text: sum.text || "", ...ai },
    };
  }
  const props: Record<string, any> = { ...(aiProps ?? {}), activityType: info.activityType, ...ai };
  if (!props.title) props.title = title || "";
  if (info.activityType === "fill_blanks") {
    props.fillBlanks = { ...(props.fillBlanks ?? { text: "" }), showWordBank: s.wordBank };
  }
  return { id: newId(), type: "activity", visible: true, props };
}

/**
 * Převod aktivity z průvodce na snímky živé hry. Všechno se převádí na MCQ
 * (nejlépe podporovaný formát hry: text otázky + možnosti se správnou odpovědí).
 * Vrací [] pro typy, které jako živá hra hrát nejdou.
 */
export function activityToGameQuestions(props: any): { question: string; answers: string[]; correctIndex: number; explanation?: string }[] {
  const s = (v: any) => String(v ?? "").replace(/<[^>]*>/g, "").trim();
  const at = String(props?.activityType ?? "");
  if (at === "quiz") {
    return (props?.quiz?.questions ?? []).map((q: any) => {
      const raw = Array.isArray(q?.answers) ? q.answers : [];
      const answers = raw.map((a: any) => s(a?.text ?? a)).filter(Boolean);
      const ci = raw.filter((a: any) => s(a?.text ?? a)).findIndex((a: any) => a?.correct);
      return { question: s(q?.question), answers, correctIndex: Math.max(0, ci), ...(q?.explanation ? { explanation: q.explanation } : {}) };
    }).filter((q: any) => q.question && q.answers.length >= 2);
  }
  if (at === "true_false") {
    const st: any[] = props?.trueFalse?.statements ?? [];
    return st
      .map((x) => ({ text: s(x?.text ?? x?.statement), isTrue: x?.isTrue ?? x?.correct }))
      .filter((x) => x.text && typeof x.isTrue === "boolean")
      .map((x) => ({ question: x.text, answers: ["Pravda", "Nepravda"], correctIndex: x.isTrue ? 0 : 1 }));
  }
  if (at === "matching") {
    const l: any[] = props?.matching?.left ?? [];
    const r: any[] = props?.matching?.right ?? [];
    const pairs = l.map((x, i) => ({ left: s(x), right: s(r[i]) })).filter((p) => p.left && p.right);
    if (pairs.length < 2) return [];
    const rights = [...new Set(pairs.map((p) => p.right))];
    return pairs.map((p, i) => {
      const others = rights.filter((x) => x !== p.right);
      const pick = others.slice(i % Math.max(1, others.length)).concat(others).slice(0, 3);
      const answers = [p.right, ...pick];
      // deterministické umístění správné odpovědi
      const pos = i % answers.length;
      [answers[0], answers[pos]] = [answers[pos], answers[0]];
      return { question: `Co patří k pojmu „${p.left}“?`, answers, correctIndex: pos };
    });
  }
  return [];
}

/** Důvod, proč typ nejde hrát živě (null = jde). */
export function liveGameUnsupportedReason(activityType: string | null | undefined): string | null {
  return ["quiz", "true_false", "matching"].includes(String(activityType)) ? null : "Tuto aktivitu nelze hrát jako živou hru";
}
