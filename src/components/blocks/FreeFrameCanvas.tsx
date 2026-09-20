import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  applyFrameDrag,
  snapFrame,
  snapFrameToGrid,
  type BlockFrame,
  type FrameHandle,
  type SnapGuides,
} from "@/lib/block-frame";

export interface FreeFrameItem {
  id: string;
  frame: BlockFrame;
  node: React.ReactNode;
}

interface ReadOnlyFrameLayout {
  frames: Record<string, BlockFrame>;
  extent: number;
}

const SAME_ROW_TOLERANCE = 2;

/**
 * Zvětší karty podle změřeného obsahu a posune následující vizuální řady.
 * Původní mezery i vodorovné souřadnice zůstávají zachované.
 */
export function layoutReadOnlyFrames(
  items: Pick<FreeFrameItem, "id" | "frame">[],
  requiredHeights: Record<string, number> = {},
): ReadOnlyFrameLayout {
  const sorted = [...items].sort((a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x);
  const rows: typeof sorted[] = [];

  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(item.frame.y - row[0].frame.y) <= SAME_ROW_TOLERANCE) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  const frames: Record<string, BlockFrame> = {};
  let nextTop: number | null = null;

  rows.forEach((row, rowIndex) => {
    const originalTop = Math.min(...row.map((item) => item.frame.y));
    const originalBottom = Math.max(...row.map((item) => item.frame.y + item.frame.h));
    const renderedTop = nextTop === null ? originalTop : Math.max(originalTop, nextTop);
    const shift = renderedTop - originalTop;

    for (const item of row) {
      frames[item.id] = {
        ...item.frame,
        y: item.frame.y + shift,
        h: Math.max(item.frame.h, requiredHeights[item.id] ?? 0),
      };
    }

    const renderedBottom = Math.max(...row.map((item) => frames[item.id].y + frames[item.id].h));
    const followingRow = rows[rowIndex + 1];
    if (followingRow) {
      const followingTop = Math.min(...followingRow.map((item) => item.frame.y));
      const originalGap = Math.max(0, followingTop - originalBottom);
      nextTop = renderedBottom + originalGap;
    }
  });

  return {
    frames,
    extent: Math.max(100, ...Object.values(frames).map((frame) => frame.y + frame.h)),
  };
}

function sameLayout(a: ReadOnlyFrameLayout, b: ReadOnlyFrameLayout): boolean {
  if (Math.abs(a.extent - b.extent) > 0.05) return false;
  const ids = Object.keys(a.frames);
  if (ids.length !== Object.keys(b.frames).length) return false;
  return ids.every((id) => {
    const left = a.frames[id];
    const right = b.frames[id];
    return !!right && (["x", "y", "w", "h"] as const).every((key) => Math.abs(left[key] - right[key]) <= 0.05);
  });
}

