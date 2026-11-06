/**
 * Čisté pomocné funkce pro výstup „Návrh podle metody“:
 * modelová situace (případová studie), odvození formy práce a cíle fáze,
 * převod návrhu na tiskový export plánu hodiny.
 */
import type { LessonPlanExportData } from "@/lib/lesson-plan-pdf-export";

export interface ModelSituationInput {
  scenario?: string | null;
  task?: string | null;
}

export interface SuggestionPhaseInput {
  timeMin?: string;
  description?: string;
  equipment?: string;
  activities?: { kind: string; title: string }[];
}

/** Normalizuje modelovou situaci; vrací null, když je prázdná. */
export function normalizeModelSituation(
  ms: ModelSituationInput | null | undefined,
): { scenario: string; task: string } | null {
  const scenario = (ms?.scenario ?? "").trim();
  const task = (ms?.task ?? "").trim();
  if (!scenario && !task) return null;
  return { scenario, task };
}

/** Text zadání případové studie (doslovně, bez AI). */
export function caseStudyText(ms: ModelSituationInput | null | undefined): string {
  const n = normalizeModelSituation(ms);
  if (!n) return "";
  return [n.scenario, n.task ? `Úkol: ${n.task}` : ""].filter(Boolean).join("\n\n");
}

/** Patch pro blok `instruction_box` „Případová studie“ na začátek pracovního listu. */
export function buildCaseStudyItemPatch(ms: ModelSituationInput | null | undefined) {
  const text = caseStudyText(ms);
  if (!text) return null;
  return {
    type: "instruction_box" as const,
    prompt: `Případová studie\n\n${text}`,
    points: 0,
    timeEstimateSec: 0,
    instructionVariant: "yellow" as const,
    instructionIcon: "group" as const,
    answerSpace: { type: "none" as const, heightMm: 0 },
  };
}

/** Odvodí formu práce z textu fáze. Neznámé = "". */
export function inferWorkForm(text: string | null | undefined): string {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return "";
  const forms: string[] = [];
  if (/ve dvojic|dvojice|dvojicích|ve dvou|v párech|párov/.test(t)) forms.push("práce ve dvojicích");
  if (/skupin|týmov|v týmech|týmy/.test(t)) forms.push("skupinová práce");
  if (/individuál|samostatn|každý žák sám/.test(t)) forms.push("individuální práce");
  if (/frontáln|celá třída|s celou třídou|řízen[áý] diskus/.test(t)) forms.push("frontální práce");
  return forms.join(", ");
}

const CASE_STUDY_REF = /případov|modelov|zadání|situac/i;

/** Cíl fáze předvyplněný z dat metody (jen kde je jednoznačný). */
export function inferPhaseGoal(
  phaseKey: string,
  phase: SuggestionPhaseInput | null | undefined,
  hasCaseStudy: boolean,
): string {
  if (!hasCaseStudy) return "";
  const desc = phase?.description ?? "";
  if (phaseKey === "main" || CASE_STUDY_REF.test(desc)) {
    return "Práce na zadání případové studie (modelová situace a úkol).";
  }
  return "";
}

/** Doplní fázím `goal` a `workForm` (jen když chybí). */
export function enrichPhases<T extends SuggestionPhaseInput & { goal?: string; workForm?: string }>(
  phases: Record<string, T>,
  ms: ModelSituationInput | null | undefined,
): Record<string, T> {
  const hasCase = !!normalizeModelSituation(ms);
  const out: Record<string, T> = {};
  for (const [key, p] of Object.entries(phases)) {
    const goal = p.goal?.trim() || inferPhaseGoal(key, p, hasCase);
    const workForm = p.workForm?.trim() || inferWorkForm(p.description);
    out[key] = {
      ...p,
      ...(goal ? { goal } : {}),
      ...(workForm ? { workForm } : {}),
    };
  }
  return out;
}

/** Převod návrhu metody na data pro tiskový export (stejný renderer jako plán hodiny). */
export function suggestionToExportData(opts: {
  title: string;
  subject?: string;
  summary?: string;
  modelSituation?: ModelSituationInput | null;
  teacherInstructions?: string;
  methodRationale?: string;
  phaseLabels: Record<string, string>;
  phases: Record<string, SuggestionPhaseInput | undefined>;
}): LessonPlanExportData {
  const ms = normalizeModelSituation(opts.modelSituation);
  const hasCase = !!ms;
  return {
    title: opts.title || "Návrh hodiny",
    subject: opts.subject || undefined,
    description: opts.summary || undefined,
    studentDescription: caseStudyText(ms) || undefined,
    modelSituation: ms ?? undefined,
    teacherInstructions: opts.teacherInstructions?.trim() || undefined,
    methodRationale: opts.methodRationale?.trim() || undefined,
    phases: Object.entries(opts.phaseLabels).map(([key, label]) => {
      const p = opts.phases[key];
      const eq = p?.equipment?.trim();
      return {
        key,
        title: label,
        timeMin: p?.timeMin ?? "",
        description: p?.description ?? "",
        equipment: eq && !/^(žádné|nic|-|–)\.?$/i.test(eq) ? eq : undefined,
        activities: p?.activities ?? [],
        goal: inferPhaseGoal(key, p, hasCase) || undefined,
        workForm: inferWorkForm(p?.description) || undefined,
      };
    }),
  };
}
