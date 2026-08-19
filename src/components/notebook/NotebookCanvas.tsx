import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil, Highlighter, Eraser, Type as TypeIcon, Square, CircleIcon,
  ArrowUpRight, Undo2, Redo2, Trash2, MousePointer2, ImagePlus, Bold, Italic, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BackgroundStyle, NB_H, NB_W, NOTEBOOK_COLORS, NOTEBOOK_WIDTHS, NotebookImage,
  NotebookPageContent, NotebookTextBox, NotebookTool, Stroke,
  backgroundCss, renderStroke, signNotebookImages, uploadNotebookImage,
} from "@/lib/notebook";

interface Props {
  ownerId: string;
  content: NotebookPageContent;
  backgroundStyle: BackgroundStyle;
  onChange: (next: NotebookPageContent) => void;
  readOnly?: boolean;
}

type Mode = "select" | NotebookTool;

const TOOLS: { key: Mode; icon: React.ElementType; label: string }[] = [
  { key: "select", icon: MousePointer2, label: "Výběr a posun prvků" },
  { key: "pen", icon: Pencil, label: "Pero" },
  { key: "highlight", icon: Highlighter, label: "Zvýrazňovač" },
  { key: "eraser", icon: Eraser, label: "Guma" },
  { key: "text", icon: TypeIcon, label: "Textový box" },
  { key: "rect", icon: Square, label: "Obdélník" },
  { key: "circle", icon: CircleIcon, label: "Kruh" },
  { key: "arrow", icon: ArrowUpRight, label: "Šipka" },
];

const uid = () => crypto.randomUUID();

