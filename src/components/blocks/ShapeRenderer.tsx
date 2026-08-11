import type { CSSProperties } from "react";

export type ShapeKind = "rectangle" | "circle" | "line" | "arrow";

export const SHAPE_KINDS: { value: ShapeKind; label: string }[] = [
  { value: "rectangle", label: "Čtyřúhelník" },
  { value: "circle", label: "Kruh" },
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
  style?: CSSProperties;
}

/** Jednoduchý dekorativní tvar vykreslený jako SVG. */
const ShapeRenderer = ({
  shapeKind = "rectangle",
  fillColor = "#6EC6D9",
  strokeColor = "#9B6CFF",
  strokeWidth = 2,
  height = 160,
  style,
}: Props) => {
  const sw = Math.max(0, Number(strokeWidth) || 0);

  return (
    <svg
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      width="100%"
      height={height}
      style={style}
      role="presentation"
      aria-hidden="true"
    >
      {shapeKind === "circle" && (
        <ellipse cx={100} cy={50} rx={95 - sw} ry={45 - sw} fill={fillColor} stroke={strokeColor} strokeWidth={sw} />
      )}
      {shapeKind === "rectangle" && (
        <rect
          x={sw}
          y={sw}
          width={200 - sw * 2}
          height={100 - sw * 2}
          rx={6}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={sw}
        />
      )}
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
