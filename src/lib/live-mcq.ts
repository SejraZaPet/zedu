/**
 * Živá hra (/live/...): u MCQ otázek se správná odpověď ukáže až po
 * zveřejnění výsledků dané otázky. Příznak žije v game_sessions.settings.
 */
export const isLiveMcqSlide = (slide: any) =>
  slide?.type === "activity" && slide?.activitySpec?.activityType === "mcq";

export const isMcqRevealed = (settings: any, questionIndex: number) =>
  settings?.mcqRevealedQuestion === questionIndex;

export const mcqRevealPatch = (settings: any, questionIndex: number) => ({
  settings: { ...(settings || {}), mcqRevealedQuestion: questionIndex },
});

import { resolveTimeLimitSec } from "@/lib/live-timing";

/** Čas na otázku v ms (slide → nastavení hry), nebo null = bez limitu. */
export const liveQuestionTimeLimitMs = (settings: any, slide?: any): number | null => {
  const sec = resolveTimeLimitSec(slide, settings, "live");
  return sec ? sec * 1000 : null;
};
