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

/** Rotace bloku ve stupních (props.rotation). Normalizuje na 0–359,9. */
export function normalizeRotation(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const r = Math.round((((n % 360) + 360) % 360) * 10) / 10;
  return r === 360 ? 0 : r;
}

/** Vrátí rotaci bloku (0 = bez rotace). */
export function getBlockRotation(block: any): number {
  return normalizeRotation(block?.props?.rotation);
}

/* ============================================================================
 * Zarovnávání, přichytávání (snap) a skupiny bloků
 * ==========================================================================*/

/** Vodítka k vykreslení (v % plochy slidu). */
export interface SnapGuides {
  /** Svislé linky (souřadnice X v %). */
  v: number[];
  /** Vodorovné linky (souřadnice Y v %). */
  h: number[];
}

export const SNAP_TOLERANCE = 1; // % plochy slidu
/** Bezpečný okraj slidu. */
export const SAFE_MARGIN = 5; // %

export const EMPTY_GUIDES: SnapGuides = { v: [], h: [] };

/** Kandidátní linky slidu (okraje, střed, bezpečný okraj). */
function stageLines(): { v: number[]; h: number[] } {
  return {
    v: [0, SAFE_MARGIN, 50, 100 - SAFE_MARGIN, 100],
    h: [0, SAFE_MARGIN, 50, 100 - SAFE_MARGIN, 100],
  };
}

/** Kandidátní linky z ostatních bloků (okraje + středy). */
export function frameLines(others: BlockFrame[]): { v: number[]; h: number[] } {
  const base = stageLines();
  for (const f of others) {
    base.v.push(f.x, f.x + f.w / 2, f.x + f.w);
    base.h.push(f.y, f.y + f.h / 2, f.y + f.h);
  }
  return base;
}

function nearest(values: number[], targets: number[], tol: number): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const value of values) {
    for (const line of targets) {
      const delta = line - value;
      if (Math.abs(delta) <= tol && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, line };
      }
    }
  }
  return best;
}

/**
 * Přichytí rámec k linkám slidu i ostatních bloků. Vrací upravený rámec
 * a vodítka, která se mají zobrazit (prázdná = žádné přichycení).
 */
export function snapFrame(
  frame: BlockFrame,
  handle: FrameHandle,
  others: BlockFrame[],
  tolerance = SNAP_TOLERANCE,
): { frame: BlockFrame; guides: SnapGuides } {
  const lines = frameLines(others);
  const guides: SnapGuides = { v: [], h: [] };
  let { x, y, w, h } = frame;

  if (handle === "move") {
    const sx = nearest([x, x + w / 2, x + w], lines.v, tolerance);
    if (sx) {
      x += sx.delta;
      guides.v.push(sx.line);
    }
    const sy = nearest([y, y + h / 2, y + h], lines.h, tolerance);
    if (sy) {
      y += sy.delta;
      guides.h.push(sy.line);
    }
    return { frame: clampBlockFrame({ x, y, w, h }), guides };
  }

  if (handle.includes("w")) {
    const s = nearest([x], lines.v, tolerance);
    if (s && w - s.delta >= MIN_FRAME_SIZE) {
      x += s.delta;
      w -= s.delta;
      guides.v.push(s.line);
    }
  }
  if (handle.includes("e")) {
    const s = nearest([x + w], lines.v, tolerance);
    if (s && w + s.delta >= MIN_FRAME_SIZE) {
      w += s.delta;
      guides.v.push(s.line);
    }
  }
  if (handle.includes("n")) {
    const s = nearest([y], lines.h, tolerance);
    if (s && h - s.delta >= MIN_FRAME_SIZE) {
      y += s.delta;
      h -= s.delta;
      guides.h.push(s.line);
    }
  }
  if (handle.includes("s")) {
    const s = nearest([y + h], lines.h, tolerance);
    if (s && h + s.delta >= MIN_FRAME_SIZE) {
      h += s.delta;
      guides.h.push(s.line);
    }
  }
  return { frame: clampBlockFrame({ x, y, w, h }), guides };
}

