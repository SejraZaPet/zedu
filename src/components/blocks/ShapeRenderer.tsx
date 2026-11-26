import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { resolveCornerRadiusPx } from "@/lib/shape-corner-radius";
import { normalizeGradient, type SlideGradient } from "@/lib/slide-gradient";

export type ShapeKind =
  | "rectangle"
  | "rounded-rect"
  | "pill"
  | "circle"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "star"
  | "line"
  | "arrow";

export const SHAPE_KINDS: { value: ShapeKind; label: string }[] = [
  { value: "rectangle", label: "Čtyřúhelník" },
  { value: "rounded-rect", label: "Zaoblený obdélník" },
  { value: "pill", label: "Pilulka" },
  { value: "circle", label: "Kruh / elipsa" },
  { value: "triangle", label: "Trojúhelník" },
  { value: "diamond", label: "Kosočtverec" },
  { value: "pentagon", label: "Pětiúhelník" },
  { value: "star", label: "Hvězda" },
  { value: "line", label: "Linka" },
  { value: "arrow", label: "Šipka" },
];

interface Props {
  shapeKind?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  /** Barevný přechod výplně; má přednost před `fillColor`. */
  fillGradient?: SlideGradient | null;
  fillOpacity?: number;
  strokeOpacity?: number;
  /** Poloměr rohů v jednotkách SVG viewBoxu (0–50). */
  borderRadius?: number;
  /** Poloměr rohů v px slidu, nezávislý na velikosti tvaru (má přednost). */
  cornerRadiusPx?: number | null;
  /** Výška vykreslené plochy v px. */
  height?: number;
  /** Vyplnit celý rodičovský box (100 % × 100 %) – pro volně umístěné tvary. */
  fill?: boolean;
  style?: CSSProperties;
}

/** Body pravidelného n-úhelníku v soustavě 0..200 × 0..100. */
function polygonPoints(sides: number, rotationDeg = -90): string {
  const cx = 100;
  const cy = 50;
  const rx = 95;
  const ry = 47;
  const rot = (rotationDeg * Math.PI) / 180;
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / sides;
    return `${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/** Body pěticípé hvězdy. */
function starPoints(): string {
  const cx = 100;
  const cy = 50;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const outer = i % 2 === 0;
    const rx = outer ? 95 : 40;
    const ry = outer ? 47 : 20;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Jednoduchý dekorativní tvar vykreslený jako SVG. */
const ShapeRenderer = ({
  shapeKind = "rectangle",
  fillColor = "#6EC6D9",
  strokeColor = "#9B6CFF",
  strokeWidth = 2,
  fillGradient,
  fillOpacity,
  strokeOpacity,
  borderRadius,
  cornerRadiusPx,
  height = 160,
  fill,
  style,
}: Props) => {
  const sw = Math.max(0, Number(strokeWidth) || 0);
  const gradient = normalizeGradient(fillGradient);
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientId = `shape-grad-${rawId}`;
  // Směr přechodu jako souřadnice SVG (podpora nejběžnějších hodnot z UI).
  const dir = gradient?.direction || "135deg";
  const coords =
    dir === "to right"
      ? { x1: "0%", y1: "0%", x2: "100%", y2: "0%" }
      : dir === "to left"
        ? { x1: "100%", y1: "0%", x2: "0%", y2: "0%" }
        : dir === "to bottom"
          ? { x1: "0%", y1: "0%", x2: "0%", y2: "100%" }
          : dir === "to top"
            ? { x1: "0%", y1: "100%", x2: "0%", y2: "0%" }
            : dir === "45deg"
              ? { x1: "0%", y1: "100%", x2: "100%", y2: "0%" }
              : { x1: "0%", y1: "0%", x2: "100%", y2: "100%" };
  const paint = gradient ? `url(#${gradientId})` : fillColor;
  const isRect = shapeKind === "rectangle" || shapeKind === "rounded-rect" || shapeKind === "pill";
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!isRect || !el) return;
    // offsetWidth/clientWidth nejsou ovlivněné CSS transform → px scény i při zoomu.
    const measure = () => {
      const w = (el as any).clientWidth || el.getBoundingClientRect().width;
      const h = (el as any).clientHeight || el.getBoundingClientRect().height;
      setSize((prev) => (w > 0 && h > 0 ? (prev && prev.w === w && prev.h === h ? prev : { w, h }) : prev));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isRect]);
  const polyProps = { fill: paint, fillOpacity, stroke: strokeColor, strokeOpacity, strokeWidth: sw };

  const vbW = isRect && size ? size.w : 200;
  const vbH = isRect && size ? size.h : 100;
  const legacyRx = shapeKind === "pill" ? 50 : shapeKind === "rounded-rect" ? Math.max(0, Math.min(50, borderRadius ?? 30)) : 6;
  const rx = isRect && size ? Math.max(0, resolveCornerRadiusPx({ shapeKind, cornerRadiusPx, borderRadius }, size.w, size.h) - sw / 2) : legacyRx;

  return (
    <svg
      ref={svgRef}
      data-shape-radius={isRect && size ? String(Math.round(rx * 100) / 100) : undefined}
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="none"
      width="100%"
      height={fill ? "100%" : height}
      style={fill ? { width: "100%", height: "100%", display: "block", ...style } : style}
      role="presentation"
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} {...coords}>
            <stop offset="0%" stopColor={gradient.from} />
            <stop offset="100%" stopColor={gradient.to} />
          </linearGradient>
        </defs>
      )}
      {shapeKind === "circle" && (
        <ellipse cx={100} cy={50} rx={95 - sw} ry={45 - sw} fill={paint} fillOpacity={fillOpacity} stroke={strokeColor} strokeOpacity={strokeOpacity} strokeWidth={sw} />
      )}
      {(shapeKind === "rectangle" || shapeKind === "rounded-rect" || shapeKind === "pill") && (
        <rect
          x={size ? sw / 2 : sw}
          y={size ? sw / 2 : sw}
          width={Math.max(0, size ? vbW - sw : 200 - sw * 2)}
          height={Math.max(0, size ? vbH - sw : 100 - sw * 2)}
          rx={rx}
          ry={rx}
          fill={paint}
          fillOpacity={fillOpacity}
          stroke={strokeColor}
          strokeOpacity={strokeOpacity}
          strokeWidth={sw}
        />
      )}
      {shapeKind === "triangle" && <polygon points="100,4 196,96 4,96" {...polyProps} />}
      {shapeKind === "diamond" && <polygon points="100,3 197,50 100,97 3,50" {...polyProps} />}
      {shapeKind === "pentagon" && <polygon points={polygonPoints(5)} {...polyProps} />}
      {shapeKind === "star" && <polygon points={starPoints()} {...polyProps} />}
      {shapeKind === "line" && (
        <line x1={4} y1={50} x2={196} y2={50} stroke={strokeColor} strokeWidth={Math.max(sw, 2)} strokeLinecap="round" />
      )}
      {shapeKind === "arrow" && (
        <>
          <defs>
            <marker id={`arrow-head-${strokeColor.replace("#", "")}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={strokeColor} />
            </marker>
          </defs>
          <line
            x1={4}
            y1={50}
            x2={180}
            y2={50}
            stroke={strokeColor}
            strokeWidth={Math.max(sw, 2)}
            strokeLinecap="round"
            markerEnd={`url(#arrow-head-${strokeColor.replace("#", "")})`}
          />
        </>
      )}
    </svg>
  );
};

export default ShapeRenderer;
