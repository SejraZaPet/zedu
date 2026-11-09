/**
 * Čas na odpověď a ruční „Spustit“ u živých aktivit.
 * Sdíleno klientem (src/lib/live-timing.ts) i serverem (submit-answer,
 * submit-activity-response, bodování). Bez závislostí, čisté funkce.
 *
 * Data:
 *  - slide.activitySpec.timeLimitSec: number > 0 = sekundy, 0 = bez limitu,
 *    chybí = převezme se nastavení hry (přesně dnešní chování).
 *  - settings.activityStartMode: "manual" | "auto" (chybí = auto).
 *  - settings.armedQuestion: index slidu, který čeká na „Spustit“.
 */

export const LEGACY_TIME_FALLBACK_SEC = 20;
export const DEFAULT_NEW_QUIZ_TIME_SEC = 30;
export const TIME_LIMIT_PRESETS_SEC = [10, 20, 30, 45, 60, 90, 120] as const;
export const MIN_TIME_LIMIT_SEC = 5;
export const MAX_TIME_LIMIT_SEC = 600;

/** undefined = slide nemá vlastní čas, null = bez limitu, číslo = sekundy. */
export function slideTimeLimitSec(slide: any): number | null | undefined {
  const raw = slide?.activitySpec?.timeLimitSec;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return null;
  return Math.min(MAX_TIME_LIMIT_SEC, Math.max(MIN_TIME_LIMIT_SEC, Math.round(n)));
}

/**
 * Dnešní (záložní) chování se liší podle místa, proto `legacy`:
 *  - "live":    odpočet/odhalení v živé prezentaci – settings.timePerQuestion > 0, jinak bez limitu.
 *  - "classic": klasická hra a submit-answer – settings.timePerQuestion || 20.
 *  - "scoring": bodování – slide.timeLimit || settings.timePerQuestion || 20.
 * Vrací sekundy, nebo null = bez limitu.
 */
export function resolveTimeLimitSec(
  slide: any,
  settings: any,
  legacy: "live" | "classic" | "scoring" = "classic",
): number | null {
  const own = slideTimeLimitSec(slide);
  if (own !== undefined) return own;
  const game = Number(settings?.timePerQuestion);
  if (legacy === "live") return Number.isFinite(game) && game > 0 ? game : null;
  if (legacy === "scoring") {
    return Number(slide?.timeLimit) || game || LEGACY_TIME_FALLBACK_SEC;
  }
  return game || LEGACY_TIME_FALLBACK_SEC;
}

/** Limit pro výpočet bodů (vždy číslo; „bez limitu“ boduje jako dnešní záloha). */
export function scoringTimeLimitMs(slide: any, settings: any): number {
  return (resolveTimeLimitSec(slide, settings, "scoring") ?? LEGACY_TIME_FALLBACK_SEC) * 1000;
}

/* ---------------- Ruční spuštění ---------------- */

/** Slide, na kterém žáci odpovídají (kvíz, anketa, zeď, oblak, týmy, escape…). */
export const isRespondableSlide = (slide: any): boolean =>
  slide?.type === "activity" && !!slide?.activitySpec;

export const isStudentPaced = (settings: any): boolean =>
  settings?.gameMode === "race" || settings?.pacingMode === "student";

export const isManualStart = (settings: any): boolean =>
  settings?.activityStartMode === "manual";

/** Čeká slide `index` na „Spustit“? (tempo žáka a závod nikdy) */
export function isAwaitingStart(settings: any, slide: any, index: number): boolean {
  if (isStudentPaced(settings)) return false;
  if (!isRespondableSlide(slide)) return false;
  return typeof settings?.armedQuestion === "number" && settings.armedQuestion === index;
}

/** Nastavení po přechodu na slide `target` (připraví nebo zruší „Spustit“). */
export function settingsForSlideEnter(settings: any, slides: any[], target: number): Record<string, unknown> {
  const s = { ...(settings || {}) };
  const arm = isManualStart(s) && !isStudentPaced(s) && isRespondableSlide(slides?.[target]);
  if (arm) s.armedQuestion = target;
  else delete s.armedQuestion;
  return s;
}

/** Nastavení po kliknutí na „Spustit“. */
export function settingsForStart(settings: any): Record<string, unknown> {
  const s = { ...(settings || {}) };
  delete s.armedQuestion;
  return s;
}
