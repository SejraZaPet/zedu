/**
 * Pomocné funkce pro kreslení v sešitě: přepočet souřadnic dotyku a hlídání
 * jednoho aktivního ukazatele (pero / prst / myš) během tahu.
 */

export interface StageBox {
  /** getBoundingClientRect() plochy (včetně rámečku). */
  left: number;
  top: number;
  /** Tloušťka rámečku vlevo / nahoře (element.clientLeft / clientTop). */
  borderLeft: number;
  borderTop: number;
  /** Vnitřní rozměr bez rámečku (element.clientWidth / clientHeight) — stejný, ve kterém se kreslí. */
  innerWidth: number;
  innerHeight: number;
}

/** Souřadnice dotyku → 0..1 vůči vnitřní ploše (bez rámečku), stejně jako se kreslí. */
export function normalizePoint(clientX: number, clientY: number, box: StageBox): [number, number] {
  const x = box.innerWidth > 0 ? (clientX - box.left - box.borderLeft) / box.innerWidth : 0;
  const y = box.innerHeight > 0 ? (clientY - box.top - box.borderTop) / box.innerHeight : 0;
  return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
}

/**
 * Jeden tah = jeden ukazatel. Druhý prst nebo dlaň během tahu se ignoruje;
 * během tahu perem se ignoruje jakýkoli dotyk.
 */
export class PointerGate {
  private activeId: number | null = null;
  private activeType: string | null = null;

  get active(): number | null {
    return this.activeId;
  }

  /** Vrací true, pokud tento ukazatel smí začít tah. */
  begin(pointerId: number, pointerType: string): boolean {
    if (this.activeId !== null) return false;
    this.activeId = pointerId;
    this.activeType = pointerType;
    return true;
  }

  /** Smí tento ukazatel pokračovat v rozpracovaném tahu? */
  accepts(pointerId: number): boolean {
    return this.activeId !== null && this.activeId === pointerId;
  }

  /** Probíhá tah perem (pak se dotyk ignoruje)? */
  get penActive(): boolean {
    return this.activeType === "pen";
  }

  /** Ukončí tah; vrací true, pokud šlo o aktivní ukazatel. */
  end(pointerId: number): boolean {
    if (!this.accepts(pointerId)) return false;
    this.activeId = null;
    this.activeType = null;
    return true;
  }

  reset(): void {
    this.activeId = null;
    this.activeType = null;
  }
}

/** Ťuknutí perem (jediný bod) se uloží jako tečka — dva totožné body. */
export function finalizeTapPoints(points: [number, number][], pointerType: string | null): [number, number][] | null {
  if (points.length >= 2) return points;
  if (points.length === 1 && pointerType === "pen") return [points[0], points[0]];
  return null;
}

/** Režim „jen pero“: dotyk prstem/dlaní nekreslí; pero a myš ano. */
export function shouldDrawPointer(pointerType: string, penOnly: boolean): boolean {
  return !penOnly || pointerType !== "touch";
}

/** Textová pole a editovatelný obsah si výběr a menu ponechávají. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

export type PenSmoothing = "fine" | "medium" | "strong";
/** Minimální vzdálenost bodu v pixelech zobrazení a váha vyhlazení tlaku. */
export const PEN_SMOOTHING: Record<PenSmoothing, { minDistPx: number; pressureAlpha: number }> = {
  fine: { minDistPx: 0.3, pressureAlpha: 0.7 },
  medium: { minDistPx: 0.6, pressureAlpha: 0.5 },
  strong: { minDistPx: 1.2, pressureAlpha: 0.3 },
};

/** Bod (0..1) bližší než minDistPx od předchozího se neukládá. */
export function farEnough(prev: [number, number] | undefined, next: [number, number], stageW: number, stageH: number, minDistPx: number): boolean {
  if (!prev) return true;
  return Math.hypot((next[0] - prev[0]) * stageW, (next[1] - prev[1]) * stageH) >= minDistPx;
}

/** Exponenciální vyhlazení tlaku (Pencil posílá rozkolísané hodnoty). */
export function smoothPressure(prev: number | undefined, next: number, alpha: number): number {
  return prev === undefined ? next : prev + (next - prev) * alpha;
}

const PREF_KEY = "bezli.notebook.pen";
export interface PenPrefs { penOnly: boolean; smoothing: PenSmoothing }
export function loadPenPrefs(storage: Storage | undefined = globalThis.localStorage): PenPrefs {
  try {
    const v = JSON.parse(storage.getItem(PREF_KEY) || "{}");
    return { penOnly: v.penOnly === true, smoothing: v.smoothing in PEN_SMOOTHING ? v.smoothing : "medium" };
  } catch { return { penOnly: false, smoothing: "medium" }; }
}
export function savePenPrefs(p: PenPrefs, storage: Storage | undefined = globalThis.localStorage): void {
  try { storage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* nedostupné úložiště */ }
}
