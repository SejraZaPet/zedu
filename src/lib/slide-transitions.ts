import type { CSSProperties } from "react";

/**
 * Přechod patří k VSTUPU slidu: nastavení na slidu N+1 se přehraje při
 * přechodu z N na N+1. Staré prezentace mají stejnou hodnotu na všech
 * slidech; první slide proto nadále slouží jako výchozí globální volba.
 */
export type SlideTransition =
  | "cut" | "fade" | "push" | "circle-wipe" | "color-wipe"
  | "line-wipe" | "match-move" | "flow" | "stack" | "slice";

export type SlideTransitionDirection = "left" | "right" | "up" | "down";

export interface SlideTransitionConfig {
  style: SlideTransition;
  direction: SlideTransitionDirection;
  /** Délka v sekundách. */
  duration: number;
}

export const DEFAULT_TRANSITION: SlideTransition = "fade";
export const DEFAULT_TRANSITION_DIRECTION: SlideTransitionDirection = "left";
export const DEFAULT_TRANSITION_DURATION = 0.45;
export const MIN_TRANSITION_DURATION = 0.2;
export const MAX_TRANSITION_DURATION = 2;

export const SLIDE_TRANSITIONS: { value: SlideTransition; label: string; hint: string }[] = [
  { value: "cut", label: "Žádný", hint: "Slide se okamžitě vymění" },
  { value: "fade", label: "Rozpuštění", hint: "Nový slide se jemně objeví" },
  { value: "push", label: "Posunutí", hint: "Nový slide přijede zvoleným směrem" },
  { value: "circle-wipe", label: "Kruhové stírání", hint: "Kruh se od středu rozšíří na celý slide" },
  { value: "color-wipe", label: "Stírání barev", hint: "Barevný pruh přejede přes slide a odhalí další" },
  { value: "line-wipe", label: "Čárové stírání", hint: "Svislá hrana odhalí další slide" },
  { value: "match-move", label: "Porovnat a přesunout", hint: "Shodně pojmenované prvky se přesunou a změní velikost" },
  { value: "flow", label: "Proudění", hint: "Rychlé čáry doprovázejí posun dalšího slidu" },
  { value: "stack", label: "Skládání", hint: "Nový slide se položí zespodu na starý" },
  { value: "slice", label: "Rozseknutí", hint: "Slide se odhalí v diagonálních pruzích" },
];

export const SLIDE_TRANSITION_DIRECTIONS: { value: SlideTransitionDirection; label: string }[] = [
  { value: "left", label: "Doleva" },
  { value: "right", label: "Doprava" },
  { value: "up", label: "Nahoru" },
  { value: "down", label: "Dolů" },
];

const LEGACY_TRANSITIONS: Record<string, SlideTransition> = {
  wipe: "line-wipe",
  zoom: "fade",
  rotate: "fade",
  blur: "fade",
  flip: "fade",
  mirror: "fade",
  focus: "fade",
};

const isTransition = (value: unknown): value is SlideTransition =>
  SLIDE_TRANSITIONS.some((item) => item.value === value);
const isDirection = (value: unknown): value is SlideTransitionDirection =>
  SLIDE_TRANSITION_DIRECTIONS.some((item) => item.value === value);

export function normalizeSlideTransition(value: unknown, fallback: SlideTransition = DEFAULT_TRANSITION): SlideTransition {
  if (isTransition(value)) return value;
  if (typeof value === "string" && LEGACY_TRANSITIONS[value]) return LEGACY_TRANSITIONS[value];
  return fallback;
}

export function normalizeTransitionDuration(value: unknown, fallback = DEFAULT_TRANSITION_DURATION): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, Math.round(parsed * 10) / 10));
}

export function transitionConfigFromSlide(slide: any, fallback: SlideTransition = DEFAULT_TRANSITION): SlideTransitionConfig {
  return {
    style: normalizeSlideTransition(slide?.transitionStyle, fallback),
    direction: isDirection(slide?.transitionDirection) ? slide.transitionDirection : DEFAULT_TRANSITION_DIRECTION,
    duration: normalizeTransitionDuration(slide?.transitionDuration),
  };
}

/** Výchozí volba v pravém panelu; u starých prezentací čte původní globální hodnotu. */
export function transitionFromSlides(slides: any[]): SlideTransition {
  const found = slides?.find((slide) => slide?.transitionStyle != null)?.transitionStyle;
  return normalizeSlideTransition(found, DEFAULT_TRANSITION);
}

function withTransition(slide: any, config: SlideTransitionConfig) {
  return {
    ...slide,
    transitionStyle: config.style,
    transitionDirection: config.direction,
    transitionDuration: normalizeTransitionDuration(config.duration),
  };
}

/** Nastaví přechod pouze pro vstup jednoho slidu. Ostatní slidy zůstanou beze změny. */
export function applyTransitionToSlide(slides: any[], index: number, config: SlideTransitionConfig): any[] {
  if (!Number.isInteger(index) || index < 0 || index >= (slides?.length ?? 0)) return slides;
  return slides.map((slide, slideIndex) => slideIndex === index ? withTransition(slide, config) : slide);
}

/** Původní globální akce: stejný přechod pro celou prezentaci. */
export function applyTransitionToSlides(
  slides: any[],
  transition: SlideTransition | SlideTransitionConfig,
  direction: SlideTransitionDirection = DEFAULT_TRANSITION_DIRECTION,
  duration = DEFAULT_TRANSITION_DURATION,
): any[] {
  const config: SlideTransitionConfig = typeof transition === "string"
    ? { style: transition, direction, duration: normalizeTransitionDuration(duration) }
    : { ...transition, duration: normalizeTransitionDuration(transition.duration) };
  return (slides || []).map((slide) => withTransition(slide, config));
}

/** CSS třídy přehrávané při zobrazení nového slidu v projekci i na telefonu. */
export function slideTransitionClass(
  transition?: string | null,
  direction?: string | null,
): string {
  const style = normalizeSlideTransition(transition, "cut");
  if (style === "cut") return "";
  const suffix = style === "push" ? ` slide-trans-dir-${isDirection(direction) ? direction : "left"}` : "";
  return `slide-trans-${style}${suffix}`;
}

export function slideTransitionStyle(config: SlideTransitionConfig): CSSProperties {
  return config.style === "cut" ? {} : { animationDuration: `${normalizeTransitionDuration(config.duration)}s` };
}

function plainText(value: unknown): string {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Stabilní pár pro Match & move. Stejný typ a učitelův název (případně text)
 * stačí i po zkopírování slidu, kdy se mění interní ID bloků.
 */
export function slideTransitionMatchKey(block: any): string {
  const props = block?.props || {};
  const spec = block?.activitySpec || props?.activitySpec || {};
  const name = props.transitionName || props.name || props.alt || props.caption
    || props.iconName || props.text || props.html || props.title
    || spec.question || spec.title || "";
  const normalized = plainText(name).toLocaleLowerCase("cs").slice(0, 160);
  return normalized ? `${String(block?.type || "block")}:${normalized}` : "";
}
