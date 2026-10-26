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
