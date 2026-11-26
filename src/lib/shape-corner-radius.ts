import { STAGE_W, STAGE_H } from "@/lib/slide-stage";

/** Tvary, u kterých lze nastavit poloměr rohů v px slidu. */
export const isRoundableRect = (kind?: string) => (kind || "rectangle") === "rectangle" || kind === "rounded-rect";

/** Výchozí poloměr nového zaobleného obdélníku (px slidu). */
export const DEFAULT_ROUNDED_RADIUS_PX = 24;

export const maxCornerRadiusPx = (w: number, h: number) => Math.max(0, Math.min(w, h) / 2);

export interface CornerRadiusProps {
  shapeKind?: string;
  cornerRadiusPx?: number | null;
  /** Starší poloměr v jednotkách viewBoxu 200×100. */
  borderRadius?: number | null;
}

/**
 * Kruhový poloměr rohů v px pro tvar o rozměrech w × h px.
 * Nová vlastnost `cornerRadiusPx` je nezávislá na velikosti (jen se ořízne na polovinu
 * kratší strany). Starší tvary bez ní přepočítáme z jednotek viewBoxu podle šířky,
 * stejně jako je dnes SVG natahovalo vodorovně.
 */
export function resolveCornerRadiusPx(p: CornerRadiusProps, w: number, h: number): number {
  const max = maxCornerRadiusPx(w, h);
  const kind = p.shapeKind || "rectangle";
  if (kind === "pill") return max;
  const explicit = Number(p.cornerRadiusPx);
  if (p.cornerRadiusPx !== null && p.cornerRadiusPx !== undefined && Number.isFinite(explicit)) return Math.min(max, Math.max(0, explicit));
  const units = kind === "rounded-rect" ? Math.max(0, Math.min(50, Number(p.borderRadius ?? 30) || 0)) : 6;
  return Math.min(max, (units * w) / 200);
}

/** Rozměry rámu (v % slidu) převedené na px scény. */
export function frameSizePx(frame?: { w?: number; h?: number } | null, fallbackH = 160) {
  if (!frame) return { w: STAGE_W, h: fallbackH };
  return { w: (Number(frame.w ?? 100) * STAGE_W) / 100, h: (Number(frame.h ?? 10) * STAGE_H) / 100 };
}
