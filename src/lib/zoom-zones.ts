/**
 * Zoom zones ("Přiblížení") — percentage-based crop rectangles over a slide.
 *
 * Coordinates are ALWAYS percentages (0-100) of the slide stage, so they are
 * resolution independent and work identically on the teacher preview, the
 * projector (1600x900 stage) and student phones.
 */

export interface ZoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomZone extends ZoomRect {
  id: string;
  label?: string;
}

export const MIN_ZONE_SIZE = 5; // percent

export function clampRect(rect: ZoomRect): ZoomRect {
  const width = Math.max(MIN_ZONE_SIZE, Math.min(100, rect.width));
  const height = Math.max(MIN_ZONE_SIZE, Math.min(100, rect.height));
  return {
    x: Math.max(0, Math.min(100 - width, rect.x)),
    y: Math.max(0, Math.min(100 - height, rect.y)),
    width,
    height,
  };
}

export function isValidZoomRect(rect: any): rect is ZoomRect {
  return (
    !!rect &&
    typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    typeof rect.width === "number" &&
    typeof rect.height === "number" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function getZoomZones(slide: any): ZoomZone[] {
  const zones = slide?.zoomZones;
  if (!Array.isArray(zones)) return [];
  return (zones as any[]).filter((z) => typeof z?.id === "string" && isValidZoomRect(z)) as ZoomZone[];
}

/**
 * CSS transform that maps the given rect onto the full stage.
 * Apply to an element that fills the stage; parent must clip (overflow hidden).
 */
export function zoomStageStyle(rect: ZoomRect | null | undefined): React.CSSProperties {
  const base: React.CSSProperties = {
    transformOrigin: "0 0",
    transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
    willChange: "transform",
  };
  if (!isValidZoomRect(rect)) return { ...base, transform: "none" };
  const safe = clampRect(rect);
  const scale = Math.min(100 / safe.width, 100 / safe.height);
  return {
    ...base,
    transform: `scale(${scale}) translate(${-safe.x}%, ${-safe.y}%)`,
  };
}

/** Zoom only makes sense on explanatory slides, not quizzes / interactive activities. */
export function isZoomableSlide(slide: any): boolean {
  if (!slide) return false;
  if (slide.type === "activity" || slide.type === "practice") return false;
  if (slide.activitySpec?.activityType) return false;
  if (slide.question) return false;
  return true;
}
