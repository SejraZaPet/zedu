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
  visible: boolean;
  /** strokes keyed by slide index (as string) */
  strokesBySlide?: Record<string, Stroke[]>;
  /** @deprecated legacy flat format — migrated on read to slide "0" */
  strokes?: Stroke[];
}

export interface NormalizedWhiteboard {
  visible: boolean;
  strokesBySlide: Record<string, Stroke[]>;
}

/** Accepts both the new per-slide format and the legacy flat `{ strokes, visible }`. */
export function normalizeWhiteboard(raw: any): NormalizedWhiteboard {
  const visible = !!raw?.visible;
  const bySlide = raw?.strokesBySlide;
  if (bySlide && typeof bySlide === "object" && !Array.isArray(bySlide)) {
    const out: Record<string, Stroke[]> = {};
    for (const [k, v] of Object.entries(bySlide)) if (Array.isArray(v)) out[k] = v as Stroke[];
    return { visible, strokesBySlide: out };
  }
  if (Array.isArray(raw?.strokes) && raw.strokes.length > 0) {
    // legacy: treat as belonging to the first slide
    return { visible, strokesBySlide: { "0": raw.strokes as Stroke[] } };
  }
  return { visible, strokesBySlide: {} };
}

export function getSlideStrokes(raw: any, slideIndex: number): Stroke[] {
  const key = String(Math.max(0, slideIndex ?? 0));
  return normalizeWhiteboard(raw).strokesBySlide[key] ?? [];
}

const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ffffff", "#facc15"];
const WIDTHS = [3, 6, 12];

