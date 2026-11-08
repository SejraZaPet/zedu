/**
 * Pracovní list: bloky „Postup podle metody“ (method_steps) a „Příklady z praxe“
 * (practice_examples). Čisté pomocné funkce – normalizace, limity, předvyplnění
 * z katalogu metod a z posledního „Návrhu podle metody“. Bez AI, bez DB.
 */

/** Maximální počet fází v bloku Postup podle metody. */
export const MAX_METHOD_PHASES = 8;
/** Maximální počet příkladů v bloku Příklady z praxe. */
export const MAX_PRACTICE_EXAMPLES = 10;

/** Způsob odpovědi žáka u fáze: žádná / řádky / textové pole. */
export type MethodAnswerMode = "none" | "lines" | "field";

export interface MethodStepPhase {
  id: string;
  /** Název fáze (např. „Motivace“). */
  title: string;
  /** Zadání / úkol pro žáka. */
  task: string;
  /** Jak žák odpovídá. */
  answerMode: MethodAnswerMode;
  /** Body za fázi; 0 = nehodnocená část (nepočítá se do maxima). */
  points: number;
}

export interface PracticeExample {
  id: string;
  /** Krátký nadpis příkladu. */
  title: string;
  /** Popis situace z praxe. */
  situation: string;
  /** Volitelná otázka / úkol pro žáka. */
  question?: string;
  /** Volitelné body; 0 = nehodnoceno. */
  points: number;
}

let counter = 0;
function genId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createMethodPhase(partial?: Partial<MethodStepPhase>): MethodStepPhase {
  return {
    id: partial?.id ?? genId("phase"),
    title: (partial?.title ?? "").trim(),
    task: (partial?.task ?? "").trim(),
    answerMode: partial?.answerMode === "none" || partial?.answerMode === "field" ? partial.answerMode : "lines",
    points: Math.max(0, Math.round(Number(partial?.points ?? 0) || 0)),
  };
}

export function createPracticeExample(partial?: Partial<PracticeExample>): PracticeExample {
  const question = (partial?.question ?? "").trim();
  return {
    id: partial?.id ?? genId("example"),
    title: (partial?.title ?? "").trim(),
    situation: (partial?.situation ?? "").trim(),
    ...(question ? { question } : {}),
    points: Math.max(0, Math.round(Number(partial?.points ?? 0) || 0)),
  };
}

/** Normalizuje fáze z neznámého JSON; max MAX_METHOD_PHASES, prázdné (bez názvu i zadání) zahodí. */
export function normalizeMethodPhases(raw: unknown): MethodStepPhase[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any) =>
      createMethodPhase({
        id: typeof p?.id === "string" && p.id ? p.id : undefined,
        title: typeof p?.title === "string" ? p.title : "",
        task: typeof p?.task === "string" ? p.task : "",
        answerMode: p?.answerMode,
        points: p?.points,
      }),
    )
    .filter((p) => p.title || p.task)
    .slice(0, MAX_METHOD_PHASES);
}

/** Normalizuje příklady z praxe; prázdné (bez nadpisu i situace) zahodí. */
export function normalizePracticeExamples(raw: unknown): PracticeExample[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e: any) =>
      createPracticeExample({
        id: typeof e?.id === "string" && e.id ? e.id : undefined,
        title: typeof e?.title === "string" ? e.title : "",
        situation: typeof e?.situation === "string" ? e.situation : "",
        question: typeof e?.question === "string" ? e.question : "",
        points: e?.points,
      }),
    )
    .filter((e) => e.title || e.situation)
    .slice(0, MAX_PRACTICE_EXAMPLES);
}

/** Součet bodů fází = body položky (0 = celá část nehodnocená). */
export function methodStepsTotalPoints(phases: MethodStepPhase[]): number {
  return phases.reduce((s, p) => s + p.points, 0);
}

export function practiceExamplesTotalPoints(examples: PracticeExample[]): number {
  return examples.reduce((s, e) => s + e.points, 0);
}

/** Počet odpovědí žáka (fáze se způsobem odpovědi řádky/pole). */
export function methodStepsAnswerCount(phases: MethodStepPhase[]): number {
  return phases.filter((p) => p.answerMode !== "none").length;
}

