/**
 * Příprava prezentace na živou hru – stejná cesta jako u sad ze Studia
 * (`prepareSlidesForLiveLaunch`), navíc: kvíz s více otázkami se rozloží,
 * body a týmové nastavení se přenesou na každou otázku a učitel dostane
 * srozumitelné hlášení, co se přeskočilo nebo poběží bez bodování.
 */
import { normalizePresentationSlides, activityTypeLabel } from "@/lib/presentation-activity";
import { activityToCoreQuestions, isLiveGameActivity } from "@/lib/live-game-core";
import { expandSlide } from "@/lib/live-game-expand";
import { prepareSlidesForLiveLaunch } from "@/lib/studio-step";

/** Typy, které projektor/telefon umí jako aktivitu bez bodování. */
const UNSCORED_LIVE = new Set(["wordcloud", "wall", "poll", "teams", "escape", "differentiated"]);

export interface PresentationLaunchReport {
  slides: any[];
  /** Kroky, které se do živé hry nedostaly. */
  skipped: { title: string; label: string }[];
  /** Typy, které poběží, ale bez bodování (žáci odpovídají, body se nepočítají). */
  unscored: string[];
  /** Aktivity, kterým chybí data (prázdný kvíz…), a proto se nezahrají jako otázky. */
  incomplete: string[];
}

const carry = (parent: any, child: any) => {
  const pts = parent?.activitySpec?.points;
  return {
    ...child,
    ...(parent?.gameSettings ? { gameSettings: parent.gameSettings } : {}),
    ...(parent?.studioStepType ? { studioStepType: parent.studioStepType } : {}),
    activitySpec: { ...child.activitySpec, ...(pts === 0 || pts === 2 ? { points: pts } : {}) },
  };
};

function quizToMcqSlides(s: any): any[] | null {
  const sp = s?.activitySpec;
  if (String(sp?.activityType) !== "quiz" || !sp?.quiz) return null;
  const qs = activityToCoreQuestions(sp);
  if (!qs.length) return [];
  return qs.map((q, i) => ({
    slideId: `${s.slideId || "slide"}-q${i + 1}`,
    type: "activity",
    ...(s.ai_generated ? { ai_generated: true } : {}),
    ...(s.backgroundOverride ? { backgroundOverride: s.backgroundOverride } : {}),
    ...(s.themeId ? { themeId: s.themeId } : {}),
    projector: { headline: q.question, body: "" },
    device: { instructions: "Vyberte správnou odpověď." },
    teacherNotes: s.teacherNotes || "",
    expandedFrom: "quiz",
    activitySpec: {
      activityType: "mcq",
      question: q.question,
      options: q.answers.map((text, j) => ({ text, correct: j === q.correctIndex, isCorrect: j === q.correctIndex })),
      correctIndex: q.correctIndex,
      ...(q.explanation ? { explanation: q.explanation } : {}),
      ...(sp.timeLimitSec !== undefined ? { timeLimitSec: sp.timeLimitSec } : {}),
    },
  }));
}

export function preparePresentationForLive(input: any[] | null | undefined): PresentationLaunchReport {
  const normalized = normalizePresentationSlides(input ?? []);
  const unscored = new Set<string>();
  const incomplete: string[] = [];
  const pre: any[] = [];
  for (const s of normalized) {
    const quiz = quizToMcqSlides(s);
    if (quiz === null) { pre.push(s); continue; }
    if (quiz.length === 0) {
      incomplete.push(String(s?.projector?.headline || "Kvíz"));
      pre.push(s);
      continue;
    }
    pre.push(...quiz.map((q) => carry(s, q)));
  }
  const { slides: studio, skipped } = prepareSlidesForLiveLaunch(pre);
  const out: any[] = [];
  for (const s of studio) {
    const at = String(s?.activitySpec?.activityType ?? "");
    const parts = expandSlide(s);
    if (parts.length === 1 && parts[0] === s) {
      if (s?.type === "activity" && isLiveGameActivity(at) && at !== "quiz" && s?.activitySpec?.soloRound !== true) incomplete.push(String(s?.projector?.headline || activityTypeLabel(at)));
      if (UNSCORED_LIVE.has(at)) unscored.add(activityTypeLabel(at));
      out.push(s);
      continue;
    }
    out.push(...parts.map((p) => (p === s ? p : carry(s, p))));
  }
  return { slides: out, skipped, unscored: [...unscored], incomplete };
}

/** Krátká česká zpráva pro učitele (nebo null, když je vše v pořádku). */
export function launchReportMessage(r: PresentationLaunchReport): string | null {
  const parts: string[] = [];
  if (r.skipped.length) parts.push(`Přeskočeno (nejde hrát živě): ${r.skipped.map((x) => `${x.title} (${x.label})`).join(", ")}.`);
  if (r.incomplete.length) parts.push(`Chybí data, zobrazí se jen jako slide: ${r.incomplete.join(", ")}.`);
  if (r.unscored.length) parts.push(`Bez bodování (žáci odpovídají, body se nepočítají): ${r.unscored.join(", ")}.`);
  return parts.length ? parts.join(" ") : null;
}
