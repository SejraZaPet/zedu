/**
 * Studio etapa 1: AI návrh sady (kroky různých typů) → koncept kroků → slidy živé hry.
 * Koncept žije jen v okně; do hry se vloží až zaškrtnuté a zkontrolované kroky.
 * Vše jde přes existující tvary slidů (mcq/wall/explain), takže převod v live-game-core se nemění.
 */
import { DEFAULT_NEW_QUIZ_TIME_SEC } from "@/lib/live-timing";

export type DraftStepType = "mcq" | "true_false" | "open" | "explain";
export type StepPoints = 0 | 1 | 2;

export const DRAFT_STEP_LABEL: Record<DraftStepType, string> = {
  mcq: "Kvíz", true_false: "Pravda / nepravda", open: "Otevřená otázka (zeď)", explain: "Výklad",
};
export const STEP_POINTS_LABEL: Record<StepPoints, string> = { 0: "Bez bodů", 1: "Standardní", 2: "Dvojnásobné" };
export const TRUE_FALSE_OPTIONS = ["Pravda", "Nepravda"];

export interface DraftStep {
  id: string;
  type: DraftStepType;
  include: boolean;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  body: string;
  imageUrl: string;
  timeLimitSec: number;
  points: StepPoints;
  edited: boolean;
}

let seq = 0;
const nid = () => `step-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Převede odpověď funkce (steps) na koncept; neplatné kroky vynechá. */
export function stepsFromAi(raw: unknown): DraftStep[] {
  const list = Array.isArray((raw as any)?.steps) ? (raw as any).steps : [];
  const out: DraftStep[] = [];
  for (const s of list) {
    const type = s?.type as DraftStepType;
    const question = typeof s?.question === "string" ? s.question.trim() : "";
    if (!question || !(type in DRAFT_STEP_LABEL)) continue;
    const base: DraftStep = {
      id: nid(), type, include: true, question, options: [], correctIndex: 0,
      explanation: typeof s.explanation === "string" ? s.explanation.trim() : "",
      body: typeof s.body === "string" ? s.body.trim() : "", imageUrl: "",
      timeLimitSec: type === "open" || type === "explain" ? 0 : DEFAULT_NEW_QUIZ_TIME_SEC,
      points: type === "open" || type === "explain" ? 0 : 1, edited: false,
    };
    if (type === "mcq") {
      const opts = (Array.isArray(s.options) ? s.options : []).map((o: unknown) => String(o ?? "").trim()).filter(Boolean);
      const ci = Number(s.correctIndex);
      if (opts.length < 2 || !Number.isInteger(ci) || ci < 0 || ci >= opts.length) continue;
      out.push({ ...base, options: opts, correctIndex: ci });
    } else if (type === "true_false") {
      if (typeof s.statementTrue !== "boolean") continue;
      out.push({ ...base, options: [...TRUE_FALSE_OPTIONS], correctIndex: s.statementTrue ? 0 : 1 });
    } else out.push(base);
  }
  return out;
}

/** Proč krok nelze vložit (null = v pořádku). */
export function stepProblem(s: DraftStep): string | null {
  if (!s.question.trim()) return s.type === "explain" ? "Chybí nadpis." : "Chybí otázka.";
  if (s.type === "mcq") {
    const filled = s.options.map((o) => o.trim());
    if (filled.filter(Boolean).length < 2) return "Kvíz potřebuje alespoň dvě možnosti.";
    if (!filled[s.correctIndex]) return "Správná odpověď je prázdná.";
  }
  if (s.imageUrl && !/^https:\/\//i.test(s.imageUrl.trim())) return "Obrázek musí být odkaz začínající https://.";
  if (!Number.isFinite(s.timeLimitSec) || s.timeLimitSec < 0 || s.timeLimitSec > 600) return "Čas musí být 0–600 s.";
  return null;
}

/** Zaškrtnuté a platné kroky → slidy v zobrazeném pořadí. Prázdné možnosti kvízu se vynechají. */
export function draftStepsToSlides(steps: DraftStep[], now = Date.now()): any[] {
  return steps.filter((s) => s.include && !stepProblem(s)).map((s, i) => {
    const ai = { ai_generated: true, ...(s.edited ? { ai_modified_at: new Date(now).toISOString() } : {}) };
    const slideId = `fromtext-${now}-${i}`;
    const question = s.question.trim();
    if (s.type === "explain") {
      return { slideId, type: "explain", projector: { headline: question, body: s.body.trim(), ...(s.imageUrl ? { assetRefs: [s.imageUrl.trim()] } : {}) }, device: { instructions: "Sledujte projektor." }, ...ai };
    }
    if (s.type === "open") {
      return {
        slideId, type: "activity", projector: { headline: question, body: "" }, device: { instructions: "Napište svou odpověď." },
        activitySpec: { activityType: "wall", question, anonymous: true, allowMultiple: false, ...(s.timeLimitSec ? { timeLimitSec: s.timeLimitSec } : {}), ...(s.imageUrl ? { imageUrl: s.imageUrl.trim() } : {}) },
        ...ai,
      };
    }
    const pairs = s.options.map((t, idx) => ({ t: t.trim(), correct: idx === s.correctIndex })).filter((p) => p.t);
    const correctIndex = Math.max(0, pairs.findIndex((p) => p.correct));
    return {
      slideId, type: "activity", projector: { headline: question, body: "" }, device: { instructions: "Vyberte správnou odpověď." },
      activitySpec: {
        activityType: "mcq", question,
        options: pairs.map((p) => ({ text: p.t, correct: p.correct, isCorrect: p.correct })),
        correctIndex, timeLimitSec: s.timeLimitSec,
        ...(s.explanation.trim() ? { explanation: s.explanation.trim() } : {}),
        ...(s.imageUrl ? { imageUrl: s.imageUrl.trim() } : {}),
        ...(s.points !== 1 ? { points: s.points } : {}),
      },
      ...ai,
    };
  });
}
