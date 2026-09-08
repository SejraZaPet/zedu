/**
 * Barevné přechody (gradienty) pro bloky a pozadí slidů.
 *
 * Gradient je volitelný: blok bez `gradient` se chová stejně jako dřív
 * (jednobarevná `color` / `fillColor` / `backgroundOverride.color`).
 */

export interface SlideGradient {
  /** Počáteční barva (HEX). */
  from: string;
  /** Koncová barva (HEX). */
  to: string;
  /** Směr v CSS zápisu, např. "135deg" nebo "to right". */
  direction?: string;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Směry nabízené v UI. */
export const GRADIENT_DIRECTIONS: { value: string; label: string }[] = [
  { value: "135deg", label: "Diagonálně (jako logo)" },
  { value: "45deg", label: "Diagonálně vzhůru" },
  { value: "to right", label: "Vodorovně" },
  { value: "to bottom", label: "Svisle" },
  { value: "to left", label: "Vodorovně zprava" },
  { value: "to top", label: "Svisle zdola" },
];

export const DEFAULT_GRADIENT_DIRECTION = "135deg";

/** Přechod z loga Bezli (tyrkysová → fialová, diagonálně). */
export const BEZLI_GRADIENT: SlideGradient = {
  from: "#6EC6D9",
  to: "#9B6CFF",
  direction: DEFAULT_GRADIENT_DIRECTION,
};

/** Hotové přednastavené přechody v paletě. */
export const GRADIENT_PRESETS: { label: string; gradient: SlideGradient }[] = [
  { label: "Barvy Bezli", gradient: BEZLI_GRADIENT },
  { label: "Bezli obráceně", gradient: { from: "#9B6CFF", to: "#6EC6D9", direction: "135deg" } },
  { label: "Noční modrá", gradient: { from: "#0F172A", to: "#3B82F6", direction: "135deg" } },
  { label: "Sluneční", gradient: { from: "#F59E0B", to: "#EF4444", direction: "135deg" } },
  { label: "Mentolová", gradient: { from: "#10B981", to: "#6EC6D9", direction: "135deg" } },
  { label: "Růžová", gradient: { from: "#FBCFE8", to: "#9B6CFF", direction: "135deg" } },
];

/** Vrátí platný gradient, nebo null (neplatný / chybějící). */
export function normalizeGradient(value: any): SlideGradient | null {
  if (!value || typeof value !== "object") return null;
  const from = typeof value.from === "string" ? value.from.trim() : "";
  const to = typeof value.to === "string" ? value.to.trim() : "";
  if (!HEX_RE.test(from) || !HEX_RE.test(to)) return null;
  const direction =
    typeof value.direction === "string" && value.direction.trim()
      ? value.direction.trim()
      : DEFAULT_GRADIENT_DIRECTION;
  return { from, to, direction };
}

/** CSS hodnota `linear-gradient(...)`, nebo null. */
export function gradientCss(value: any): string | null {
  const g = normalizeGradient(value);
  return g ? `linear-gradient(${g.direction}, ${g.from}, ${g.to})` : null;
}

/** Styl pro plochu s přechodem (pozadí bloku, snímku, náhledu). */
export function gradientBackgroundStyle(value: any): React.CSSProperties | null {
  const css = gradientCss(value);
  return css ? { backgroundImage: css, backgroundColor: "transparent" } : null;
}

/** Styl pro text s přechodem (background-clip: text). */
export function gradientTextStyle(value: any): React.CSSProperties | null {
  const css = gradientCss(value);
  if (!css) return null;
  return {
    backgroundImage: css,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  } as React.CSSProperties;
}
