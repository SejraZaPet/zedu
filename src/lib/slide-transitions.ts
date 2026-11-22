import type { CSSProperties } from "react";

/**
 * Přechod patří k VSTUPU slidu: nastavení na slidu N+1 se přehraje při
 * přechodu z N na N+1. Staré prezentace mají stejnou hodnotu na všech
 * slidech; první slide proto nadále slouží jako výchozí globální volba.
 */
export type SlideTransition =
  | "cut" | "fade" | "push" | "zoom" | "rotate"
  | "wipe" | "blur" | "flip" | "mirror" | "focus";

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
  { value: "cut", label: "Bez přechodu", hint: "Slide se okamžitě vymění" },
  { value: "fade", label: "Prolnutí", hint: "Nový slide se jemně objeví" },
  { value: "push", label: "Posun", hint: "Nový slide přijede zvoleným směrem" },
  { value: "zoom", label: "Přiblížení", hint: "Nový slide se jemně zvětší na plnou velikost" },
  { value: "rotate", label: "Otočení", hint: "Nový slide se mírně otočí do roviny" },
  { value: "wipe", label: "Odkrytí", hint: "Nový slide se odkryje zvoleným směrem" },
  { value: "blur", label: "Rozmazání", hint: "Nový slide se zaostří" },
  { value: "flip", label: "Převrácení", hint: "Nový slide se převrhne do roviny" },
  { value: "mirror", label: "Zrcadlení", hint: "Nový slide se rozvine ze zrcadleného náhledu" },
  { value: "focus", label: "Lupa", hint: "Detail se plynule přiblíží a zaostří" },
];

export const SLIDE_TRANSITION_DIRECTIONS: { value: SlideTransitionDirection; label: string }[] = [
  { value: "left", label: "Doleva" },
  { value: "right", label: "Doprava" },
  { value: "up", label: "Nahoru" },
  { value: "down", label: "Dolů" },
];

const isTransition = (value: unknown): value is SlideTransition =>
  SLIDE_TRANSITIONS.some((item) => item.value === value);
const isDirection = (value: unknown): value is SlideTransitionDirection =>
  SLIDE_TRANSITION_DIRECTIONS.some((item) => item.value === value);

export function normalizeTransitionDuration(value: unknown, fallback = DEFAULT_TRANSITION_DURATION): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, Math.round(parsed * 10) / 10));
}

export function transitionConfigFromSlide(slide: any, fallback: SlideTransition = DEFAULT_TRANSITION): SlideTransitionConfig {
  const style = isTransition(slide?.transitionStyle) ? slide.transitionStyle : fallback;
  return {
    style,
    direction: isDirection(slide?.transitionDirection) ? slide.transitionDirection : DEFAULT_TRANSITION_DIRECTION,
    duration: normalizeTransitionDuration(slide?.transitionDuration),
  };
}

/** Výchozí volba v pravém panelu; u starých prezentací čte původní globální hodnotu. */
export function transitionFromSlides(slides: any[]): SlideTransition {
  const found = slides?.find((slide) => isTransition(slide?.transitionStyle))?.transitionStyle;
  return isTransition(found) ? found : DEFAULT_TRANSITION;
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
  if (!isTransition(transition) || transition === "cut") return "";
  const directional = transition === "push" || transition === "wipe";
  const suffix = directional && isDirection(direction) ? ` slide-trans-dir-${direction}` : directional ? " slide-trans-dir-left" : "";
  return `slide-trans-${transition}${suffix}`;
}

export function slideTransitionStyle(config: SlideTransitionConfig): CSSProperties {
  return config.style === "cut" ? {} : { animationDuration: `${normalizeTransitionDuration(config.duration)}s` };
}
