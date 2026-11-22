/**
 * Studio – jeden model kroku sady (ActivityStep) a adaptéry na stávající tvary:
 *   krok ↔ snímek hry (teacher_game_templates.activity_data)
 *   krok ↔ blok lekce (type "activity", props podle typu)
 * Neznámé vlastnosti se uchovají v `_extra`, takže převod tam a zpět nic neztratí.
 * Herní logika (live-game-core, live-game-expand, game-scoring, live-timing) se nemění;
 * expandSlide se jen volá při přípravě spuštění, aby se nastavení kroku nepřenášela ztrátově.
 */
import { expandSlide } from "@/lib/live-game-expand";
import { normalizeAiProps } from "@/lib/activity-ai-normalize";
import { DEFAULT_NEW_QUIZ_TIME_SEC } from "@/lib/live-timing";
import { isSoloRoundSlide, suggestedSoloRoundTimeSec, supportsSoloRoundType } from "@/lib/solo-round";

export type StepTypeId =
  | "mcq" | "true_false" | "matching" | "ordering" | "fill_blanks" | "fill_choice"
  | "sorting" | "flashcards" | "memory_game" | "crossword"
  | "image_label" | "image_hotspot" | "reveal_cards"
  | "explain" | "wall" | "exit" | "short_answer" | "word_search"
  | "poll" | "wordcloud" | "teams" | "differentiated" | "escape" | "bezlistart"
  | "slide";

export type StepGroup = "Kvízy" | "Procvičování" | "Obrázky" | "Text a otázky" | "Živě se třídou";
export type StepPoints = 0 | 1 | 2;

export interface StepTypeInfo {
  id: StepTypeId;
  label: string;
  group: StepGroup;
  /** yes = hraje se živě přímo; convert = živě se rozloží na otázky; no = živě nejde. */
  live: "yes" | "convert" | "no";
  solo: boolean;
  print: boolean;
  liveOnly?: boolean;
  /** Dnes existuje jen v pracovním listu – v sadě ho nelze vytvořit. */
  worksheetOnly?: boolean;
  /** Body dávají smysl (krok má správnou odpověď). */
  scored: boolean;
  /** Umí ho navrhnout AI z materiálu. */
  ai: boolean;
  editor: "mcq" | "explain" | "wall" | "wordcloud" | "lesson" | "slide";
  /** Typ ve snímku / bloku (exit ticket je zeď). */
  activityType?: string;
  hint: string;
}