interface Props {
  sessionId: string;
  data: WhiteboardData;
  /** index of the slide these strokes belong to (whiteboard is per-slide) */
  slideIndex: number;
  readOnly?: boolean;
  onClose?: () => void;
  /** when true, renders a transparent overlay covering its parent */
  overlay?: boolean;
  className?: string;
  /** when true, strokes are kept only in local state (never written to DB).
   *  Remote strokes from `data.strokes` are still rendered underneath. */
  localOnly?: boolean;
  /** when true, hides advanced tools (text, shapes, undo/redo). Pen + eraser + colors + widths + clear only. */
  simplified?: boolean;
  /** guest player token (game_players.join_token) — required for students without an account */
  joinToken?: string | null;
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

const LiveWhiteboard = ({ sessionId, data, slideIndex, readOnly = false, onClose, overlay = true, className, localOnly = false, simplified = false, joinToken = null }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
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

  const remoteStrokes = useMemo(() => getSlideStrokes(data, slideIndex), [data, slideIndex]);

  // Per-slide isolation: drop optimistic/redo state when the slide changes
  useEffect(() => {
    setPendingStrokes([]);
    setRedoStack([]);
  }, [slideIndex]);

  const strokes = useMemo(() => {
    if (localOnly) {
      // In local-only mode, keep pending strokes forever; render remote UNDER local
      return [...remoteStrokes, ...pendingStrokes];
    }
    if (pendingStrokes.length === 0) return remoteStrokes;
    const remoteIds = new Set(remoteStrokes.map((s) => s.id));
    const pendingFiltered = pendingStrokes.filter((s) => !remoteIds.has(s.id));
    if (pendingFiltered.length !== pendingStrokes.length) {
      // Schedule cleanup after render
      queueMicrotask(() => setPendingStrokes(pendingFiltered));
    }
    return [...remoteStrokes, ...pendingFiltered];
  }, [remoteStrokes, pendingStrokes, localOnly]);

  useEffect(() => {
    const cvs = canvasRef.current;
    const bottom = bottomCanvasRef.current;
    const cont = containerRef.current;
    if (!cvs || !cont) return;
    const resize = () => {
      const r = cont.getBoundingClientRect();
      const logicalWidth = cont.clientWidth || Math.round(r.width);
      const logicalHeight = cont.clientHeight || Math.round(r.height);
      if (!logicalWidth || !logicalHeight) return;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [cvs, bottom]) {
        if (!c) continue;
        c.width = Math.max(1, Math.floor(logicalWidth * dpr));
        c.height = Math.max(1, Math.floor(logicalHeight * dpr));
        c.style.width = `${logicalWidth}px`;
        c.style.height = `${logicalHeight}px`;
        c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      rerender();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [rerender]);

  useEffect(() => {
    const cvs = canvasRef.current;
    const bottom = bottomCanvasRef.current;
    const cont = containerRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const w = cont?.clientWidth || cvs.clientWidth;
    const h = cont?.clientHeight || cvs.clientHeight;

    if (localOnly) {
      // Bottom: remote strokes only (never affected by student eraser)
      const bctx = bottom?.getContext("2d");
      if (bctx) {
        bctx.clearRect(0, 0, w, h);
        for (const s of remoteStrokes) renderStroke(bctx, s, w, h);
      }
      // Top: student's own local strokes + in-progress
      ctx.clearRect(0, 0, w, h);
      for (const s of pendingStrokes) renderStroke(ctx, s, w, h);
      if (drawingRef.current) renderStroke(ctx, drawingRef.current, w, h);
    } else {
      // Original single-canvas behavior; keep bottom cleared
      const bctx = bottom?.getContext("2d");
      bctx?.clearRect(0, 0, w, h);
      ctx.clearRect(0, 0, w, h);
      for (const s of strokes) renderStroke(ctx, s, w, h);
      if (drawingRef.current) renderStroke(ctx, drawingRef.current, w, h);
    }
  });

  /** Atomically replaces strokes for the CURRENT slide only. The database
   *  preserves visibility and every other slide, including during concurrent toggles. */
  const persistSlideStrokes = useCallback(async (next: Stroke[]) => {
    // Serialize writes to avoid out-of-order DB updates
    const prev = pendingPersistRef.current ?? Promise.resolve();
    const key = String(Math.max(0, slideIndex ?? 0));
    const p = prev.then(async () => {
      await supabase.rpc("set_game_whiteboard_slide_strokes" as any, {
        _session_id: sessionId,
        _slide_index: Number(key),
        _strokes: next as any,
        _join_token: joinToken || null,
      });
    });
    pendingPersistRef.current = p;
    return p;
  }, [sessionId, slideIndex, joinToken]);


  const commitStrokes = useCallback((next: Stroke[]) => {
    if (localOnly) {
      // Keep only strokes not in remote (i.e. the local ones)
      const remoteIds = new Set(remoteStrokes.map((s) => s.id));
      setPendingStrokes(next.filter((s) => !remoteIds.has(s.id)));
      return;
    }
    persistSlideStrokes(next);
  }, [persistSlideStrokes, localOnly, remoteStrokes]);

  const getRelative = (e: PointerEvent | React.PointerEvent): [number, number] => {
    // Měříme přímo z canvas elementu, ne z obalového containeru — na mobilech
    // s vysokým devicePixelRatio a transform:scale mohou být rozměry
    // containeru zaokrouhleny jinak než skutečné plátno, což způsobuje posun.
    const cvs = canvasRef.current ?? containerRef.current;
    if (!cvs) return [0, 0];
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
    if (readOnly) return;
    if (localOnly) {
      if (pendingStrokes.length === 0) return;
      const last = pendingStrokes[pendingStrokes.length - 1];
      setRedoStack((r) => [...r, last]);
      setPendingStrokes((p) => p.slice(0, -1));
      return;
    }
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStack((r) => [...r, last]);
    commitStrokes(strokes.slice(0, -1));
  }, [readOnly, strokes, commitStrokes, localOnly, pendingStrokes]);

  const redo = useCallback(() => {
    if (readOnly || redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    if (localOnly) {
      setPendingStrokes((p) => [...p, last]);
      return;
    }
    commitStrokes([...strokes, last]);
  }, [readOnly, redoStack, strokes, commitStrokes, localOnly]);

  const clearAll = () => {
    if (readOnly) return;
    if (localOnly) {
      if (pendingStrokes.length && !window.confirm("Vymazat svoje kresby?")) return;
      setRedoStack([]);
      setPendingStrokes([]);
      return;
    }
    if (strokes.length && !window.confirm("Vymazat kresby na tomto slidu?")) return;
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

  const tools: { id: WhiteboardTool; icon: any; label: string }[] = useMemo(() => {
    const all = [
      { id: "pen" as WhiteboardTool, icon: Pencil, label: "Tužka" },
      { id: "highlight" as WhiteboardTool, icon: Highlighter, label: "Zvýrazňovač" },
      { id: "eraser" as WhiteboardTool, icon: Eraser, label: "Guma" },
      { id: "text" as WhiteboardTool, icon: TypeIcon, label: "Text" },
      { id: "rect" as WhiteboardTool, icon: Square, label: "Obdélník" },
      { id: "circle" as WhiteboardTool, icon: CircleIcon, label: "Kruh" },
      { id: "arrow" as WhiteboardTool, icon: ArrowUpRight, label: "Šipka" },
    ];
    return simplified ? all.filter((t) => t.id === "pen" || t.id === "eraser") : all;
  }, [simplified]);

  return (
    <div
      className={overlay ? `absolute inset-0 z-40 ${className ?? ""}`.trim() : `relative w-full h-full ${className ?? ""}`.trim()}
      style={{ pointerEvents: readOnly ? "none" : "auto" }}
    >
      {!readOnly && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/95 p-1.5 text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
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

          {!simplified && (
            <>
              <Button size="sm" variant="ghost" onClick={undo} title="Zpět (Ctrl+Z)" className="h-8 w-8 p-0">
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={redo} title="Vpřed (Ctrl+Y)" className="h-8 w-8 p-0">
                <Redo2 className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={clearAll} title="Vymazat vše" className="h-8 w-8 p-0 text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>

          {onClose && (
            <>
              <div className="h-6 w-px bg-border mx-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={onClose}
                className="h-8 gap-1 border-border bg-background text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" /> Skrýt tabuli
              </Button>
            </>
          )}
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={bottomCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ background: "transparent" }}
          aria-hidden
        />
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
    </div>
  );
};

export default LiveWhiteboard;