export function practiceExamplesAnswerCount(examples: PracticeExample[]): number {
  return examples.filter((e) => (e.question ?? "").trim()).length;
}

// ─── Předvyplnění z katalogu metod ───

export interface LearningMethodCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  steps_json?: unknown;
  template_phases_json?: unknown;
}

function textFromStep(step: unknown): { title: string; task: string } | null {
  if (typeof step === "string" && step.trim()) return { title: step.trim(), task: "" };
  if (step && typeof step === "object") {
    const s = step as Record<string, unknown>;
    const title = String(s.title ?? s.name ?? s.step ?? "").trim();
    const task = String(s.description ?? s.task ?? s.text ?? "").trim();
    if (title || task) return { title: title || task, task: title ? task : "" };
  }
  return null;
}

/**
 * Fáze z kroku metody v katalogu (steps_json, případně template_phases_json).
 * Vrací [] když katalog kroky nemá – editor pak nabídne jednu prázdnou fázi.
 */
export function phasesFromMethodCatalog(method: LearningMethodCatalogEntry | null | undefined): MethodStepPhase[] {
  if (!method) return [];
  const steps = Array.isArray(method.steps_json) ? method.steps_json : [];
  const fromSteps = steps
    .map(textFromStep)
    .filter((s): s is { title: string; task: string } => !!s)
    .map((s) => createMethodPhase({ title: s.title, task: s.task, answerMode: "lines", points: 0 }));
  if (fromSteps.length) return fromSteps.slice(0, MAX_METHOD_PHASES);

  const tpl = method.template_phases_json;
  if (tpl && typeof tpl === "object" && !Array.isArray(tpl)) {
    const out: MethodStepPhase[] = [];
    for (const [key, val] of Object.entries(tpl as Record<string, unknown>)) {
      const t = textFromStep(val) ?? (typeof val === "string" ? { title: key, task: val } : null);
      if (t) out.push(createMethodPhase({ title: t.title || key, task: t.task, answerMode: "lines", points: 0 }));
    }
    if (out.length) return out.slice(0, MAX_METHOD_PHASES);
  }
  return [];
}

// ─── Předvyplnění z posledního „Návrhu podle metody“ ───

export const SUGGEST_BY_METHOD_LAST_KEY = "bezli.suggestByMethod.last";

/** Klíče fází hodiny v návrhu (shodné s edge funkcí suggest-lesson-from-methods). */
export const SUGGESTION_PHASE_LABELS: Record<string, string> = {
  uvod: "Úvod",
  motivace: "Motivace",
  hlavni: "Hlavní část",
  procviceni: "Procvičení",
  reflexe: "Reflexe",
  zaver: "Závěr",
};

export interface MethodSuggestionLike {
  title?: string;
  phases?: Record<string, { timeMin?: string; description?: string; activities?: { kind?: string; title?: string }[] } | undefined>;
}

/** Fáze z uloženého návrhu hodiny (6 fází → fáze bloku, body 0). */
export function phasesFromSuggestion(suggestion: MethodSuggestionLike | null | undefined): MethodStepPhase[] {
  const phases = suggestion?.phases;
  if (!phases || typeof phases !== "object") return [];
  const out: MethodStepPhase[] = [];
  for (const [key, label] of Object.entries(SUGGESTION_PHASE_LABELS)) {
    const p = phases[key];
    if (!p) continue;
    const lines: string[] = [];
    if (p.description?.trim()) lines.push(p.description.trim());
    for (const a of p.activities ?? []) {
      const t = (a?.title ?? "").trim();
      if (t) lines.push(`• ${t}`);
    }
    const title = p.timeMin ? `${label} (${p.timeMin} min)` : label;
    out.push(createMethodPhase({ title, task: lines.join("\n"), answerMode: "lines", points: 0 }));
  }
  return out.slice(0, MAX_METHOD_PHASES);
}

/** Přečte poslední návrh podle metody ze sessionStorage (null mimo prohlížeč / při chybě). */
export function readLastMethodSuggestion(): MethodSuggestionLike | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(SUGGEST_BY_METHOD_LAST_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved?.suggestion && typeof saved.suggestion === "object" ? (saved.suggestion as MethodSuggestionLike) : null;
  } catch {
    return null;
  }
}