/** Přichytí rámec k mřížce s krokem `step` (%). */
export function snapFrameToGrid(frame: BlockFrame, handle: FrameHandle, step = 1): BlockFrame {
  const r = (n: number) => Math.round(n / step) * step;
  if (handle === "move") return clampBlockFrame({ ...frame, x: r(frame.x), y: r(frame.y) });
  return clampBlockFrame({ x: r(frame.x), y: r(frame.y), w: r(frame.w), h: r(frame.h) });
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/** Zarovná jeden rámec vůči celému slidu. */
export function alignFrameToStage(frame: BlockFrame, mode: AlignMode): BlockFrame {
  switch (mode) {
    case "left":
      return clampBlockFrame({ ...frame, x: 0 });
    case "hcenter":
      return clampBlockFrame({ ...frame, x: (100 - frame.w) / 2 });
    case "right":
      return clampBlockFrame({ ...frame, x: 100 - frame.w });
    case "top":
      return clampBlockFrame({ ...frame, y: 0 });
    case "vcenter":
      return clampBlockFrame({ ...frame, y: (100 - frame.h) / 2 });
    case "bottom":
      return clampBlockFrame({ ...frame, y: 100 - frame.h });
  }
}

/** Rámec na celý snímek. */
export function fillStageFrame(): BlockFrame {
  return { x: 0, y: 0, w: 100, h: 100 };
}

/** Obalový rámec (bounding box) skupiny rámců. */
export function boundingFrame(frames: BlockFrame[]): BlockFrame {
  const x = Math.min(...frames.map((f) => f.x));
  const y = Math.min(...frames.map((f) => f.y));
  const x2 = Math.max(...frames.map((f) => f.x + f.w));
  const y2 = Math.max(...frames.map((f) => f.y + f.h));
  return clampBlockFrame({ x, y, w: Math.max(MIN_FRAME_SIZE, x2 - x), h: Math.max(MIN_FRAME_SIZE, y2 - y) });
}

/** Zarovná rámce vůči sobě navzájem (podle bounding boxu výběru). */
export function alignFramesTogether(frames: BlockFrame[], mode: AlignMode): BlockFrame[] {
  if (frames.length < 2) return frames;
  const box = boundingFrame(frames);
  return frames.map((f) => {
    switch (mode) {
      case "left":
        return clampBlockFrame({ ...f, x: box.x });
      case "hcenter":
        return clampBlockFrame({ ...f, x: box.x + (box.w - f.w) / 2 });
      case "right":
        return clampBlockFrame({ ...f, x: box.x + box.w - f.w });
      case "top":
        return clampBlockFrame({ ...f, y: box.y });
      case "vcenter":
        return clampBlockFrame({ ...f, y: box.y + (box.h - f.h) / 2 });
      case "bottom":
        return clampBlockFrame({ ...f, y: box.y + box.h - f.h });
    }
  });
}

/**
 * Rozmístí rámce se stejnými mezerami mezi sebou. Zachová krajní prvky.
 * Vrací rámce ve stejném pořadí, v jakém přišly.
 */
export function distributeFrames(frames: BlockFrame[], axis: "h" | "v"): BlockFrame[] {
  if (frames.length < 3) return frames;
  const indexed = frames.map((f, i) => ({ f, i }));
  indexed.sort((a, b) => (axis === "h" ? a.f.x - b.f.x : a.f.y - b.f.y));
  const first = indexed[0].f;
  const last = indexed[indexed.length - 1].f;
  const start = axis === "h" ? first.x + first.w : first.y + first.h;
  const end = axis === "h" ? last.x : last.y;
  const inner = indexed.slice(1, -1);
  const totalSize = inner.reduce((sum, it) => sum + (axis === "h" ? it.f.w : it.f.h), 0);
  const gap = (end - start - totalSize) / (inner.length + 1);
  const out = frames.slice();
  let cursor = start + gap;
  for (const it of inner) {
    out[it.i] = clampBlockFrame(
      axis === "h" ? { ...it.f, x: cursor } : { ...it.f, y: cursor },
    );
    cursor += (axis === "h" ? it.f.w : it.f.h) + gap;
  }
  return out;
}

/** Přepočte absolutní rámec na relativní (v % obalového boxu). */
export function toRelativeFrame(child: BlockFrame, box: BlockFrame): BlockFrame {
  return {
    x: round1(((child.x - box.x) / box.w) * 100),
    y: round1(((child.y - box.y) / box.h) * 100),
    w: round1((child.w / box.w) * 100),
    h: round1((child.h / box.h) * 100),
  };
}

/** Přepočte relativní rámec potomka skupiny na absolutní rámec slidu. */
export function toAbsoluteFrame(child: BlockFrame, box: BlockFrame): BlockFrame {
  return clampBlockFrame({
    x: box.x + (child.x / 100) * box.w,
    y: box.y + (child.y / 100) * box.h,
    w: Math.max(0.1, (child.w / 100) * box.w),
    h: Math.max(0.1, (child.h / 100) * box.h),
  });
}

/** Potomci skupinového bloku (bloky s relativním rámcem). */
export function getGroupChildren(block: any): any[] {
  const children = block?.props?.children;
  return Array.isArray(children) ? children : [];
}

/**
 * Spojí bloky do jednoho skupinového bloku. Potomci si drží relativní
 * rámce vůči obalovému boxu, takže se s ní scalují i posouvají.
 */
export function makeGroupBlock(blocks: any[], id: string): any {
  const frames = blocks.map((b) => getBlockFrame(b) || DEFAULT_BLOCK_FRAME);
  const box = boundingFrame(frames);
  const maxZ = blocks.reduce((m, b) => Math.max(m, typeof b?.zIndex === "number" ? b.zIndex : 0), 0);
  return {
    id,
    type: "group",
    frame: box,
    zIndex: maxZ,
    props: {
      children: blocks.map((b, i) => ({ ...b, frame: toRelativeFrame(frames[i], box) })),
    },
  };
}

/** Rozpustí skupinu na jednotlivé bloky se zachovanou pozicí/velikostí. */
export function ungroupBlock(group: any): any[] {
  const box = getBlockFrame(group);
  const children = getGroupChildren(group);
  if (!box || !children.length) return [];
  return children.map((child) => ({
    ...child,
    frame: toAbsoluteFrame(getBlockFrame(child) || DEFAULT_BLOCK_FRAME, box),
  }));
}
