import { useRef, useState } from "react";
import { STAGE_W, STAGE_H } from "@/lib/slide-stage";

export interface DrawingStroke {
  path: string;
  color: string;
  width: number;
}

interface Props {
  strokes?: DrawingStroke[];
  /** Zapnutý režim kreslení (jen v editoru). */
  drawMode?: boolean;
  drawColor?: string;
  drawWidth?: number;
  onAddStroke?: (stroke: DrawingStroke) => void;
}

export function normalizeStrokes(value: any): DrawingStroke[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s) => s && typeof s.path === "string" && s.path.length > 0)
    .map((s) => ({
      path: s.path as string,
      color: typeof s.color === "string" ? s.color : "#FFFFFF",
      width: Number(s.width) > 0 ? Number(s.width) : 3,
    }));
}

/**
 * SVG vrstva ručních tahů (tužka) nad obsahem slidu.
 * Souřadnice jsou v soustavě stage 1600×900, takže tahy drží pozici
 * při jakémkoli zvětšení plátna (editor, projekce, náhled).
 */
const SlideDrawingLayer = ({
  strokes,
  drawMode,
  drawColor = "#FFFFFF",
  drawWidth = 3,
  onAddStroke,
}: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const drawing = useRef(false);
  const pathRef = useRef<string>("");

  const saved = normalizeStrokes(strokes);
  if (!drawMode && saved.length === 0) return null;

  const toStage = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * STAGE_W),
      y: Math.round(((clientY - rect.top) / rect.height) * STAGE_H),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return;
    const p = toStage(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    pathRef.current = `M ${p.x} ${p.y}`;
    setCurrent(pathRef.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawMode || !drawing.current) return;
    const p = toStage(e.clientX, e.clientY);
    if (!p) return;
    pathRef.current = `${pathRef.current} L ${p.x} ${p.y}`;
    setCurrent(pathRef.current);
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const path = pathRef.current;
    pathRef.current = "";
    setCurrent(null);
    if (path.includes("L")) onAddStroke?.({ path, color: drawColor, width: drawWidth });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${drawMode ? "z-20 cursor-crosshair" : "pointer-events-none"}`}
      data-slide-drawing-layer="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerLeave={finish}
      onPointerCancel={finish}
    >
      {saved.map((s, i) => (
        <path
          key={i}
          d={s.path}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {current && (
        <path
          d={current}
          fill="none"
          stroke={drawColor}
          strokeWidth={drawWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

export default SlideDrawingLayer;
