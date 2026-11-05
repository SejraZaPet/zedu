/** Pure helpers for finger pan / pinch-zoom in the notebook (view only, never touches saved data). */
export const NB_ZOOM_MIN = 0.5;
export const NB_ZOOM_MAX = 2.5;

export const clampZoom = (z: number) => Math.min(NB_ZOOM_MAX, Math.max(NB_ZOOM_MIN, z));

/** Zoom after a pinch: proportional to the finger distance ratio, not a fixed step. */
export function pinchZoom(startZoom: number, startDist: number, dist: number): number {
  if (!(startDist > 0) || !(dist > 0)) return clampZoom(startZoom);
  return clampZoom(startZoom * (dist / startDist));
}

/** New scroll offset that keeps the content point under `anchor` (viewport px) fixed when scale changes by `k`. */
export function anchorScroll(scroll: number, anchor: number, k: number): number {
  return Math.max(0, (scroll + anchor) * k - anchor);
}

export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Should this pointer move the page instead of drawing? Pen always draws unless the hand tool is on. */
export function isGesturePointer(pointerType: string, opts: { hand: boolean; penOnly: boolean; touchCount: number; select?: boolean }): boolean {
  if (opts.hand) return true;
  if (pointerType !== "touch") return false;
  return opts.penOnly || opts.touchCount >= 2 || opts.select === true;
}

/** "Fit width": back to 100 % and scroll to the start. */
export const fitWidth = () => ({ zoom: 1, scrollLeft: 0, scrollTop: 0 });
