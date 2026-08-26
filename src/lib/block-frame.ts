/**
 * Volné umístění bloků na slidu ("free-form canvas").
 *
 * Blok může mít nepovinné pole `frame` s procentuálními souřadnicemi vůči
 * stage prezentace (1600×900). Bloky BEZ `frame` se renderují ve stávajícím
 * lineárním flow — chování zůstává beze změny (zpětná kompatibilita).
 */

import type { CSSProperties } from "react";

export interface BlockFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_BLOCK_FRAME: BlockFrame = { x: 10, y: 10, w: 80, h: 20 };

export const MIN_FRAME_SIZE = 5; // %
/** Maximální velikost rámce – bloky smí přesahovat slide (full-bleed). */
export const MAX_FRAME_SIZE = 300; // %
/** Jak daleko za hranu slidu smí rámec zajít. */
export const FRAME_OVERFLOW = 100; // %

export function isValidBlockFrame(frame: any): frame is BlockFrame {
  return (
    !!frame &&
    typeof frame.x === "number" &&
    typeof frame.y === "number" &&
    typeof frame.w === "number" &&
    typeof frame.h === "number" &&
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    frame.w > 0 &&
    frame.h > 0
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Zaokrouhlí rámec a udrží ho v rozumných mezích. Bloky smí přesahovat okraje
 * slidu (obrázky/tvary na spad), stačí aby zůstala část viditelná na plátně.
 */
export function clampBlockFrame(frame: BlockFrame): BlockFrame {
  const w = Math.max(MIN_FRAME_SIZE, Math.min(MAX_FRAME_SIZE, frame.w));
  const h = Math.max(MIN_FRAME_SIZE, Math.min(MAX_FRAME_SIZE, frame.h));
  return {
    x: round1(Math.max(-FRAME_OVERFLOW, Math.min(100 + FRAME_OVERFLOW - MIN_FRAME_SIZE, frame.x))),
    y: round1(Math.max(-FRAME_OVERFLOW, Math.min(100 + FRAME_OVERFLOW - MIN_FRAME_SIZE, frame.y))),
    w: round1(w),
    h: round1(h),
  };
}


/** Vrátí platný rámec bloku, nebo null pro bloky v lineárním flow. */
export function getBlockFrame(block: any): BlockFrame | null {
  return isValidBlockFrame(block?.frame) ? clampBlockFrame(block.frame) : null;
}

export function frameStyle(frame: BlockFrame): CSSProperties {
  return {
    position: "absolute",
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`,
  };
}

export type FrameHandle =
  | "move"
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

/** Aplikuje posun (v % stage) na rámec podle zvoleného úchytu. */
export function applyFrameDrag(
  start: BlockFrame,
  handle: FrameHandle,
  dxPct: number,
  dyPct: number,
): BlockFrame {
  let { x, y, w, h } = start;
  if (handle === "move") {
    return clampBlockFrame({ x: x + dxPct, y: y + dyPct, w, h });
  }
  if (handle.includes("w")) {
    const nx = x + dxPct;
    const nw = w - dxPct;
    if (nw >= MIN_FRAME_SIZE) {
      x = nx;
      w = nw;
    }
  }
  if (handle.includes("e")) {
    w = w + dxPct;
  }
  if (handle.includes("n")) {
    const ny = y + dyPct;
    const nh = h - dyPct;
    if (nh >= MIN_FRAME_SIZE) {
      y = ny;
      h = nh;
    }
  }
  if (handle.includes("s")) {
    h = h + dyPct;
  }
  return clampBlockFrame({ x, y, w, h });
}