const NotebookCanvas = ({ ownerId, content, backgroundStyle, onChange, readOnly = false }: Props) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  /** Čas posledního doteku pera — slouží k jednoduchému palm rejection. */
  const lastPenAtRef = useRef(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const [mode, setMode] = useState<Mode>("pen");
  const [color, setColor] = useState(NOTEBOOK_COLORS[0]);
  const [width, setWidth] = useState(NOTEBOOK_WIDTHS[1]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const strokes = content.strokes;
  const textBoxes = content.textBoxes;
  const images = content.images;

  const selectedTextBox = useMemo(
    () => textBoxes.find((t) => t.id === selectedId) ?? null,
    [textBoxes, selectedId],
  );

  /* --- podepsané URL obrázků --- */
  const imagePaths = useMemo(() => images.map((i) => i.path).join("|"), [images]);
  useEffect(() => {
    const paths = imagePaths ? imagePaths.split("|") : [];
    const missing = paths.filter((p) => p && !imageUrls[p]);
    if (missing.length === 0) return;
    signNotebookImages(missing).then((m) => setImageUrls((prev) => ({ ...prev, ...m })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePaths]);

  /* --- velikost plátna --- */
  useEffect(() => {
    const cvs = canvasRef.current;
    const stage = stageRef.current;
    if (!cvs || !stage) return;
    const resize = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(w * dpr));
      cvs.height = Math.max(1, Math.floor(h * dpr));
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      cvs.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      rerender();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [rerender]);

  /* --- vykreslení kresby --- */
  useEffect(() => {
    const cvs = canvasRef.current;
    const stage = stageRef.current;
    if (!cvs || !stage) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (const s of strokes) renderStroke(ctx, s, w, h);
    if (drawingRef.current) renderStroke(ctx, drawingRef.current, w, h);
  });

  const patch = useCallback(
    (next: Partial<NotebookPageContent>) => onChange({ ...content, ...next }),
    [content, onChange],
  );

  const relative = (e: React.PointerEvent | PointerEvent): [number, number] => {
    const stage = stageRef.current;
    if (!stage) return [0, 0];
    const r = stage.getBoundingClientRect();
    const x = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    const y = r.height > 0 ? (e.clientY - r.top) / r.height : 0;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  };

  /** Tlak 0..1 — jen pero dává použitelné hodnoty, jinak konstanta jako dosud. */
  const pressureOf = (e: React.PointerEvent | PointerEvent): number => {
    if (e.pointerType !== "pen") return 0.5;
    const p = typeof e.pressure === "number" ? e.pressure : 0;
    if (p <= 0) return 0.5; // pero se jen vznáší / ovladač tlak neposílá
    return Math.max(0.05, Math.min(1, p));
  };

  /** Palm rejection: pokud se právě kreslilo perem, ignoruj souběžný dotyk. */
  const shouldIgnorePointer = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") {
      lastPenAtRef.current = Date.now();
      return false;
    }
    return e.pointerType === "touch" && Date.now() - lastPenAtRef.current < 1000;
  };

  /* --- kreslení --- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly || mode === "select") return;
    if (shouldIgnorePointer(e)) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = relative(e);

    if (mode === "text") {
      const box: NotebookTextBox = {
        id: uid(),
        x: Math.min(p[0], 0.8), y: Math.min(p[1], 0.92),
        w: 0.3, h: 0.08,
        text: "Nový text",
        color,
        fontSize: 32,
      };
      patch({ textBoxes: [...textBoxes, box] });
      setSelectedId(box.id);
      setMode("select");
      return;
    }

    drawingRef.current = {
      id: uid(),
      tool: mode,
      color: mode === "eraser" ? "#000000" : color,
      width,
      points: [p],
      pressures: [pressureOf(e)],
    };
    rerender();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (readOnly || !drawingRef.current) return;
    if (shouldIgnorePointer(e)) return;
    const cur = drawingRef.current;

    if (cur.tool === "rect" || cur.tool === "circle" || cur.tool === "arrow") {
      cur.points = [cur.points[0], relative(e)];
      cur.pressures = [cur.pressures?.[0] ?? 0.5, pressureOf(e)];
      rerender();
      return;
    }

    // Pero posílá vzorky rychleji než rAF prohlížeče — vyzvedni i sloučené eventy,
    // ať se při rychlém tahu nezahazují body.
    const native = e.nativeEvent;
    const samples: PointerEvent[] =
      typeof native.getCoalescedEvents === "function"
        ? (native.getCoalescedEvents() as PointerEvent[])
        : [];
    const events = samples.length > 0 ? samples : [native];

    for (const ev of events) {
      cur.points.push(relative(ev));
      (cur.pressures ??= []).push(pressureOf(ev));
    }
    rerender();
  };


  const finishStroke = () => {
    const s = drawingRef.current;
    drawingRef.current = null;
    if (!s) return;
    if (s.points.length < 2 && s.tool !== "text") return rerender();
    setRedoStack([]);
    patch({ strokes: [...strokes, s] });
  };

  const undo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStack((r) => [...r, last]);
    patch({ strokes: strokes.slice(0, -1) });
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const s = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    patch({ strokes: [...strokes, s] });
  };

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA"].includes(t.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* --- posun / změna velikosti prvků --- */
  const startElementDrag = (
    e: React.PointerEvent,
    kind: "text" | "image",
    id: string,
    action: "move" | "resize",
  ) => {
    if (readOnly || mode !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const list: any[] = kind === "text" ? textBoxes : images;
    const item = list.find((i) => i.id === id);
    if (!item) return;
    const base = { x: item.x, y: item.y, w: item.w, h: item.h };

    const apply = (dx: number, dy: number) => {
      const next = { ...base };
      if (action === "move") {
        next.x = Math.max(0, Math.min(1 - base.w, base.x + dx / r.width));
        next.y = Math.max(0, Math.min(1 - base.h, base.y + dy / r.height));
      } else {
        next.w = Math.max(0.05, Math.min(1 - base.x, base.w + dx / r.width));
        next.h = Math.max(0.03, Math.min(1 - base.y, base.h + dy / r.height));
      }
      if (kind === "text") {
        onChange({ ...content, textBoxes: textBoxes.map((t) => (t.id === id ? { ...t, ...next } : t)) });
      } else {
        onChange({ ...content, images: images.map((i) => (i.id === id ? { ...i, ...next } : i)) });
      }
    };

    const onMove = (ev: PointerEvent) => apply(ev.clientX - startX, ev.clientY - startY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const updateTextBox = (id: string, p: Partial<NotebookTextBox>) =>
    patch({ textBoxes: textBoxes.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  const removeSelected = () => {
    if (!selectedId) return;
    patch({
      textBoxes: textBoxes.filter((t) => t.id !== selectedId),
      images: images.filter((i) => i.id !== selectedId),
    });
    setSelectedId(null);
  };

  /* --- obrázky --- */
  const onPickImage = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Obrázek může mít max. 10 MB.");
    setUploading(true);
    try {
      const path = await uploadNotebookImage(ownerId, file);
      const img: NotebookImage = { id: uid(), path, x: 0.1, y: 0.1, w: 0.5, h: 0.3 };
      patch({ images: [...images, img] });
      setSelectedId(img.id);
      setMode("select");
      toast.success("Obrázek vložen. Kreslit můžeš přímo na něj.");
    } catch (e: any) {
      toast.error(e.message || "Nahrání obrázku se nepodařilo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearPage = () => {
    if (!window.confirm("Smazat celý obsah stránky?")) return;
    onChange({ strokes: [], textBoxes: [], images: [] });
    setSelectedId(null);
    setRedoStack([]);
  };

  const drawingActive = mode !== "select";

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.key}
                  type="button"
                  size="icon"
                  variant={mode === t.key ? "default" : "outline"}
                  title={t.label}
                  aria-label={t.label}
                  aria-pressed={mode === t.key}
                  onClick={() => setMode(t.key)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>

          <span className="h-6 w-px bg-border" aria-hidden />

          <div className="flex items-center gap-1">
            {NOTEBOOK_WIDTHS.map((w) => (
              <Button
                key={w}
                type="button"
                size="sm"
                variant={width === w ? "default" : "outline"}
                title={`Tloušťka ${w}`}
                onClick={() => setWidth(w)}
              >
                <span className="rounded-full bg-current" style={{ width: w, height: w }} />
              </Button>
            ))}
          </div>

          <span className="h-6 w-px bg-border" aria-hidden />

          <div className="flex items-center gap-1.5">
            {NOTEBOOK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Barva ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform",
                  color === c ? "border-foreground scale-110" : "border-border hover:scale-105",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Vlastní barva"
              aria-label="Vlastní barva"
              className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0.5"
            />
          </div>

          <span className="h-6 w-px bg-border" aria-hidden />

          <Button type="button" size="icon" variant="outline" title="Zpět" onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" title="Vpřed" onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" /> {uploading ? "Nahrávám…" : "Obrázek"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
          />
          <Button type="button" size="icon" variant="outline" title="Smazat obsah stránky" onClick={clearPage}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!readOnly && selectedTextBox && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
          <Textarea
            rows={2}
            className="min-w-[200px] flex-1 bg-background"
            value={selectedTextBox.text}
            onChange={(e) => updateTextBox(selectedTextBox.id, { text: e.target.value })}
            aria-label="Text vybraného boxu"
          />
          <Button
            type="button" size="icon"
            variant={selectedTextBox.bold ? "default" : "outline"}
            title="Tučně"
            onClick={() => updateTextBox(selectedTextBox.id, { bold: !selectedTextBox.bold })}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button" size="icon"
            variant={selectedTextBox.italic ? "default" : "outline"}
            title="Kurzíva"
            onClick={() => updateTextBox(selectedTextBox.id, { italic: !selectedTextBox.italic })}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Input
            type="number" min={12} max={120}
            className="w-20 bg-background"
            value={selectedTextBox.fontSize}
            onChange={(e) => updateTextBox(selectedTextBox.id, { fontSize: Number(e.target.value) || 32 })}
            aria-label="Velikost písma"
          />
          <input
            type="color"
            value={selectedTextBox.color}
            onChange={(e) => updateTextBox(selectedTextBox.id, { color: e.target.value })}
            title="Barva textu"
            aria-label="Barva textu"
            className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
          />
          <Button type="button" size="icon" variant="outline" title="Odebrat prvek" onClick={removeSelected}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="mx-auto w-full max-w-[820px]">
        <div
          ref={stageRef}
          className="relative w-full overflow-hidden rounded-lg border bg-white shadow-sm touch-none"
          style={{ aspectRatio: `${NB_W} / ${NB_H}`, containerType: "inline-size", ...backgroundCss(backgroundStyle, 0.8) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
        >
          {/* Obrázky — pod kreslicí vrstvou, kreslit lze přímo přes ně */}
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                "absolute",
                mode === "select" ? "cursor-move" : "pointer-events-none",
                selectedId === img.id && "ring-2 ring-primary",
              )}
              style={{
                left: `${img.x * 100}%`, top: `${img.y * 100}%`,
                width: `${img.w * 100}%`, height: `${img.h * 100}%`,
              }}
              onPointerDown={(e) => startElementDrag(e, "image", img.id, "move")}
            >
              {imageUrls[img.path] ? (
                <img
                  src={imageUrls[img.path]}
                  alt="Vložený obrázek v sešitu"
                  className="h-full w-full select-none object-contain"
                  draggable={false}
                />
              ) : (
                <div className="h-full w-full animate-pulse rounded bg-muted" />
              )}
              {mode === "select" && selectedId === img.id && !readOnly && (
                <span
                  role="presentation"
                  className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-sm bg-primary"
                  onPointerDown={(e) => startElementDrag(e, "image", img.id, "resize")}
                />
              )}
            </div>
          ))}

          <canvas
            ref={canvasRef}
            className={cn("absolute inset-0", drawingActive ? "cursor-crosshair" : "pointer-events-none")}
          />

          {/* Textové boxy — nad kresbou */}
          {textBoxes.map((tb) => (
            <div
              key={tb.id}
              className={cn(
                "absolute",
                mode === "select" ? "cursor-move" : "pointer-events-none",
                selectedId === tb.id && "ring-2 ring-primary",
              )}
              style={{
                left: `${tb.x * 100}%`, top: `${tb.y * 100}%`,
                width: `${tb.w * 100}%`, minHeight: `${tb.h * 100}%`,
              }}
              onPointerDown={(e) => startElementDrag(e, "text", tb.id, "move")}
            >
              <p
                className="m-0 whitespace-pre-wrap break-words leading-snug"
                style={{
                  color: tb.color,
                  fontSize: `${(tb.fontSize / NB_W) * 100}cqw`,
                  fontWeight: tb.bold ? 700 : 400,
                  fontStyle: tb.italic ? "italic" : "normal",
                }}
              >
                {tb.text}
              </p>
              {mode === "select" && selectedId === tb.id && !readOnly && (
                <span
                  role="presentation"
                  className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-sm bg-primary"
                  onPointerDown={(e) => startElementDrag(e, "text", tb.id, "resize")}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <p className="text-center text-xs text-muted-foreground">
          Nástroj „Výběr“ slouží k posunu a změně velikosti textů a obrázků. Kreslit lze i přímo na vložený obrázek.
        </p>
      )}
    </div>
  );
};

export default NotebookCanvas;
