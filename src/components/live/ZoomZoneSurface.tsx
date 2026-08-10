import { useRef, useState, type ReactNode } from "react";
import { clampRect, type ZoomRect, type ZoomZone } from "@/lib/zoom-zones";

interface Props {
  /** Existing zones rendered as numbered frames. */
  zones?: ZoomZone[];
  /** Enable drawing a new rectangle by dragging. */
  drawing?: boolean;
  onDraw?: (rect: ZoomRect) => void;
  onZoneClick?: (zone: ZoomZone) => void;
  activeZoneId?: string | null;
  children?: ReactNode;
  className?: string;
}

/**
 * Transparent overlay for drawing / displaying percentage-based zoom zones
 * on top of a slide preview. Coordinates are % of this surface's box.
 */
const ZoomZoneSurface = ({
  zones = [],
  drawing = false,
  onDraw,
  onZoneClick,
  activeZoneId,
  children,
  className = "",
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<ZoomRect | null>(null);

  const pointPct = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): ZoomRect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  });

  return (
    <div
      ref={ref}
      className={`absolute inset-0 ${drawing ? "cursor-crosshair touch-none" : "pointer-events-none"} ${className}`}
      onPointerDown={(e) => {
        if (!drawing) return;
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        startRef.current = pointPct(e.clientX, e.clientY);
        setDraft({ ...startRef.current, width: 0, height: 0 });
      }}
      onPointerMove={(e) => {
        if (!drawing || !startRef.current) return;
        setDraft(rectFrom(startRef.current, pointPct(e.clientX, e.clientY)));
      }}
      onPointerUp={(e) => {
        if (!drawing || !startRef.current) return;
        const rect = rectFrom(startRef.current, pointPct(e.clientX, e.clientY));
        startRef.current = null;
        setDraft(null);
        if (rect.width < 3 || rect.height < 3) return;
        onDraw?.(clampRect(rect));
      }}
    >
      {children}

      {zones.map((z, i) => {
        const active = activeZoneId === z.id;
        return (
          <button
            key={z.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onZoneClick?.(z);
            }}
            className={`absolute rounded-md border-2 text-left transition-colors ${
              onZoneClick && !drawing ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
            } ${active ? "border-primary bg-primary/20" : "border-primary/70 bg-primary/10 hover:bg-primary/20"}`}
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.width}%`, height: `${z.height}%` }}
          >
            <span className="absolute -top-2 -left-2 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow">
              {i + 1}
            </span>
            {z.label && (
              <span className="absolute bottom-0 left-0 right-0 truncate bg-primary/80 px-1 py-0.5 text-[10px] text-primary-foreground">
                {z.label}
              </span>
            )}
          </button>
        );
      })}

      {draft && draft.width > 0 && (
        <div
          className="absolute rounded-md border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
          style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.width}%`, height: `${draft.height}%` }}
        />
      )}
    </div>
  );
};

export default ZoomZoneSurface;
