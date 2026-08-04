import type { TeamMode } from "@/lib/game-types";

/**
 * Per-slide game settings.
 *
 * A single activity slide inside a mixed presentation (výklad + aktivity) can
 * override the session-wide game mode. "race" is intentionally NOT available
 * here — it only makes sense for a standalone game with many questions.
 */
export type SlideGameMode = "standard" | "tower" | "steal";

export const SLIDE_GAME_MODES: { id: SlideGameMode; name: string; emoji: string; hint: string }[] = [
  { id: "standard", name: "Klasický kvíz", emoji: "🎯", hint: "Body podle rychlosti a správnosti" },
  { id: "tower", name: "Stavění věže", emoji: "🧱", hint: "+1 kostka za správnou odpověď" },
  { id: "steal", name: "Krádež bodů", emoji: "🏴‍☠️", hint: "+5 / −3, krádež soupeři" },
];

export interface SlideGameSettings {
  mode: SlideGameMode;
  teamMode: TeamMode;
  teamCount?: number;
}

/** Resolves the game mode that applies to a concrete slide. */
export function resolveGameMode(sessionSettings: any, slide?: any): string {
  const perSlide = slide?.gameSettings?.mode as string | undefined;
  if (perSlide) return perSlide;
  return (sessionSettings?.gameMode as string) || "standard";
}

/** Resolves the team mode kind that applies to a concrete slide. */
export function resolveTeamModeKind(sessionSettings: any, slide?: any): TeamMode {
  const perSlide = slide?.gameSettings?.teamMode as TeamMode | undefined;
  if (perSlide) return perSlide;
  return (sessionSettings?.teamModeKind as TeamMode) ?? "none";
}

/**
 * True when the session content is a mixed presentation (multiple slides and at
 * least one non-activity slide). Those sessions skip the mandatory game-mode
 * picker in the lobby and default to 'standard' without teams; individual
 * activity slides can still override via slide.gameSettings.
 */
export function isMixedPresentation(slides: any[]): boolean {
  if (!Array.isArray(slides) || slides.length <= 1) return false;
  return slides.some((s) => s?.type && s.type !== "activity");
}
