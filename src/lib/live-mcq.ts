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

/** Čas na otázku v ms (z nastavení hry), nebo null pokud není nastavený. */
export const liveQuestionTimeLimitMs = (settings: any): number | null => {
  const sec = Number(settings?.timePerQuestion);
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : null;
};
