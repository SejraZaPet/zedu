export const PROJECTOR_FONT_SCALE_MIN = 80;
export const PROJECTOR_FONT_SCALE_DEFAULT = 100;
export const PROJECTOR_FONT_SCALE_MAX = 160;
export const PROJECTOR_FONT_SCALE_STEP = 10;
export const PROJECTOR_FONT_SCALE_KEY = "bezli.projectorFontScale";

/** Velikost písma projekce v procentech; neznámá hodnota zůstane na 100 %. */
export function clampProjectorFontScale(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return PROJECTOR_FONT_SCALE_DEFAULT;
  const stepped = Math.round(numeric / PROJECTOR_FONT_SCALE_STEP) * PROJECTOR_FONT_SCALE_STEP;
  return Math.min(PROJECTOR_FONT_SCALE_MAX, Math.max(PROJECTOR_FONT_SCALE_MIN, stepped));
}

export function loadProjectorFontScale(): number {
  try {
    const raw = window.localStorage.getItem(PROJECTOR_FONT_SCALE_KEY);
    return raw == null ? PROJECTOR_FONT_SCALE_DEFAULT : clampProjectorFontScale(raw);
  } catch {
    return PROJECTOR_FONT_SCALE_DEFAULT;
  }
}

export function saveProjectorFontScale(value: unknown): number {
  const clamped = clampProjectorFontScale(value);
  try { window.localStorage.setItem(PROJECTOR_FONT_SCALE_KEY, String(clamped)); } catch { /* soukromý režim */ }
  return clamped;
}

/** Zachová všechna stávající nastavení relace včetně ručního spouštění aktivit. */
export function settingsWithProjectorFontScale(settings: unknown, value: unknown): Record<string, unknown> {
  const current = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};
  return { ...current, projectorFontScale: clampProjectorFontScale(value) };
}

/** Násobič z relace se skládá s ruční velikostí písma konkrétního snímku. */
export function combinedProjectorFontScale(slideScale: unknown, sessionPercent: unknown): number {
  const parsedSlideScale = Number(slideScale);
  const base = Number.isFinite(parsedSlideScale) && parsedSlideScale > 0 ? parsedSlideScale : 1;
  return base * (clampProjectorFontScale(sessionPercent) / 100);
}
