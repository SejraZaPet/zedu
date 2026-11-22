import type { ActivityColors } from "@/lib/activity-colors";
import { getQuizQuestions, setQuizQuestions, type QuizQuestion } from "@/lib/quiz-questions";

/**
 * Kanonický model editoru aktivit. Adaptéry pouze převádějí data v paměti;
 * stará a neznámá pole se zachovají sloučením s původním objektem při zápisu.
 */
export interface ActivityOption {
  id?: string;
  text: string;
  correct?: boolean;
  [key: string]: any;
}

export interface ActivitySettingsModel {
  /** null = zdědit nastavení hry, 0 = bez limitu. */
  timeLimitSec: number | null;
  points: 0 | 1 | 2;
  /** inherit = nastavení sady/prezentace; ostatní hodnoty jsou režim tohoto kroku/slide. */
  participation: "inherit" | "individual" | "random" | "manual";
  liveMode?: "solo" | "expand";
  showSolution?: boolean;
  timeAuto?: boolean;
}

export interface ActivityModel {
  activityType: string;
  title: string;
  question: string;
  options: ActivityOption[];
  correctIndex: number;
  questions: QuizQuestion[];
  /** Typový obsah (matching, fillBlanks, escape…), bez společných polí. */
  content: Record<string, any>;
  settings: ActivitySettingsModel;
  imageUrl: string;
  explanation: string;
  colors?: ActivityColors;
}

const COMMON = new Set([
  "activityType", "title", "question", "options", "correctIndex", "quiz",
  "timeLimitSec", "points", "imageUrl", "explanation", "colors",
  "soloRound", "showSolution", "timeAuto",
]);
const clone = <T,>(value: T): T => value == null ? value : JSON.parse(JSON.stringify(value));
const points = (value: unknown): 0 | 1 | 2 => value === 0 || value === 2 ? value : 1;
const optionText = (value: any) => String(value?.text ?? value ?? "");

function contentWithoutCommon(source: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !COMMON.has(key)));
}

export function activityModelFromSpec(spec: any, participation: ActivitySettingsModel["participation"] = "inherit"): ActivityModel {
  const source = spec && typeof spec === "object" ? spec : {};
  const rawOptions: any[] = Array.isArray(source.options) ? source.options : [];
  const options = rawOptions.map((option) => ({
    ...(option && typeof option === "object" ? clone(option) : {}),
    text: optionText(option),
  }));
  const flagged = options.findIndex((option) => option.correct === true || option.isCorrect === true);
  return {
    activityType: String(source.activityType ?? "mcq"),
    title: String(source.title ?? ""),
    question: String(source.question ?? ""),
    options,
    correctIndex: typeof source.correctIndex === "number" ? source.correctIndex : Math.max(0, flagged),
    questions: getQuizQuestions(source.quiz),
    content: contentWithoutCommon(source),
    settings: {
      timeLimitSec: source.timeLimitSec === undefined || source.timeLimitSec === null ? null : Number(source.timeLimitSec),
      points: points(source.points),
      participation,
      ...(source.soloRound === true ? { liveMode: "solo" as const } : {}),
      ...(source.showSolution !== undefined ? { showSolution: source.showSolution !== false } : {}),
      ...(source.timeAuto !== undefined ? { timeAuto: source.timeAuto === true } : {}),
    },
    imageUrl: String(source.imageUrl ?? ""),
    explanation: String(source.explanation ?? ""),
    ...(source.colors !== undefined ? { colors: clone(source.colors) } : {}),
  };
}

function writeCommon(spec: Record<string, any>, model: ActivityModel): Record<string, any> {
  const out: Record<string, any> = { ...spec, activityType: model.activityType };
  if (model.title || spec.title !== undefined) out.title = model.title;
  if (model.question || spec.question !== undefined || ["mcq", "poll", "wall", "wordcloud", "open"].includes(model.activityType)) out.question = model.question;
  else delete out.question;
  if (model.settings.timeLimitSec === null) delete out.timeLimitSec;
  else out.timeLimitSec = model.settings.timeLimitSec;
  if (model.settings.points === 1 && spec.points === undefined) delete out.points;
  else out.points = model.settings.points;
  if (model.imageUrl) out.imageUrl = model.imageUrl;
  else delete out.imageUrl;
  if (model.explanation) out.explanation = model.explanation;
  else delete out.explanation;
  if (model.colors !== undefined) out.colors = clone(model.colors);
  if (model.settings.liveMode === "solo") out.soloRound = true;
  else if (model.settings.liveMode === "expand") delete out.soloRound;
  if (model.settings.showSolution !== undefined) out.showSolution = model.settings.showSolution;
  if (model.settings.timeAuto !== undefined) out.timeAuto = model.settings.timeAuto;
  return out;
}

/** Slide/activitySpec → model → activitySpec. Původní spec je povinný zdroj zachovaných polí. */
export function activityModelToSpec(model: ActivityModel, previousSpec: any = {}): Record<string, any> {
  const previous = previousSpec && typeof previousSpec === "object" ? previousSpec : {};
  let out = writeCommon({ ...previous, ...clone(model.content) }, model);
  if (model.activityType === "mcq" || model.activityType === "poll") {
    const oldOptions: any[] = Array.isArray(previous.options) ? previous.options : [];
    out.options = model.options.map((option, index) => {
      const old = oldOptions[index] && typeof oldOptions[index] === "object" ? oldOptions[index] : {};
      if (model.activityType === "poll") return { ...old, ...option, text: option.text };
      const correct = index === model.correctIndex;
      return { ...old, ...option, text: option.text, correct, isCorrect: correct };
    });
    if (model.activityType === "mcq") out.correctIndex = Math.min(Math.max(0, model.correctIndex), Math.max(0, model.options.length - 1));
    else delete out.correctIndex;
  } else if (model.activityType === "quiz") {
    if (model.questions.length || previous.quiz !== undefined) out.quiz = setQuizQuestions(clone(model.questions));
  }
  return out;
}

export function activityModelFromBlock(block: any): ActivityModel {
  return activityModelFromSpec(block?.props ?? {});
}

export function activityModelToBlockProps(model: ActivityModel, previousProps: any = {}): Record<string, any> {
  return activityModelToSpec(model, previousProps);
}

function slideParticipation(slide: any): ActivitySettingsModel["participation"] {
  const teamMode = slide?.gameSettings?.teamMode;
  return teamMode === "none" ? "individual" : teamMode === "random" || teamMode === "manual" ? teamMode : "inherit";
}

export function activityModelFromSlide(slide: any): ActivityModel {
  return activityModelFromSpec(slide?.activitySpec ?? {}, slideParticipation(slide));
}

/** Zapíše model do kopie slidu; nezmění typ, blok, poznámky ani ostatní nastavení. */
export function applyActivityModelToSlide(slide: any, model: ActivityModel): any {
  const next: any = { ...slide, activitySpec: activityModelToSpec(model, slide?.activitySpec ?? {}) };
  const oldGame = slide?.gameSettings && typeof slide.gameSettings === "object" ? slide.gameSettings : {};
  const game = { ...oldGame };
  if (model.settings.participation === "inherit") delete game.teamMode;
  else game.teamMode = model.settings.participation === "individual" ? "none" : model.settings.participation;
  if (Object.keys(game).length) next.gameSettings = game;
  else delete next.gameSettings;
  return next;
}
