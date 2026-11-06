/** Trasy promítání a celoobrazovkových režimů, kde nesmí překážet plovoucí lišty. */
const PRESENTATION_PREFIXES = [
  "/live/projektor/",
  "/live/ucitel/",
  "/live/student/",
  "/hra/ucitel/",
  "/hra/hrac/",
  "/prezentace/ovladani/",
];

export function isPresentationRoute(pathname: string): boolean {
  return PRESENTATION_PREFIXES.some((p) => pathname.startsWith(p));
}

export const PROJECTOR_ZOOM_MIN = 100;
export const PROJECTOR_ZOOM_MAX = 150;
export const PROJECTOR_ZOOM_STEP = 10;
const ZOOM_KEY = "bezli.projector.zoom";
const CODE_KEY = "bezli.projector.codeAlwaysVisible";

export function clampProjectorZoom(v: number): number {
  if (!Number.isFinite(v)) return PROJECTOR_ZOOM_MIN;
  const stepped = Math.round(v / PROJECTOR_ZOOM_STEP) * PROJECTOR_ZOOM_STEP;
  return Math.min(PROJECTOR_ZOOM_MAX, Math.max(PROJECTOR_ZOOM_MIN, stepped));
}

export function loadProjectorZoom(): number {
  try {
    const raw = window.localStorage.getItem(ZOOM_KEY);
    return raw == null ? PROJECTOR_ZOOM_MIN : clampProjectorZoom(Number(raw));
  } catch {
    return PROJECTOR_ZOOM_MIN;
  }
}
export function saveProjectorZoom(v: number): void {
  try { window.localStorage.setItem(ZOOM_KEY, String(clampProjectorZoom(v))); } catch { /* ignore */ }
}
export function loadCodeAlwaysVisible(): boolean {
  try { return window.localStorage.getItem(CODE_KEY) === "1"; } catch { return false; }
}
export function saveCodeAlwaysVisible(v: boolean): void {
  try { window.localStorage.setItem(CODE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}

/** Měřítko scény 1600×900 na okno (jediné zmenšení) × uživatelské přiblížení. */
export function projectorStageScale(w: number, h: number, zoomPct = 100, stageW = 1600, stageH = 900): number {
  if (!w || !h) return 1;
  return Math.min(w / stageW, h / stageH) * (clampProjectorZoom(zoomPct) / 100);
}
