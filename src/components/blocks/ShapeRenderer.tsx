import type { CSSProperties } from "react";

export type ShapeKind =
  | "rectangle"
  | "rounded-rect"
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
  { value: "circle", label: "Kruh" },
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
  height = 160,
  fill,
  style,
}: Props) => {
  const sw = Math.max(0, Number(strokeWidth) || 0);
  const polyProps = { fill: fillColor, stroke: strokeColor, strokeWidth: sw };

  return (
    <svg
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      width="100%"
      height={fill ? "100%" : height}
      style={fill ? { width: "100%", height: "100%", display: "block", ...style } : style}
      role="presentation"
      aria-hidden="true"
    >
      {shapeKind === "circle" && (
        <ellipse cx={100} cy={50} rx={95 - sw} ry={45 - sw} fill={fillColor} stroke={strokeColor} strokeWidth={sw} />
      )}
      {(shapeKind === "rectangle" || shapeKind === "rounded-rect") && (
        <rect
          x={sw}
          y={sw}
          width={200 - sw * 2}
          height={100 - sw * 2}
          rx={shapeKind === "rounded-rect" ? 30 : 6}
          fill={fillColor}
          stroke={strokeColor}
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