const HANDLES: { handle: FrameHandle; className: string; cursor: string }[] = [
  { handle: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { handle: "n", className: "left-1/2 -top-1 -translate-x-1/2", cursor: "ns-resize" },
  { handle: "ne", className: "-right-1 -top-1", cursor: "nesw-resize" },
  { handle: "e", className: "-right-1 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { handle: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
  { handle: "s", className: "left-1/2 -bottom-1 -translate-x-1/2", cursor: "ns-resize" },
  { handle: "sw", className: "-left-1 -bottom-1", cursor: "nesw-resize" },
  { handle: "w", className: "-left-1 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

/**
 * Plátno s volně rozmístěnými bloky (x/y/w/h v %). Sdílí přesně tu samou
 * logiku tažení / změny velikosti / přichytávání jako editor prezentace
 * (`@/lib/block-frame`). Bez `onChangeFrame` jde o jen-pro-čtení zobrazení
 * (žákovská strana, náhled).
 */
const FreeFrameCanvas = ({
  items,
  onChangeFrame,
  selectedId,
  onSelect,
  className = "",
  heightBar = false,
}: {
  items: FreeFrameItem[];
  onChangeFrame?: (id: string, frame: BlockFrame) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  className?: string;
  /** Vždy viditelný pruh na spodním okraji karty pro tažení výšky (jako ve Sloupcích). */
  heightBar?: boolean;
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const editable = !!onChangeFrame;
  const [readOnlyLayout, setReadOnlyLayout] = useState<ReadOnlyFrameLayout>(() => layoutReadOnlyFrames(items));

  const measureReadOnlyLayout = useCallback(() => {
    if (editable || !stageRef.current) return;
    const stageWidth = stageRef.current.getBoundingClientRect().width;
    if (!stageWidth) return;

    // 100 jednotek výšky odpovídá základnímu plátnu 16:9. Díky tomu zůstává
    // měření nezávislé na už prodloužené výšce read-only plátna.
    const baseCanvasHeight = stageWidth * (9 / 16);
    const requiredHeights: Record<string, number> = {};
    for (const item of items) {
      const node = contentRefs.current[item.id];
      if (!node) continue;
      requiredHeights[item.id] = (node.scrollHeight / baseCanvasHeight) * 100;
    }

    const next = layoutReadOnlyFrames(items, requiredHeights);
    setReadOnlyLayout((current) => (sameLayout(current, next) ? current : next));
  }, [editable, items]);

  useLayoutEffect(() => {
    if (editable) return;
    setReadOnlyLayout(layoutReadOnlyFrames(items));
    measureReadOnlyLayout();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureReadOnlyLayout);
    if (stageRef.current) observer.observe(stageRef.current);
    for (const item of items) {
      const node = contentRefs.current[item.id];
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [editable, items, measureReadOnlyLayout]);

  // Ve čtecím zobrazení zůstává volná plocha vždy přes celou šířku a prodlouží
  // se až k poslední kartě po započtení skutečné výšky zalomeného obsahu.
  const readOnlyVerticalExtent = editable ? 100 : readOnlyLayout.extent;

  /** Dvojklik na spodní pruh: výška karty podle skutečného obsahu. */
  const fitHeight = (item: FreeFrameItem) => {
    if (!onChangeFrame || !stageRef.current) return;
    const node = contentRefs.current[item.id];
    if (!node) return;
    const canvasH = stageRef.current.getBoundingClientRect().height;
    if (!canvasH) return;
    const needed = node.scrollHeight + 12;
    // Karta smí přesáhnout spodní okraj plátna – ať se do ní vejde celý obsah.
    const h = Math.max(5, (needed / canvasH) * 100);
    onChangeFrame(item.id, { ...item.frame, h });
  };

  const startDrag = useCallback(
    (e: React.PointerEvent, item: FreeFrameItem, handle: FrameHandle) => {
      if (!onChangeFrame || !stageRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = stageRef.current.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startFrame = item.frame;
      const others = items.filter((x) => x.id !== item.id).map((x) => x.frame);
      const pointerId = e.pointerId;
      const target = e.currentTarget as HTMLElement;
      onSelect?.(item.id);

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        const raw = applyFrameDrag(startFrame, handle, dx, dy);
        if (ev.altKey) {
          setGuides(null);
          onChangeFrame(item.id, snapFrameToGrid(raw, handle, 1));
          return;
        }
        const snapped = snapFrame(raw, handle, others);
        setGuides(snapped.guides.v.length || snapped.guides.h.length ? snapped.guides : null);
        onChangeFrame(item.id, snapped.frame);
      };
      const finish = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        setGuides(null);
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", finish);
        target.removeEventListener("pointercancel", finish);
        if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
      };
      target.setPointerCapture?.(pointerId);
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", finish);
      target.addEventListener("pointercancel", finish);
    },
    [items, onChangeFrame, onSelect],
  );

  return (
    <div
      ref={stageRef}
      data-free-frame-canvas="true"
      onPointerDown={() => onSelect?.(null)}
      className={`relative w-full rounded-[10px] ${editable ? "aspect-video" : ""} ${
        // V editoru nesmíme ořezávat: karta zasahující pod spodní okraj plátna
        // by měla neviditelný (a nekliknutelný) pruh pro tažení výšky.
        editable ? "overflow-visible bg-[#FAFAFA] border border-dashed border-border" : "overflow-hidden"
      } ${className}`}
      style={!editable ? { aspectRatio: `16 / ${9 * (readOnlyVerticalExtent / 100)}` } : undefined}
    >
      <div className="absolute inset-0" data-free-vertical-extent={readOnlyVerticalExtent}>
        {items.map((item) => {
          const active = selectedId === item.id;
          const displayFrame = editable ? item.frame : readOnlyLayout.frames[item.id] ?? item.frame;
          return (
            <div
              key={item.id}
              data-free-frame-item={item.id}
              className={`absolute ${editable ? "rounded-md" : ""} ${
                editable
                  ? active
                    ? "ring-2 ring-primary"
                    : "ring-1 ring-border hover:ring-primary/50"
                  : ""
              }`}
              style={{
                left: `${displayFrame.x}%`,
                top: `${(displayFrame.y / readOnlyVerticalExtent) * 100}%`,
                width: `${displayFrame.w}%`,
                height: `${(displayFrame.h / readOnlyVerticalExtent) * 100}%`,
              }}
              onPointerDown={editable ? (e) => startDrag(e, item, "move") : undefined}
            >
              <div
                ref={(node) => {
                  contentRefs.current[item.id] = node;
                }}
                className={`${editable ? "h-full overflow-hidden p-1.5" : "overflow-visible"} w-full`}
              >
                {item.node}
              </div>
              {editable &&
                HANDLES.filter((h) => !(heightBar && h.handle === "s")).map((h) => (
                  <div
                    key={h.handle}
                    role="presentation"
                    aria-label={`Změnit velikost ${h.handle}`}
                    data-frame-handle={h.handle}
                    onPointerDown={(e) => startDrag(e, item, h.handle)}
                    className={`absolute h-2.5 w-2.5 rounded-sm border border-primary bg-white ${h.className} ${
                      active ? "opacity-100" : "opacity-0 hover:opacity-100"
                    }`}
                    style={{ cursor: h.cursor }}
                  />
                ))}
              {editable && heightBar && (
                <div
                  role="separator"
                  aria-label="Změnit výšku karty"
                  title="Tažením změníte výšku karty, dvojklikem ji přizpůsobíte obsahu"
                  data-frame-handle="s"
                  onPointerDown={(e) => startDrag(e, item, "s")}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    fitHeight(item);
                  }}
                  className="absolute bottom-0 left-0 right-0 flex h-3 cursor-ns-resize items-center justify-center rounded-b-md bg-primary/5 hover:bg-primary/15"
                >
                  <span className="h-1 w-8 rounded-full bg-primary/50" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && guides?.v.map((v) => (
        <div key={`v${v}`} className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary" style={{ left: `${v}%` }} />
      ))}
      {editable && guides?.h.map((h) => (
        <div key={`h${h}`} className="pointer-events-none absolute left-0 right-0 h-px bg-primary" style={{ top: `${h}%` }} />
      ))}
    </div>
  );
};

export default FreeFrameCanvas;
