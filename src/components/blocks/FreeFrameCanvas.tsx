import React, { useCallback, useRef, useState } from "react";
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

  /** Dvojklik na spodní pruh: výška karty podle skutečného obsahu. */
  const fitHeight = (item: FreeFrameItem) => {
    if (!onChangeFrame || !stageRef.current) return;
    const node = contentRefs.current[item.id];
    if (!node) return;
    const canvasH = stageRef.current.getBoundingClientRect().height;
    if (!canvasH) return;
    const needed = node.scrollHeight + 12;
    const h = Math.max(5, Math.min(100 - item.frame.y, (needed / canvasH) * 100));
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
      className={`relative w-full aspect-video overflow-hidden rounded-[10px] ${
        editable ? "bg-[#FAFAFA] border border-dashed border-border" : ""
      } ${className}`}
    >
      {items.map((item) => {
        const active = selectedId === item.id;
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
              left: `${item.frame.x}%`,
              top: `${item.frame.y}%`,
              width: `${item.frame.w}%`,
              height: `${item.frame.h}%`,
            }}
            onPointerDown={editable ? (e) => startDrag(e, item, "move") : undefined}
          >
            <div className={`h-full w-full overflow-hidden ${editable ? "p-1.5" : ""}`}>
              {item.node}
            </div>
            {editable &&
              HANDLES.map((h) => (
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
          </div>
        );
      })}

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
