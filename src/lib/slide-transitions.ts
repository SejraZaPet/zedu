/**
 * Přechody mezi slidy.
 *
 * Nastavení platí pro CELOU prezentaci; kvůli tomu, že živé obrazovky čtou
 * slidy z `activity_data`, se hodnota zapisuje na každý slide jako
 * `transitionStyle` (stejný vzorec jako `themeId`).
 */

export type SlideTransition = "cut" | "fade" | "push";

export const DEFAULT_TRANSITION: SlideTransition = "cut";

export const SLIDE_TRANSITIONS: { value: SlideTransition; label: string; hint: string }[] = [
  { value: "cut", label: "Bez přechodu", hint: "Slide se okamžitě vymění" },
  { value: "fade", label: "Prolnutí", hint: "Nový slide se jemně objeví" },
  { value: "push", label: "Posun", hint: "Nový slide přijede z pravé strany" },
];

export function transitionFromSlides(slides: any[]): SlideTransition {
  const found = slides?.find((s) => typeof s?.transitionStyle === "string")?.transitionStyle;
  return (SLIDE_TRANSITIONS.some((t) => t.value === found) ? found : DEFAULT_TRANSITION) as SlideTransition;
}

export function applyTransitionToSlides(slides: any[], transition: SlideTransition): any[] {
  return (slides || []).map((s) => ({ ...s, transitionStyle: transition }));
}

/** CSS class přehrávaná při zobrazení nového slidu v živé prezentaci. */
export function slideTransitionClass(transition?: string | null): string {
  switch (transition) {
    case "fade":
      return "slide-trans-fade";
    case "push":
      return "slide-trans-push";
    default:
      return "";
  }
}