const T = (x: StepTypeInfo) => x;
export const STEP_TYPES: StepTypeInfo[] = [
  T({ id: "mcq", label: "Kvíz", group: "Kvízy", live: "yes", solo: true, print: true, scored: true, ai: true, editor: "mcq", hint: "Otázka s výběrem odpovědi" }),
  T({ id: "true_false", label: "Pravda / nepravda", group: "Kvízy", live: "convert", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Tvrzení k posouzení" }),
  T({ id: "matching", label: "Přiřazování", group: "Procvičování", live: "convert", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Spojování dvojic" }),
  T({ id: "ordering", label: "Řazení", group: "Procvičování", live: "convert", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Správné pořadí kroků" }),
  T({ id: "fill_blanks", label: "Doplňování", group: "Procvičování", live: "convert", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Text s mezerami" }),
  T({ id: "fill_choice", label: "Doplňování z nabídky", group: "Procvičování", live: "convert", solo: true, print: true, scored: true, ai: false, editor: "lesson", hint: "Mezery s bankou slov" }),
  T({ id: "sorting", label: "Třídění", group: "Procvičování", live: "no", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Položky do skupin" }),
  T({ id: "flashcards", label: "Kartičky", group: "Procvičování", live: "no", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Dvoustranné kartičky" }),
  T({ id: "memory_game", label: "Pexeso", group: "Procvičování", live: "no", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Hledání dvojic" }),
  T({ id: "crossword", label: "Křížovka", group: "Procvičování", live: "no", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Mřížka s nápovědami" }),
  T({ id: "image_label", label: "Popis obrázku", group: "Obrázky", live: "no", solo: true, print: true, scored: true, ai: false, editor: "lesson", hint: "Popisky na obrázek" }),
  T({ id: "image_hotspot", label: "Hotspot", group: "Obrázky", live: "no", solo: true, print: true, scored: true, ai: false, editor: "lesson", hint: "Klik na správné místo" }),
  T({ id: "reveal_cards", label: "Odkrývací karty", group: "Obrázky", live: "no", solo: true, print: true, scored: true, ai: true, editor: "lesson", hint: "Postupné odhalování" }),
  T({ id: "explain", label: "Text / výklad", group: "Text a otázky", live: "yes", solo: false, print: false, scored: false, ai: true, editor: "explain", hint: "Výkladový snímek" }),
  T({ id: "wall", label: "Zeď (otevřená otázka)", group: "Text a otázky", live: "yes", solo: true, print: true, scored: false, ai: true, editor: "wall", activityType: "wall", hint: "Odpovědi na společnou zeď" }),
  T({ id: "exit", label: "Exit ticket", group: "Text a otázky", live: "yes", solo: true, print: true, scored: false, ai: false, editor: "wall", activityType: "wall", hint: "Krátká reflexe na konci" }),
  T({ id: "short_answer", label: "Krátká odpověď", group: "Text a otázky", live: "no", solo: false, print: true, worksheetOnly: true, scored: true, ai: false, editor: "lesson", hint: "Zatím jen v pracovním listu" }),
  T({ id: "word_search", label: "Osmisměrka", group: "Text a otázky", live: "no", solo: false, print: true, worksheetOnly: true, scored: false, ai: false, editor: "lesson", hint: "Zatím jen v pracovním listu" }),
  T({ id: "poll", label: "Anketa", group: "Živě se třídou", live: "yes", solo: false, print: true, scored: false, ai: true, editor: "lesson", hint: "Hlasování bez správné odpovědi" }),
  T({ id: "wordcloud", label: "Mrak slov", group: "Živě se třídou", live: "yes", solo: false, print: false, liveOnly: true, scored: false, ai: true, editor: "wordcloud", hint: "Slova se skládají do mraku" }),
  T({ id: "teams", label: "Týmy", group: "Živě se třídou", live: "yes", solo: false, print: false, liveOnly: true, scored: false, ai: false, editor: "slide", hint: "Rozdělení třídy do skupin" }),
  T({ id: "differentiated", label: "Diferencovaná aktivita", group: "Živě se třídou", live: "yes", solo: false, print: false, liveOnly: true, scored: false, ai: false, editor: "slide", hint: "Každá skupina jiný úkol" }),
  T({ id: "escape", label: "Úniková hra", group: "Živě se třídou", live: "yes", solo: false, print: false, liveOnly: true, scored: false, ai: false, editor: "slide", hint: "Zámky s kódy" }),
  T({ id: "bezlistart", label: "BezliStart", group: "Živě se třídou", live: "yes", solo: false, print: false, liveOnly: true, scored: false, ai: false, editor: "slide", hint: "Úvodní aktivita hodiny" }),
];
/** Snímek, který Studio nezná (např. z prezentace) – projde beze změny. */
const RAW_TYPE: StepTypeInfo = { id: "slide", label: "Jiný snímek", group: "Živě se třídou", live: "yes", solo: false, print: false, liveOnly: true, scored: false, ai: false, editor: "slide", hint: "Převzatý snímek" };

export const STEP_GROUPS: StepGroup[] = ["Kvízy", "Procvičování", "Obrázky", "Text a otázky", "Živě se třídou"];
export const stepTypeInfo = (id: string): StepTypeInfo => STEP_TYPES.find((t) => t.id === id) ?? RAW_TYPE;
export const canGoLive = (id: string) => supportsSoloRoundType(id) || stepTypeInfo(id).live !== "no";
export const AI_STEP_TYPES = STEP_TYPES.filter((t) => t.ai).map((t) => t.id);

/** Štítky do mřížky „Přidat krok“ a do seznamu kroků. */
export function stepBadges(id: string): string[] {
  const t = stepTypeInfo(id);
  if (t.worksheetOnly) return ["Jen pracovní list"];
  if (t.liveOnly) return ["Jen živě"];
  const b: string[] = [];
  if (supportsSoloRoundType(id)) b.push("Samostatné kolo");
  else if (t.live !== "no") b.push("Živě");
  if (t.solo) b.push("Samostatně");
  if (t.print) b.push("Tisk");
  return b;
}

export const STEP_POINTS_LABEL: Record<StepPoints, string> = { 0: "Bez bodů", 1: "Standardní", 2: "Dvojnásobné" };
export const STEP_TIME_MIN = 5;
export const STEP_TIME_MAX = 600;

export interface StepSettings {
  /** null = výchozí čas hry, 0 = bez limitu, 5–600 s. */
  timeLimitSec: number | null;
  points: StepPoints;
  /** true = krok se hraje jednotlivě i ve hře s týmy (gameSettings.teamMode = "none"). */
  individual: boolean;
  /** Nové konvertibilní kroky = solo; chybějící hodnota u starých snímků = původní rozpad. */
  liveMode?: "solo" | "expand";
  /** Výchozí true; false = po skončení kola neukázat správné řešení. */
  showSolution?: boolean;
  /** true = čas se přepočítá podle velikosti obsahu, dokud ho učitel nezmění. */
  timeAuto?: boolean;
}

export interface ActivityStep {
  id: string;
  type: StepTypeId;
  title: string;
  /** Obsah podle typu – stejné klíče jako props bloku lekce / activitySpec snímku. */
  content: Record<string, any>;
  settings: StepSettings;
  explanation: string;
  imageUrl: string;
  ai: { generated: boolean; modifiedAt?: string };
  _extra: Record<string, any>;
}

let seq = 0;
export const newStepId = () => `step-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Normalizace času: null = výchozí; 0/záporné = bez limitu; jinak 5–600. */
export function clampStepTime(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  return Math.min(STEP_TIME_MAX, Math.max(STEP_TIME_MIN, Math.round(n)));
}
export const normalizePoints = (v: unknown): StepPoints => (v === 0 || v === 2 ? v : 1);

const DEFAULT_CONTENT: Partial<Record<StepTypeId, () => Record<string, any>>> = {
  mcq: () => ({ options: ["", "", "", ""], correctIndex: 0 }),
  true_false: () => ({ trueFalse: { statements: [{ text: "", isTrue: true }] } }),
  matching: () => ({ matching: { left: ["", ""], right: ["", ""] } }),
  ordering: () => ({ ordering: { items: ["", "", ""] } }),
  fill_blanks: () => ({ fillBlanks: { text: "", tokens: [], caseSensitive: false, diacriticSensitive: true } }),
  fill_choice: () => ({ fillChoice: { tokens: [], options: [] } }),
  sorting: () => ({ sorting: { groups: ["Skupina 1", "Skupina 2"], items: [{ text: "", group: 0 }] } }),
  flashcards: () => ({ flashcards: [{ front: "", back: "" }] }),
  memory_game: () => ({ memoryGame: { pairs: [{ left: "", right: "" }, { left: "", right: "" }] } }),
  crossword: () => ({ crossword: { entries: [{ answer: "", clue: "" }, { answer: "", clue: "" }] } }),
  image_label: () => ({ imageLabel: { imageUrl: "", markers: [{ label: "", x: 50, y: 50 }], tolerance: 5, shuffleWords: true } }),
  image_hotspot: () => ({ imageHotspot: { imageUrl: "", hotspots: [{ label: "", x: 50, y: 50, radius: 8 }] } }),
  reveal_cards: () => ({ revealCards: { cards: [{ title: "", content: "" }] } }),
  explain: () => ({ body: "" }),
  wall: () => ({ anonymous: true, allowMultiple: false }),
  exit: () => ({ anonymous: true, allowMultiple: false }),
  poll: () => ({ options: [{ id: "a", text: "" }, { id: "b", text: "" }] }),
  wordcloud: () => ({ anonymous: true }),
};
const DEFAULT_TITLE: Partial<Record<StepTypeId, string>> = { exit: "Co sis dnes odnesl/a?" };

/** Nový prázdný krok daného typu (výchozí čas jako nový kvíz, u otevřených bez limitu). */
export function newStep(type: StepTypeId): ActivityStep {
  const t = stepTypeInfo(type);
  const solo = supportsSoloRoundType(type);
  const step: ActivityStep = {
    id: newStepId(), type, title: DEFAULT_TITLE[type] ?? "", content: DEFAULT_CONTENT[type]?.() ?? {},
    settings: {
      timeLimitSec: solo ? 45 : t.scored && t.live !== "no" ? DEFAULT_NEW_QUIZ_TIME_SEC : t.live === "no" ? null : 0,
      points: 1,
      individual: false,
      ...(solo ? { liveMode: "solo" as const, showSolution: true, timeAuto: true } : {}),
    },
    explanation: "", imageUrl: "", ai: { generated: false }, _extra: {},
  };
  if (solo) step.settings.timeLimitSec = suggestedSoloRoundTimeSec(stepToSlide(step).activitySpec);
  return step;
}

// ── krok ↔ snímek ─────────────────────────────────────────────────────────

const COMMON_SPEC = ["activityType", "question", "timeLimitSec", "points", "explanation", "imageUrl", "soloRound", "showSolution", "timeAuto"];
const omit = (o: Record<string, any>, keys: string[]) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !keys.includes(k)));

/** Text doplňovačky s {{odpověď}} z tokenů (live-game-expand čte `fillBlanks.text`). */
export function fillTextFromTokens(tokens: any[]): string {
  return (tokens || []).map((t) => (t?.type === "blank" ? `{{${[t.answer, ...(t.alternatives || [])].filter(Boolean).join("|")}}}` : String(t?.value ?? ""))).join("");
}

export function stepToSlide(step: ActivityStep): any {
  const t = stepTypeInfo(step.type);
  const extra = step._extra ?? {};
  const { blockId: _b, blockProps: _bp, __noSpec, ...slideExtra } = extra;
  const ai = step.ai.generated ? { ai_generated: true, ...(step.ai.modifiedAt ? { ai_modified_at: step.ai.modifiedAt } : {}) } : {};
  const gameSettings = { ...(slideExtra.gameSettings ?? {}) };
  if (step.settings.individual) gameSettings.teamMode = "none"; else delete gameSettings.teamMode;
  const base: any = {
    ...slideExtra,
    slideId: step.id,
    studioStepType: step.type,
    projector: { ...(slideExtra.projector ?? {}), headline: step.title.trim() },
    device: slideExtra.device ?? { instructions: "" },
    ...ai,
  };
  if (Object.keys(gameSettings).length) base.gameSettings = gameSettings; else delete base.gameSettings;
  if (step.type === "explain") {
    const projector = { ...base.projector, body: String(step.content.body ?? "").trim() };
    if (step.imageUrl) projector.assetRefs = [step.imageUrl]; else delete projector.assetRefs;
    const { activitySpec: _a, ...rest } = base;
    return { ...rest, type: "explain", projector, device: slideExtra.device ?? { instructions: "Sledujte projektor." } };
  }
  if (step.type === "slide" && __noSpec) {
    const { activitySpec: _a, ...rest } = base;
    return { ...rest, type: slideExtra.type ?? "content" };
  }
  const spec: Record<string, any> = { ...step.content, activityType: t.activityType ?? (step.type === "slide" ? step.content.activityType : step.type), question: step.title.trim() };
  if (step.type === "slide" && step.content.activityType === undefined) delete spec.activityType;
  if (step.type === "fill_blanks" && spec.fillBlanks && !spec.fillBlanks.text && Array.isArray(spec.fillBlanks.tokens)) {
    spec.fillBlanks = { ...spec.fillBlanks, text: fillTextFromTokens(spec.fillBlanks.tokens) };
  }
  if (step.type === "mcq") {
    const opts: string[] = Array.isArray(step.content.options) ? step.content.options : [];
    const correctIndex = Math.min(Math.max(0, Number(step.content.correctIndex) || 0), Math.max(0, opts.length - 1));
    // Prázdná pole jsou rozpracovaný obsah editoru – při převodu se nesmí zahodit.
    spec.options = opts.map((text, i) => ({ text: String(text ?? "").trim(), correct: i === correctIndex, isCorrect: i === correctIndex }));
    spec.correctIndex = correctIndex;
  }
  if (step.settings.timeLimitSec !== null) spec.timeLimitSec = step.settings.timeLimitSec;
  if (step.settings.points !== 1) spec.points = step.settings.points;
  if (supportsSoloRoundType(step.type) && step.settings.liveMode !== "expand") spec.soloRound = true;
  if (spec.soloRound && step.settings.timeAuto === true) {
    spec.timeAuto = true;
    spec.timeLimitSec = suggestedSoloRoundTimeSec(spec);
  }
  if (spec.soloRound && step.settings.showSolution === false) spec.showSolution = false;
  if (step.explanation.trim()) spec.explanation = step.explanation.trim();
  if (step.imageUrl.trim()) spec.imageUrl = step.imageUrl.trim();
  const type = step.type === "slide" ? (slideExtra.type ?? "activity") : spec.soloRound || t.live !== "no" ? "activity" : "studio_step";
  return { ...base, type, activitySpec: spec };
}

function typeFromSlide(slide: any): StepTypeId {
  const known = slide?.studioStepType;
  if (known && STEP_TYPES.some((t) => t.id === known)) return known;
  if (slide?.type === "explain") return "explain";
  const at = String(slide?.activitySpec?.activityType ?? "");
  if (at === "mcq") return "mcq";
  if (slide?.type === "activity" || slide?.type === "studio_step") {
    const match = STEP_TYPES.find((t) => !t.worksheetOnly && t.id === at && t.id !== "exit");
    if (match) return match.id;
  }
  return "slide";
}

export function slideToStep(slide: any): ActivityStep {
  const type = typeFromSlide(slide);
  const spec = slide?.activitySpec ?? {};
  const { slideId, studioStepType: _s, activitySpec: _a, ai_generated, ai_modified_at, ...rest } = slide ?? {};
  const extra: Record<string, any> = { ...rest };
  if (type !== "slide") delete extra.type;
  const gs = { ...(extra.gameSettings ?? {}) };
  const individual = gs.teamMode === "none";
  delete gs.teamMode;
  if (Object.keys(gs).length) extra.gameSettings = gs; else delete extra.gameSettings;
  const headline = String(slide?.projector?.headline ?? "");
  const projector = { ...(extra.projector ?? {}) };
  delete projector.headline;
  let content: Record<string, any>;
  let imageUrl = typeof spec.imageUrl === "string" ? spec.imageUrl : "";
  if (type === "explain") {
    content = { body: String(projector.body ?? "") };
    delete projector.body;
    if (Array.isArray(projector.assetRefs) && typeof projector.assetRefs[0] === "string") { imageUrl = projector.assetRefs[0]; delete projector.assetRefs; }
  } else if (type === "mcq") {
    const opts: any[] = Array.isArray(spec.options) ? spec.options : [];
    const ci = opts.findIndex((o) => o?.correct || o?.isCorrect);
    content = { ...omit(spec, [...COMMON_SPEC, "options", "correctIndex"]), options: opts.map((o) => String(o?.text ?? o ?? "")), correctIndex: ci >= 0 ? ci : Number(spec.correctIndex) || 0 };
  } else {
    content = omit(spec, COMMON_SPEC);
    if (type === "slide" && spec.activityType !== undefined) content.activityType = spec.activityType;
  }
  extra.projector = projector;
  if (type === "slide" && !slide?.activitySpec) extra.__noSpec = true;
  const expandable = ["matching", "ordering", "fill_blanks", "fill_choice"].includes(type);
  const soloDefault = spec.soloRound === true || (supportsSoloRoundType(type) && !expandable);
  return {
    id: String(slideId ?? newStepId()),
    type,
    title: String(spec.question ?? headline ?? "") || headline,
    content,
    settings: {
      timeLimitSec: clampStepTime(spec.timeLimitSec),
      points: normalizePoints(spec.points),
      individual,
      ...(soloDefault ? { liveMode: "solo" as const } : expandable ? { liveMode: "expand" as const } : {}),
      ...(soloDefault ? { showSolution: spec.showSolution !== false, timeAuto: spec.soloRound === true ? spec.timeAuto === true : true } : {}),
    },
    explanation: typeof spec.explanation === "string" ? spec.explanation : "",
    imageUrl,
    ai: { generated: ai_generated === true, ...(ai_modified_at ? { modifiedAt: ai_modified_at } : {}) },
    _extra: extra,
  };
}

// ── krok ↔ blok lekce ─────────────────────────────────────────────────────

/** Blok lekce pro kroky, které umí lekce; ostatní (výklad, jen živě, pracovní list) → null. */
export function stepToBlock(step: ActivityStep): { id: string; type: "activity"; props: Record<string, any> } | null {
  const t = stepTypeInfo(step.type);
  if (!t.solo || t.editor === "slide") return null;
  const extra = step._extra ?? {};
  const props: Record<string, any> = { ...(extra.blockProps ?? {}), title: step.title.trim() };
  if (step.settings.timeLimitSec !== null && (!extra.blockId || extra.blockTimeExplicit === true)) props.timeLimitSec = step.settings.timeLimitSec;
  if (step.settings.points !== 1) props.points = step.settings.points;
  if (step.content.colors !== undefined) props.colors = step.content.colors;
  if (step.imageUrl.trim()) props.imageUrl = step.imageUrl.trim();
  if (step.type === "mcq") {
    const opts: string[] = step.content.options ?? [];
    props.activityType = "quiz";
    props.quiz = { questions: [{ question: step.title.trim(), answers: opts.map((text, index) => ({ text: String(text ?? "").trim(), correct: index === step.content.correctIndex })), ...(step.explanation.trim() ? { explanation: step.explanation.trim() } : {}) }] };
  } else {
    Object.assign(props, step.content, { activityType: t.activityType ?? step.type });
    if (t.editor === "wall") props.question = step.title.trim();
    if (step.explanation.trim()) props.explanation = step.explanation.trim();
  }
  if (step.ai.generated) props.ai_generated = true;
  if (step.ai.modifiedAt) props.ai_modified_at = step.ai.modifiedAt;
  return { id: String(extra.blockId ?? step.id), type: "activity", props };
}

const BLOCK_SKIP = ["activityType", "title", "question", "explanation", "ai_generated", "ai_modified_at", "quiz", "colors", "imageUrl", "timeLimitSec", "points", "soloRound", "showSolution", "timeAuto"];
/** Blok lekce → kroky (kvíz s více otázkami = víc kroků Kvíz). Neznámý blok → []. */
export function blockToSteps(block: any): ActivityStep[] {
  if (block?.type !== "activity") return [];
  const p = block.props ?? {};
  const at = String(p.activityType ?? "");
  const ai = { generated: p.ai_generated === true, ...(p.ai_modified_at ? { modifiedAt: p.ai_modified_at } : {}) };
  const settings: StepSettings = {
    timeLimitSec: clampStepTime(p.timeLimitSec), points: normalizePoints(p.points), individual: false,
    ...(p.soloRound === true ? { liveMode: "solo" as const } : {}),
    ...(p.showSolution !== undefined ? { showSolution: p.showSolution !== false } : {}),
    ...(p.timeAuto !== undefined ? { timeAuto: p.timeAuto === true } : {}),
  };
  if (at === "quiz") {
    const qs: any[] = Array.isArray(p.quiz?.questions) ? p.quiz.questions : [];
    return qs.map((q, i) => {
      const answers: any[] = Array.isArray(q?.answers) ? q.answers : [];
      return {
        id: qs.length === 1 ? String(block.id ?? newStepId()) : `${block.id ?? newStepId()}-q${i + 1}`, type: "mcq" as const,
        title: String(q?.question ?? ""), content: { options: answers.map((a) => String(a?.text ?? "")), correctIndex: Math.max(0, answers.findIndex((a) => a?.correct)), ...(p.colors !== undefined ? { colors: p.colors } : {}) },
        settings: { ...settings }, explanation: String(q?.explanation ?? ""), imageUrl: String(q?.imageUrl ?? p.imageUrl ?? ""), ai,
        _extra: qs.length === 1 ? { blockId: block.id, blockProps: omit(p, BLOCK_SKIP), blockTimeExplicit: p.timeLimitSec !== undefined } : {},
      };
    });
  }
  const type = (STEP_TYPES.find((t) => t.solo && t.editor !== "slide" && t.id === at && t.id !== "exit" && t.id !== "mcq")?.id) as StepTypeId | undefined;
  if (!type) return [];
  const contentKeys = Object.keys(DEFAULT_CONTENT[type]?.() ?? {});
  const content: Record<string, any> = {};
  const blockProps: Record<string, any> = {};
  for (const [k, v] of Object.entries(omit(p, BLOCK_SKIP))) (contentKeys.includes(k) ? content : blockProps)[k] = v;
  if (p.colors !== undefined) content.colors = p.colors;
  const imported: ActivityStep = {
    id: String(block.id ?? newStepId()), type, title: String(p.title ?? p.question ?? ""), content,
    settings: { ...newStep(type).settings, ...settings }, explanation: String(p.explanation ?? ""), imageUrl: String(p.imageUrl ?? ""), ai, _extra: { blockId: block.id, blockProps, blockTimeExplicit: p.timeLimitSec !== undefined },
  };
  if (supportsSoloRoundType(type)) imported.settings.timeLimitSec = suggestedSoloRoundTimeSec(stepToSlide(imported).activitySpec);
  return [imported];
}

// ── kontrola a spuštění ───────────────────────────────────────────────────

const nonEmpty = (a: unknown) => (Array.isArray(a) ? a : []).filter((x) => String(typeof x === "string" ? x : (x as any)?.text ?? x ?? "").trim());

/** Proč krok nelze uložit (null = v pořádku). */
export function stepProblem(s: ActivityStep): string | null {
  const t = stepTypeInfo(s.type);
  if (t.worksheetOnly) return "Tento typ zatím jde jen v pracovním listu.";
  const c = s.content ?? {};
  if (t.editor !== "slide" && s.type !== "wordcloud" && !s.title.trim()) return s.type === "explain" ? "Chybí nadpis." : "Chybí zadání.";
  if (s.type === "wordcloud" && !s.title.trim()) return "Chybí otázka.";
  switch (s.type) {
    case "mcq": {
      const o = (c.options ?? []).map((x: string) => String(x ?? "").trim());
      if (o.filter(Boolean).length < 2) return "Kvíz potřebuje alespoň dvě možnosti.";
      if (!o[c.correctIndex]) return "Správná odpověď je prázdná.";
      break;
    }
    case "true_false": if (!nonEmpty(c.trueFalse?.statements).length) return "Doplňte alespoň jedno tvrzení."; break;
    case "matching": {
      const l = c.matching?.left ?? [], r = c.matching?.right ?? [];
      if (l.filter((x: string, i: number) => String(x ?? "").trim() && String(r[i] ?? "").trim()).length < 2) return "Doplňte alespoň dvě dvojice.";
      break;
    }
    case "ordering": if (nonEmpty(c.ordering?.items).length < 2) return "Doplňte alespoň dvě položky."; break;
    case "fill_blanks": {
      const ok = (c.fillBlanks?.tokens ?? []).some((x: any) => x?.type === "blank" && x.answer) || /\{\{[^}]+\}\}/.test(String(c.fillBlanks?.text ?? ""));
      if (!ok) return "Text potřebuje alespoň jedno místo k doplnění.";
      break;
    }
    case "fill_choice": if (!(c.fillChoice?.tokens ?? []).some((x: any) => x?.type === "blank" && x.answer)) return "Text potřebuje alespoň jedno místo k doplnění."; break;
    case "sorting": if ((c.sorting?.groups ?? []).length < 2 || !nonEmpty(c.sorting?.items).length) return "Třídění potřebuje dvě skupiny a položky."; break;
    case "flashcards": if (!(c.flashcards ?? []).some((x: any) => String(x?.front ?? "").trim())) return "Doplňte alespoň jednu kartičku."; break;
    case "memory_game": if ((c.memoryGame?.pairs ?? []).filter((x: any) => String(x?.left ?? "").trim() && String(x?.right ?? "").trim()).length < 2) return "Pexeso potřebuje alespoň dvě dvojice."; break;
    case "crossword": if ((c.crossword?.entries ?? []).filter((x: any) => String(x?.answer ?? "").trim() && String(x?.clue ?? "").trim()).length < 2) return "Křížovka potřebuje alespoň dvě slova s nápovědou."; break;
    case "image_label": if (!c.imageLabel?.imageUrl) return "Nahrajte obrázek."; break;
    case "image_hotspot": if (!c.imageHotspot?.imageUrl) return "Nahrajte obrázek."; break;
    case "reveal_cards": if (!(c.revealCards?.cards ?? []).some((x: any) => String(x?.title ?? x?.content ?? "").trim())) return "Doplňte alespoň jednu kartu."; break;
    case "poll": if (nonEmpty(c.options).length < 2) return "Anketa potřebuje alespoň dvě možnosti."; break;
  }
  if (s.imageUrl && !/^https:\/\//i.test(s.imageUrl.trim())) return "Obrázek musí být odkaz začínající https://.";
  const tl = s.settings.timeLimitSec;
  if (tl !== null && tl !== 0 && (tl < STEP_TIME_MIN || tl > STEP_TIME_MAX)) return `Čas musí být ${STEP_TIME_MIN}–${STEP_TIME_MAX} s, nebo bez limitu.`;
  return null;
}

export const isStudioSet = (slides: unknown): boolean =>
  Array.isArray(slides) && slides.some((s: any) => s?.type === "studio_step" || typeof s?.studioStepType === "string");

/**
 * Příprava snímků sady pro živé spuštění (klientský adaptér, herní logika beze změny):
 * - kroky typu „studio_step“ (živě nejdou) se vynechají a vrátí se v `skipped`,
 * - kroky Studia, které se živě rozkládají na otázky, se rozloží zde, aby každá
 *   otázka zdědila body a „jednotlivě“ z kroku (expandSlide je jinak nepřenáší).
 * Ostatní snímky (staré hry) projdou beze změny.
 */
export function prepareSlidesForLiveLaunch(slides: any[] | null | undefined): { slides: any[]; skipped: { title: string; label: string }[] } {
  const out: any[] = [];
  const skipped: { title: string; label: string }[] = [];
  for (const s of slides ?? []) {
    if (isSoloRoundSlide(s)) { out.push(s); continue; }
    if (s?.type === "studio_step") {
      const t = stepTypeInfo(String(s.studioStepType ?? s.activitySpec?.activityType ?? ""));
      skipped.push({ title: String(s.activitySpec?.question || s.projector?.headline || t.label), label: t.label });
      continue;
    }
    if (typeof s?.studioStepType === "string" && stepTypeInfo(s.studioStepType).live === "convert") {
      const pts = s.activitySpec?.points;
      const parts = expandSlide(s);
      for (const x of parts) {
        if (x === s) { out.push(x); continue; }
        out.push({
          ...x,
          studioStepType: s.studioStepType,
          ...(s.gameSettings ? { gameSettings: s.gameSettings } : {}),
          activitySpec: { ...x.activitySpec, ...(pts === 0 || pts === 2 ? { points: pts } : {}) },
        });
      }
      continue;
    }
    out.push(s);
  }
  return { slides: out, skipped };
}

// ── AI návrh → kroky ──────────────────────────────────────────────────────

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : []);

/** Jeden krok z odpovědi AI (tvar z generate-activity-from-text) → ActivityStep, nebo null. */
export function aiStepToStep(s: any): ActivityStep | null {
  const raw = String(s?.type ?? "");
  const type = (raw === "open" ? "wall" : raw) as StepTypeId;
  const info = STEP_TYPES.find((t) => t.id === type && t.ai);
  if (!info) return null;
  const step = newStep(type);
  step.ai = { generated: true };
  step.title = str(s.question);
  step.explanation = str(s.explanation);
  let props: Record<string, any> = {};
  switch (type) {
    case "mcq": step.content = { options: strs(s.options), correctIndex: Number(s.correctIndex) }; break;
    case "true_false":
      if (typeof s.statementTrue !== "boolean") return null;
      step.content = { trueFalse: { statements: [{ text: step.title, isTrue: s.statementTrue }] } };
      step.title = "Pravda, nebo nepravda?";
      break;
    case "explain": step.content = { body: str(s.body) }; break;
    case "wall": case "wordcloud": break;
    case "poll": step.content = { options: strs(s.options).map((text, i) => ({ id: `o${i + 1}`, text })) }; break;
    case "matching": {
      const pairs = (Array.isArray(s.pairs) ? s.pairs : []).map((p: any) => ({ l: str(p?.left), r: str(p?.right) })).filter((p: any) => p.l && p.r);
      props = { matching: { left: pairs.map((p: any) => p.l), right: pairs.map((p: any) => p.r) } };
      break;
    }
    case "ordering": props = { ordering: { items: strs(s.items) } }; break;
    case "fill_blanks": props = { fillBlanks: { text: str(s.text), caseSensitive: false, diacriticSensitive: true } }; break;
    case "sorting": {
      const groups = (Array.isArray(s.groups) ? s.groups : []).map((g: any) => ({ name: str(g?.name), items: strs(g?.items) })).filter((g: any) => g.name && g.items.length);
      props = { sorting: { groups: groups.map((g: any) => g.name), items: groups.flatMap((g: any, gi: number) => g.items.map((text: string) => ({ text, group: gi }))) } };
      break;
    }
    case "flashcards": props = { flashcards: (Array.isArray(s.cards) ? s.cards : []).map((c: any) => ({ front: str(c?.front), back: str(c?.back) })).filter((c: any) => c.front && c.back) }; break;
    case "memory_game": props = { memoryGame: { pairs: (Array.isArray(s.pairs) ? s.pairs : []).map((p: any) => ({ left: str(p?.left), right: str(p?.right) })).filter((p: any) => p.left && p.right) } }; break;
    case "reveal_cards": props = { revealCards: { cards: (Array.isArray(s.cards) ? s.cards : []).map((c: any) => ({ title: str(c?.front), content: str(c?.back) })).filter((c: any) => c.title && c.content) } }; break;
    case "crossword": props = { crossword: { entries: (Array.isArray(s.entries) ? s.entries : []).map((e: any) => ({ answer: str(e?.answer).toUpperCase(), clue: str(e?.clue) })).filter((e: any) => /^[\p{L}]{2,}$/u.test(e.answer) && e.clue) } }; break;
  }
  if (Object.keys(props).length) {
    const norm = normalizeAiProps(props);
    step.content = { ...step.content, ...norm };
  }
  if (supportsSoloRoundType(type)) step.settings.timeLimitSec = suggestedSoloRoundTimeSec(stepToSlide(step).activitySpec);
  return stepProblem(step) ? null : step;
}

/** Celá odpověď AI → platné kroky + počet zahozených (zobrazí se učiteli). */
export function aiStepsToSteps(raw: unknown): { steps: ActivityStep[]; dropped: number } {
  const list: any[] = Array.isArray((raw as any)?.steps) ? (raw as any).steps : [];
  const steps = list.map(aiStepToStep).filter((x): x is ActivityStep => !!x);
  const serverDropped = Number((raw as any)?.dropped) || 0;
  return { steps, dropped: list.length - steps.length + serverDropped };
}

// ── souhrn živé sady ──────────────────────────────────────────────────────

export function studioSetLiveSummary(steps: ActivityStep[]) {
  const slides = prepareSlidesForLiveLaunch(steps.map(stepToSlide)).slides;
  const soloRounds = slides.filter(isSoloRoundSlide).length;
  const regularQuestions = slides.filter((s) => s?.type === "activity" && !isSoloRoundSlide(s)).length;
  let estimatedSeconds = 0;
  let openEnded = false;
  for (const slide of slides) {
    if (slide?.type !== "activity") continue;
    const own = slide?.activitySpec?.timeLimitSec;
    if (own === 0) { openEnded = true; continue; }
    estimatedSeconds += Number.isFinite(Number(own)) && Number(own) > 0 ? Number(own) : DEFAULT_NEW_QUIZ_TIME_SEC;
  }
  return { regularQuestions, soloRounds, estimatedSeconds, openEnded };
}

// ── šablony ───────────────────────────────────────────────────────────────

export interface StudioSetDraft {
  title: string;
  subject: string | null;
  gameMode: string;
  teamMode: string;
  teamCount: number;
  steps: ActivityStep[];
}

/** Hra z knihovny (i demo) → nová sada; kroky dostanou nová ID, identita šablony se nepřenáší. */
export function gameTemplateToSet(t: { title: string; subject?: string | null; activity_data: any[]; default_game_mode?: string | null; default_team_mode?: string | null; default_team_count?: number | null }): StudioSetDraft {
  const slides = Array.isArray(t.activity_data) ? t.activity_data : [];
  return {
    title: String(t.title ?? ""),
    subject: t.subject ?? null,
    gameMode: t.default_game_mode || "standard",
    teamMode: t.default_team_mode || "none",
    teamCount: Math.max(2, Math.min(6, Number(t.default_team_count) || 2)),
    steps: slides.map((s) => ({ ...slideToStep(s), id: newStepId() })),
  };
}

/** Uložená šablona aktivity (activity_templates: jen typ a nastavení) → krok s prázdným obsahem. */
export function activityTemplateToSteps(row: { name: string; activity_type: string; template_props?: Record<string, any> | null }): ActivityStep[] {
  const at = row.activity_type === "quiz" ? "mcq" : row.activity_type;
  const info = STEP_TYPES.find((t) => t.id === at && !t.worksheetOnly);
  if (!info) return [];
  const base = newStep(info.id);
  if (info.id === "mcq" || !info.solo || info.editor === "slide") return [base];
  const steps = blockToSteps({ id: base.id, type: "activity", props: { ...base.content, ...(row.template_props ?? {}), activityType: info.activityType ?? info.id, title: "" } });
  return steps.map((s) => ({
    ...s,
    settings: {
      ...base.settings,
      ...(supportsSoloRoundType(s.type) ? { timeLimitSec: suggestedSoloRoundTimeSec(stepToSlide(s).activitySpec) } : {}),
    },
  }));
}
