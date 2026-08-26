/**
 * Volné umístění bloků na slidu ("free-form canvas").
 *
 * Blok může mít nepovinné pole `frame` s procentuálními souřadnicemi vůči
 * stage prezentace (1600×900). Bloky BEZ `frame` se renderují ve stávajícím
 * lineárním flow — chování zůstává beze změny (zpětná kompatibilita).
 */

export interface BlockFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_BLOCK_FRAME: BlockFrame = { x: 10, y: 10, w: 80, h: 20 };

export const MIN_FRAME_SIZE = 5; // %

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

/** Omezí rámec do plochy slidu a zaokrouhlí na 1 desetinné místo. */
export function clampBlockFrame(frame: BlockFrame): BlockFrame {
  const w = Math.max(MIN_FRAME_SIZE, Math.min(100, frame.w));
  const h = Math.max(MIN_FRAME_SIZE, Math.min(100, frame.h));
  return {
    x: round1(Math.max(0, Math.min(100 - w, frame.x))),
    y: round1(Math.max(0, Math.min(100 - h, frame.y))),
    w: round1(w),
    h: round1(h),
  };
}

/** Vrátí platný rámec bloku, nebo null pro bloky v lineárním flow. */
export function getBlockFrame(block: any): BlockFrame | null {
  return isValidBlockFrame(block?.frame) ? clampBlockFrame(block.frame) : null;
}

export function frameStyle(frame: BlockFrame): React.CSSProperties {
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
