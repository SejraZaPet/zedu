import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Pencil, Highlighter, Eraser, Type as TypeIcon, Square, CircleIcon,
  ArrowUpRight, Undo2, Redo2, Trash2, X,
} from "lucide-react";

export type WhiteboardTool = "pen" | "highlight" | "eraser" | "text" | "rect" | "circle" | "arrow";

export interface Stroke {
  id: string;
  tool: WhiteboardTool;
  color: string;
  width: number;
  points: [number, number][]; // 0..1 relative coords
  text?: string;
}

export interface WhiteboardData {
  strokes: Stroke[];
  visible: boolean;
}

const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ffffff", "#facc15"];
const WIDTHS = [3, 6, 12];

interface Props {
  sessionId: string;
  data: WhiteboardData;
  readOnly?: boolean;
  onClose?: () => void;
  /** when true, renders a transparent overlay covering its parent */
  overlay?: boolean;
  className?: string;
}

const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(10, ctx.lineWidth * 3);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
};

const renderStroke = (ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) => {
  if (s.points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.width;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;

  if (s.tool === "highlight") {
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = s.width * 3;
  } else if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = s.width * 4;
  }

  const pts = s.points.map(([x, y]) => [x * w, y * h] as [number, number]);

  if (s.tool === "pen" || s.tool === "highlight" || s.tool === "eraser") {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  } else if (s.tool === "rect" && pts.length >= 2) {
    const [x1, y1] = pts[0];
    const [x2, y2] = pts[pts.length - 1];
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (s.tool === "circle" && pts.length >= 2) {
    const [x1, y1] = pts[0];
    const [x2, y2] = pts[pts.length - 1];
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.tool === "arrow" && pts.length >= 2) {
    drawArrow(ctx, pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
  } else if (s.tool === "text" && s.text) {
    const size = Math.max(16, s.width * 6);
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(s.text, pts[0][0], pts[0][1]);
  }
  ctx.restore();
};

const LiveWhiteboard = ({ sessionId, data, readOnly = false, onClose, overlay = true, className }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const [tool, setTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(WIDTHS[1]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  // Optimistic local strokes — shown immediately, dropped once they appear in `data.strokes`
  const [pendingStrokes, setPendingStrokes] = useState<Stroke[]>([]);
  const pendingPersistRef = useRef<Promise<void> | null>(null);

  const remoteStrokes = data.strokes ?? [];
  const strokes = useMemo(() => {
    if (pendingStrokes.length === 0) return remoteStrokes;
    const remoteIds = new Set(remoteStrokes.map((s) => s.id));
    const pendingFiltered = pendingStrokes.filter((s) => !remoteIds.has(s.id));
    if (pendingFiltered.length !== pendingStrokes.length) {
      // Schedule cleanup after render
      queueMicrotask(() => setPendingStrokes(pendingFiltered));
    }
    return [...remoteStrokes, ...pendingFiltered];
  }, [remoteStrokes, pendingStrokes]);

  useEffect(() => {
    const cvs = canvasRef.current;
    const cont = containerRef.current;
    if (!cvs || !cont) return;
    const resize = () => {
      const r = cont.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(r.width * dpr));
      cvs.height = Math.max(1, Math.floor(r.height * dpr));
      cvs.style.width = `${r.width}px`;
      cvs.style.height = `${r.height}px`;
      const ctx = cvs.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      rerender();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [rerender]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (const s of strokes) renderStroke(ctx, s, w, h);
    if (drawingRef.current) renderStroke(ctx, drawingRef.current, w, h);
  });

  const persist = useCallback(async (next: WhiteboardData) => {
    // Serialize writes to avoid out-of-order DB updates
    const prev = pendingPersistRef.current ?? Promise.resolve();
    const p = prev.then(async () => {
      await supabase
        .from("game_sessions")
        .update({ whiteboard_data: next as any })
        .eq("id", sessionId);
    });
    pendingPersistRef.current = p;
    return p;
  }, [sessionId]);

  const commitStrokes = useCallback((next: Stroke[]) => {
    persist({ strokes: next, visible: data.visible });
  }, [persist, data.visible]);

  const getRelative = (e: PointerEvent | React.PointerEvent): [number, number] => {
    const cvs = canvasRef.current!;
    const r = cvs.getBoundingClientRect();
    const x = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    const y = r.height > 0 ? (e.clientY - r.top) / r.height : 0;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getRelative(e);

    if (tool === "text") {
      const text = window.prompt("Text:");
      if (text && text.trim()) {
        const stroke: Stroke = {
          id: crypto.randomUUID(),
          tool: "text",
          color, width,
          points: [p],
          text: text.trim(),
        };
        const next = [...strokes, stroke];
        setRedoStack([]);
        commitStrokes(next);
      }
      return;
    }

    drawingRef.current = {
      id: crypto.randomUUID(),
      tool,
      color: tool === "eraser" ? "#000" : color,
      width,
      points: [p],
    };
    rerender();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (readOnly || !drawingRef.current) return;
    const p = getRelative(e);
    const cur = drawingRef.current;
    if (cur.tool === "rect" || cur.tool === "circle" || cur.tool === "arrow") {
      cur.points = [cur.points[0], p];
    } else {
      cur.points.push(p);
    }
    rerender();
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke.points.length < 1) { rerender(); return; }
    // Optimistically show the stroke immediately
    setPendingStrokes((p) => [...p, stroke]);
    setRedoStack([]);
    // Persist in background — order is serialized via persist()
    commitStrokes([...remoteStrokes, ...pendingStrokes, stroke]);
  };

  const undo = useCallback(() => {
    if (readOnly || strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStack((r) => [...r, last]);
    commitStrokes(strokes.slice(0, -1));
  }, [readOnly, strokes, commitStrokes]);

  const redo = useCallback(() => {
    if (readOnly || redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    commitStrokes([...strokes, last]);
  }, [readOnly, redoStack, strokes, commitStrokes]);

  const clearAll = () => {
    if (readOnly) return;
    if (strokes.length && !window.confirm("Vymazat celou tabuli?")) return;
    setRedoStack([]);
    commitStrokes([]);
  };

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault(); redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, readOnly]);

  const tools: { id: WhiteboardTool; icon: any; label: string }[] = useMemo(() => [
    { id: "pen", icon: Pencil, label: "Tužka" },
    { id: "highlight", icon: Highlighter, label: "Zvýrazňovač" },
    { id: "eraser", icon: Eraser, label: "Guma" },
    { id: "text", icon: TypeIcon, label: "Text" },
    { id: "rect", icon: Square, label: "Obdélník" },
    { id: "circle", icon: CircleIcon, label: "Kruh" },
    { id: "arrow", icon: ArrowUpRight, label: "Šipka" },
  ], []);

  return (
    <div
      className={overlay ? `absolute inset-0 z-40 ${className ?? ""}`.trim() : `relative w-full h-full ${className ?? ""}`.trim()}
      style={{ pointerEvents: readOnly ? "none" : "auto" }}
    >
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={finishStroke}
          className="absolute inset-0"
          style={{
            background: "transparent",
            touchAction: "none",
            cursor: readOnly ? "default" : tool === "eraser" ? "cell" : "crosshair",
          }}
        />
      </div>

      {!readOnly && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-1 bg-card border border-border rounded-xl shadow-lg p-1.5">
          {tools.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tool === t.id ? "default" : "ghost"}
              onClick={() => setTool(t.id)}
              title={t.label}
              className="h-8 w-8 p-0"
            >
              <t.icon className="w-4 h-4" />
            </Button>
          ))}

          <div className="h-6 w-px bg-border mx-1" />

          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`h-6 w-6 rounded-full border ${color === c ? "ring-2 ring-primary ring-offset-1" : "border-border"}`}
              style={{ background: c }}
            />
          ))}

          <div className="h-6 w-px bg-border mx-1" />

          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              title={`${w}px`}
              className={`h-8 w-8 rounded flex items-center justify-center hover:bg-muted ${width === w ? "bg-muted" : ""}`}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: w + 2, height: w + 2 }}
              />
            </button>
          ))}

          <div className="h-6 w-px bg-border mx-1" />

          <Button size="sm" variant="ghost" onClick={undo} title="Zpět (Ctrl+Z)" className="h-8 w-8 p-0">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={redo} title="Vpřed (Ctrl+Y)" className="h-8 w-8 p-0">
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} title="Vymazat vše" className="h-8 w-8 p-0 text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>

          {onClose && (
            <>
              <div className="h-6 w-px bg-border mx-1" />
              <Button size="sm" variant="outline" onClick={onClose} className="h-8 gap-1">
                <X className="w-4 h-4" /> Skrýt tabuli
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveWhiteboard;
