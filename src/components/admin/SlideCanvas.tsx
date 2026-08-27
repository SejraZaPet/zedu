import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowUp, ArrowDown, Trash2, ImageIcon, GripVertical, Move, Video as VideoIcon, Music } from "lucide-react";
import { LessonBlock, CALLOUT_STYLES } from "@/components/LessonBlockRenderer";
import type { Block } from "@/lib/textbook-config";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import DOMPurify from "dompurify";
import ShapeRenderer from "@/components/blocks/ShapeRenderer";
import SlideDrawingLayer, { type DrawingStroke } from "@/components/admin/SlideDrawingLayer";
import { STAGE_W, STAGE_H } from "@/lib/slide-stage";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";
import { getSlideIcon } from "@/lib/slide-icons";
import {
  applyFrameDrag,
  clampBlockFrame,
  getBlockFrame,
  type BlockFrame,
  type FrameHandle,
} from "@/lib/block-frame";

import {
  slideAnimationClass,
  slideBackgroundOverrideStyle,
  slideTextStyle,
} from "@/lib/slide-typography";

const BLOCK_PLACEHOLDER = "Klikni pro psaní…";



export type SlideLayout =
  | "full"
  | "two-cols"
  | "three-cols"
  | "img-left"
  | "img-right"
  | "title-only";

export const SLIDE_LAYOUTS: { value: SlideLayout; label: string }[] = [
  { value: "full", label: "Celá šířka" },
  { value: "two-cols", label: "Dva sloupce" },
  { value: "three-cols", label: "Tři sloupce" },
  { value: "img-left", label: "Obrázek vlevo" },
  { value: "img-right", label: "Obrázek vpravo" },
  { value: "title-only", label: "Pouze nadpis" },
];

export { STAGE_W, STAGE_H } from "@/lib/slide-stage";

interface BodyProps {
  slide: any;
  /** Vizuální téma prezentace; když chybí, bere se ze slidu. */
  themeId?: string;
  editable?: boolean;
  darkMode?: boolean;
  revealStep?: number;
  onChangeHeadline?: (v: string) => void;
  onChangeBlock?: (blockId: string, patch: Partial<Block> | ((b: Block) => Block)) => void;
  onMoveBlock?: (blockId: string, dir: "up" | "down") => void;
  onDeleteBlock?: (blockId: string) => void;
  onChangeHeroImage?: (url: string) => void;
  /** Režim kreslení tužkou nad slidem. */
  drawMode?: boolean;
  drawColor?: string;
  drawWidth?: number;
  onAddStroke?: (stroke: DrawingStroke) => void;
  /** Přesun bloku přetažením: cílem je index v rámci celého slidu. */
  onReorderBlock?: (blockId: string, toIndex: number) => void;
  /** ID právě vybraného bloku (viditelný rámeček). */
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
}

interface CanvasProps extends BodyProps {
  /** When true (default), scale stage to fit container. Otherwise renders at native 1600×900. */
  fit?: boolean;
  /** Ruční zoom nad rámec "fit" (1 = 100 % velikosti po autofitu). */
  zoom?: number;
  /** Pevné škálování (1 = 100 % skutečné velikosti). Vypíná autofit i pan/wheel zoom. */
  absoluteScale?: number | null;
  /** Posun plátna v CSS pixelech od středu. */
  pan?: { x: number; y: number };
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
}



/* ---------- Inline-editable atoms ---------- */

function EditableText({
  value,
  onCommit,
  className,
  editable,
  placeholder,
  multiline,
  html,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  editable?: boolean;
  placeholder?: string;
  multiline?: boolean;
  html?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sanitizedValue = html ? DOMPurify.sanitize(value || "") : value || "";
  const [isEmpty, setIsEmpty] = useState(() => !(html ? sanitizedValue : value));

  useEffect(() => {
    setIsEmpty(!(html ? sanitizedValue : value));
  }, [html, sanitizedValue, value]);

  const checkEmpty = useCallback(() => {
    if (!ref.current) return;
    setIsEmpty(!ref.current.innerText?.trim());
  }, []);

  if (!editable) {
    return (
      html ? (
        <div
          className={className}
          style={style}
          dangerouslySetInnerHTML={{ __html: sanitizedValue || (placeholder ? `<span class="opacity-40 italic pointer-events-none">${placeholder}</span>` : "") }}
        />
      ) : (
        <div className={className} style={{ whiteSpace: multiline ? "pre-wrap" : undefined, ...style }}>
          {value || (placeholder ? <span className="opacity-40 italic pointer-events-none">{placeholder}</span> : null)}
        </div>
      )
    );
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        style={html ? style : { whiteSpace: multiline ? "pre-wrap" : undefined, ...style }}
        onInput={checkEmpty}
        onBlur={(e) => {
          checkEmpty();
          onCommit(html ? e.currentTarget.innerHTML : e.currentTarget.innerText);
        }}
        onKeyDown={(e) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        }}
        className={`${className || ""} cursor-text rounded px-1 -mx-1 outline-none focus:ring-2 focus:ring-primary focus:bg-white/5 hover:bg-white/5 transition-colors`}
        {...(html
          ? { dangerouslySetInnerHTML: { __html: sanitizedValue } }
          : { children: value || "" })}
      />
      {isEmpty && placeholder && (
        <span className="pointer-events-none absolute left-1 top-0 text-white/30 italic text-sm select-none">
          {placeholder}
        </span>
      )}
    </div>
  );
}

function BlockShell({
  editable,
  index,
  total,
  blockId,
  selected,
  onSelect,
  onMove,
  onDelete,
  onDragStart,
  children,
}: {
  editable?: boolean;
  index: number;
  total: number;
  blockId: string;
  selected?: boolean;
  onSelect?: () => void;
  onMove?: (dir: "up" | "down") => void;
  onDelete?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}) {
  const [showFormatHint, setShowFormatHint] = useState(true);

  useEffect(() => {
    if (!selected) return;
    setShowFormatHint(true);
    const t = setTimeout(() => setShowFormatHint(false), 3000);
    return () => clearTimeout(t);
  }, [selected, blockId]);

  if (!editable) return <>{children}</>;
  return (
    <div
      data-slide-block-id={blockId}
      onMouseDown={onSelect}
      className={`group relative rounded-lg p-1 -m-1 transition-colors ${
        selected ? "ring-2 ring-primary bg-white/10" : "hover:ring-1 hover:ring-white/30 hover:bg-white/5"
      }`}

    >
      {children}
      {onDragStart && (
        <button
          type="button"
          onPointerDown={onDragStart}
          title="Přetáhnout pro změnu pořadí"
          aria-label="Přetáhnout blok"
          className="absolute -left-7 top-1 cursor-grab touch-none rounded bg-background/90 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5 text-foreground" />
        </button>
      )}
      <div className={`absolute top-1 right-1 transition-opacity flex gap-1 bg-background/90 border border-border rounded-md shadow-sm p-0.5 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove?.("up")}
          className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          title="Nahoru"
        >
          <ArrowUp className="w-3.5 h-3.5 text-foreground" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove?.("down")}
          className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          title="Dolů"
        >
          <ArrowDown className="w-3.5 h-3.5 text-foreground" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded hover:bg-destructive/10 text-destructive"
          title="Smazat"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {selected && showFormatHint && (
        <div className="absolute top-0 right-0 flex items-center gap-1 text-[10px] text-white/60 bg-white/10 px-1 py-0.5 rounded pointer-events-none select-none">
          <span>Formátování ↑</span>
        </div>
      )}
    </div>
  );
}

/** Decentní placeholder, když se obrázek slidu nepodaří načíst. */
function SlideImageFallback({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-[var(--slide-radius,0.75rem)] border border-dashed border-current/30 bg-current/5 p-4 text-center ${className}`}
    >
      <ImageIcon className="h-8 w-8 opacity-50" aria-hidden />
      <span className="text-base opacity-70">Obrázek se nepodařilo načíst</span>
    </div>
  );
}

/** Obrázek na slidu s plynulou změnou velikosti tažením za pravý dolní roh. */

function ResizableSlideImage({
  block,
  editable,
  framed,
  onChange,
}: {
  block: Block;
  editable?: boolean;
  /** Blok je volně umístěný – velikost řeší rámec, obrázek vyplní celou plochu. */
  framed?: boolean;
  onChange?: (patch: (b: Block) => Block) => void;
}) {
  const p = block.props || {};
  const [imgFailed, setImgFailed] = useState(false);
  const presetWidth = p.width === "small" ? 420 : p.width === "medium" ? 760 : 1200;
  const width: number = Number(p.widthPx) > 0 ? Number(p.widthPx) : presetWidth;
  const align = p.alignment || "center";
  const wrapperAlign = align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);


  const onPointerMove = useCallback((e: PointerEvent) => {
    const st = dragRef.current;
    if (!st || !onChange) return;
    const next = Math.max(120, Math.min(1500, st.startW + (e.clientX - st.startX)));
    onChange((b) => ({ ...b, props: { ...b.props, widthPx: Math.round(next) } }));
  }, [onChange]);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);

  // Volně umístěný obrázek vyplní celý rámec – velikost se mění výhradně
  // přes 8 úchytů rámce, takže se nikdy neuřízne kvůli dvojímu měřítku.
  if (framed) {
    const fit = p.objectFit === "cover" ? "cover" : "contain";
    return (
      <figure className="flex h-full w-full flex-col">
        {imgFailed ? (
          <SlideImageFallback className="min-h-0 w-full flex-1" />
        ) : (
          <img
            src={p.url}
            alt={p.alt || p.caption || ""}
            className="min-h-0 w-full flex-1 rounded-[var(--slide-radius,0.75rem)]"
            style={{ objectFit: fit }}
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        )}
        {p.caption && <figcaption className="mt-2 text-center text-lg opacity-70">{p.caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className={`relative ${wrapperAlign}`} style={{ width }}>
      {imgFailed ? (
        <SlideImageFallback className="aspect-video w-full" />
      ) : (
        <img
          src={p.url}
          alt={p.alt || p.caption || ""}
          className="w-full rounded-[var(--slide-radius,0.75rem)] object-contain"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
      {p.caption && <figcaption className="mt-2 text-center text-lg opacity-70">{p.caption}</figcaption>}


      {editable && (
        <span
          role="slider"
          aria-label="Změnit velikost obrázku"
          aria-valuenow={width}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const delta = e.key === "ArrowRight" ? 40 : -40;
              onChange?.((b) => ({
                ...b,
                props: { ...b.props, widthPx: Math.max(120, Math.min(1500, width + delta)) },
              }));
            }
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragRef.current = { startX: e.clientX, startW: width };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", stopDrag);
          }}
          className="absolute -bottom-2 -right-2 h-6 w-6 cursor-nwse-resize touch-none rounded-full border-2 border-primary bg-background shadow"
        />
      )}
    </figure>
  );
}

function EditableBlock({
  block,
  editable,
  asCard,
  framed,
  onChange,
}: {
  block: Block;
  editable?: boolean;
  asCard?: boolean;
  /** Blok je ve volné vrstvě (má `frame`). */
  framed?: boolean;
  onChange?: (patch: Partial<Block> | ((b: Block) => Block)) => void;
}) {
  const update = (patch: Partial<Block> | ((b: Block) => Block)) => onChange?.(patch);

  if (block.type === "paragraph") {
    const value = block.props?.text || "";
    const isHtml = /<[^>]+>/.test(value);
    return (
      <div className={asCard ? "bg-white/10 rounded-[var(--slide-radius,0.75rem)] p-4 border border-white/15" : ""}>
        <EditableText
          editable={editable}
          multiline
          html={isHtml}
          value={value}
          placeholder={BLOCK_PLACEHOLDER}
          className="text-2xl leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold"
          style={slideTextStyle(block.props)}
          onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, text: v } }))}
        />
      </div>
    );
  }

  if (block.type === "heading") {
    const level = block.props?.level || 2;
    const cls =
      level === 1 ? "text-5xl font-bold" : level === 3 ? "text-3xl font-semibold" : "text-4xl font-bold";
    const value = block.props?.text || "";
    const isHtml = /<[^>]+>/.test(value);
    return (
      <EditableText
        editable={editable}
        html={isHtml}
        value={value}
        placeholder={BLOCK_PLACEHOLDER}
        className={`${cls} [&_strong]:font-semibold`}
        style={slideTextStyle(block.props)}
        onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, text: v } }))}
      />
    );
  }

  if (block.type === "bullet_list") {
    const items: string[] = block.props?.items || [];
    const revealMode = !!block.props?.revealMode;
    const revealToggle = editable ? (
      <label className="flex items-center gap-2 text-xs text-white/70 mb-2 select-none">
        <input
          type="checkbox"
          className="h-3.5 w-3.5"
          checked={revealMode}
          onChange={(e) => update((b) => ({ ...b, props: { ...b.props, revealMode: e.target.checked } }))}
        />
        Postupné odkrývání odrážek při prezentaci
      </label>
    ) : null;
    if (block.props?.html) {
      return (
        <div className={asCard ? "bg-white/10 rounded-[var(--slide-radius,0.75rem)] p-4 border border-white/15" : ""}>
          {revealToggle}
          <EditableText
            editable={editable}
            multiline
            html
            value={block.props.html}
            placeholder={BLOCK_PLACEHOLDER}
            className="text-2xl leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2"
            style={slideTextStyle(block.props)}
            onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, html: v } }))}
          />
        </div>
      );
    }
    return (
      <div className={asCard ? "bg-white/10 rounded-[var(--slide-radius,0.75rem)] p-4 border border-white/15" : ""}>
        {revealToggle}
        <ul className="space-y-2" style={slideTextStyle(block.props)}>
          {items.length === 0 && editable && (
            <li className="flex items-start gap-3 text-2xl">
              <span className="mt-1 flex-shrink-0" style={{ color: "var(--slide-primary, currentColor)" }}>•</span>
              <EditableText
                editable={editable}
                value=""
                placeholder={BLOCK_PLACEHOLDER}
                className="flex-1"
                onCommit={(v) => {
                  if (v.trim()) update((b) => ({ ...b, props: { ...b.props, items: [v] } }));
                }}
              />
            </li>
          )}
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-2xl">
              <span className="mt-1 flex-shrink-0" style={{ color: "var(--slide-primary, currentColor)" }}>•</span>
              <div className="flex-1 flex items-center gap-2">
                <EditableText
                  editable={editable}
                  value={item}
                  placeholder={BLOCK_PLACEHOLDER}
                  className="flex-1"
                  onCommit={(v) => {
                    const next = [...items];
                    next[i] = v;
                    update((b) => ({ ...b, props: { ...b.props, items: next } }));
                  }}
                />
                {editable && items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      update((b) => ({
                        ...b,
                        props: { ...b.props, items: items.filter((_, j) => j !== i) },
                      }))
                    }
                    className="opacity-40 hover:opacity-100 text-sm"
                    title="Smazat odrážku"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
          {editable && items.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() =>
                  update((b) => ({ ...b, props: { ...b.props, items: [...items, ""] } }))
                }
                className="text-xs text-purple-300 hover:text-purple-200 ml-6"
              >
                + Přidat odrážku
              </button>
            </li>
          )}
        </ul>
      </div>
    );
  }

  if (block.type === "quote") {
    const value = block.props?.text || "";
    const isHtml = /<[^>]+>/.test(value);
    return (
      <blockquote className="border-l-4 border-primary pl-4 py-2 italic text-foreground">
        <EditableText
          editable={editable}
          multiline
          html={isHtml}
          value={value}
          placeholder={BLOCK_PLACEHOLDER}
          className="text-2xl leading-relaxed"
          style={slideTextStyle(block.props)}
          onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, text: v } }))}
        />
        {editable && (
          <EditableText
            editable={editable}
            value={block.props?.author || ""}
            placeholder="Autor citace…"
            className="mt-2 block text-sm not-italic text-muted-foreground"
            onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, author: v } }))}
          />
        )}
      </blockquote>
    );
  }

  if (block.type === "callout") {
    const value = block.props?.text || "";
    const isHtml = /<[^>]+>/.test(value);
    const kind = block.props?.calloutType || "note";
    const ct = CALLOUT_STYLES[kind] || CALLOUT_STYLES.note;
    const tone =
      kind === "tip"
        ? "bg-green-500/20 border-green-400/50"
        : kind === "warning"
          ? "bg-amber-500/20 border-amber-400/50"
          : kind === "remember"
            ? "bg-purple-500/20 border-purple-400/50"
            : "bg-blue-500/20 border-blue-400/50";
    return (
      <div className={`rounded-lg border-l-4 ${tone} p-4 flex gap-3 text-white`}>
        <span className="text-4xl flex-shrink-0 leading-none">{ct.icon}</span>
        <EditableText
          editable={editable}
          multiline
          html={isHtml}
          value={value}
          placeholder={BLOCK_PLACEHOLDER}
          className="flex-1 text-white text-2xl leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1 [&_mark]:bg-primary/30"
          style={slideTextStyle(block.props)}
          onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, text: v } }))}
        />
      </div>
    );
  }

  if (block.type === "video") {
    const url = block.props?.url;
    if (!url) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/40 p-6 text-center text-white">
          <VideoIcon className="h-12 w-12" />
          <span className="text-xl text-white/80">
            Klikněte na „Více možností“ v pravém panelu a vložte URL videa
          </span>
        </div>
      );
    }
    return (
      <figure className="w-full text-white">
        <video controls src={url} className="w-full rounded-lg" style={{ minHeight: "300px", maxHeight: "500px" }} />
        {block.props?.caption && (
          <figcaption className="mt-2 text-center text-xl text-white/80">{block.props.caption}</figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "audio") {
    const url = block.props?.url;
    if (!url) {
      return (
        <div className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/40 p-4 text-center text-white">
          <Music className="h-10 w-10" />
          <span className="text-xl text-white/80">Vložte URL zvuku v pravém panelu</span>
        </div>
      );
    }
    return (
      <figure className="w-full text-white">
        <audio controls src={url} className="w-full" style={{ minHeight: "80px", fontSize: "1.5rem" }} />
        {block.props?.caption && (
          <figcaption className="mt-2 text-center text-xl text-white/80">{block.props.caption}</figcaption>
        )}
      </figure>
    );
  }



  if (block.type === "image" && block.props?.icon && !block.props?.url) {
    const Icon = getSlideIcon(block.props.icon);
    if (Icon) {
      const align = block.props.alignment || "center";
      const size = block.props.width === "small" ? 72 : block.props.width === "medium" ? 128 : 200;
      return (
        <div
          className={asCard ? "bg-white/10 p-4 border border-white/15" : ""}
          style={asCard ? { borderRadius: "var(--slide-radius, 0.75rem)" } : undefined}
        >
          <figure
            className={align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"}
          >
            <Icon
              style={{ color: block.props.iconColor || "var(--slide-primary, currentColor)", width: size, height: size }}
              className="inline-block"
              aria-hidden={!block.props.caption}
            />
            {block.props.caption && (
              <figcaption className="text-lg opacity-70 mt-2">{block.props.caption}</figcaption>
            )}
          </figure>
        </div>
      );
    }
  }

  if (block.type === "image" && block.props?.url) {
    return (
      <div
        className={`${asCard ? "bg-white/10 p-4 border border-white/15" : ""} ${framed ? "h-full w-full" : ""}`}
        style={asCard ? { borderRadius: "var(--slide-radius, 0.75rem)" } : undefined}
      >
        <ResizableSlideImage
          block={block}
          editable={editable}
          framed={framed}
          onChange={(patch) => update(patch)}
        />
      </div>
    );
  }

  if (block.type === "table") {
    const headers: string[] = Array.isArray(block.props?.headers) ? block.props.headers : [];
    const rows: string[][] = Array.isArray(block.props?.rows) ? block.props.rows : [];
    const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1);
    const setTable = (nextHeaders: string[], nextRows: string[][]) =>
      update((b) => ({ ...b, props: { ...b.props, headers: nextHeaders, rows: nextRows } }));

    return (
      <div
        className={asCard ? "bg-white/10 p-4 border border-white/15" : ""}
        style={asCard ? { borderRadius: "var(--slide-radius, 0.75rem)" } : undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-2xl">
            {headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h, ci) => (
                    <th
                      key={ci}
                      className="border border-white/20 bg-white/20 px-3 py-2 text-left font-semibold text-white"
                    >
                      <EditableText
                        editable={editable}
                        value={h}
                        placeholder={editable ? "Záhlaví…" : undefined}
                        onCommit={(v) => {
                          const next = [...headers];
                          next[ci] = v;
                          setTable(next, rows);
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <td
                      key={ci}
                      className="border border-white/20 bg-transparent px-3 py-2 align-top text-white/90"
                    >
                      <EditableText
                        editable={editable}
                        value={row[ci] ?? ""}
                        placeholder={editable ? BLOCK_PLACEHOLDER : undefined}
                        onCommit={(v) => {
                          const nextRows = rows.map((r, j) => {
                            if (j !== ri) return r;
                            const nr = Array.from({ length: colCount }, (__, k) => r[k] ?? "");
                            nr[ci] = v;
                            return nr;
                          });
                          setTable(headers, nextRows);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="mt-2 flex gap-3" data-no-block-drag>
            <button
              type="button"
              className="text-sm text-purple-300 hover:text-purple-200"
              onClick={() =>
                setTable(headers, [...rows, Array.from({ length: colCount }, () => "")])
              }
            >
              + řádek
            </button>
            <button
              type="button"
              className="text-sm text-purple-300 hover:text-purple-200"
              onClick={() =>
                setTable(
                  headers.length > 0 ? [...headers, ""] : headers,
                  rows.map((r) => [...Array.from({ length: colCount }, (_, k) => r[k] ?? ""), ""]),
                )
              }
            >
              + sloupec
            </button>
          </div>
        )}
      </div>
    );
  }

  // Tvary vykreslujeme přímo jako SVG – ať jdou upravovat z plovoucí lišty.
  if (block.type === "shape") {
    const p = (block.props || {}) as Record<string, any>;
    return (
      <div className={framed ? "h-full w-full" : ""}>
        <ShapeRenderer
          shapeKind={p.shapeKind}
          fillColor={p.fillColor}
          strokeColor={p.strokeColor}
          strokeWidth={p.strokeWidth}
          height={Number(p.height) || 160}
          fill={framed}
        />
      </div>
    );
  }

  // Ikony jsou v datech `image` s `props.icon`.
  const needsPanelHint =
    editable && block.type === "image" && !!(block.props as any)?.icon;



  // Fallback (accordion, rovnice, video, zvuk…): use existing renderer
  return (
    <div
      className={`${asCard ? "bg-white/10 p-4 border border-white/15" : ""} ${needsPanelHint ? "group/panel relative" : ""}`}
      style={{
        fontSize: "1.5rem",
        lineHeight: 1.5,
        ...(asCard ? { borderRadius: "var(--slide-radius, 0.75rem)" } : {}),
      }}
    >
      <LessonBlock block={block} blockIndex={0} isTeacher={false} />
      {needsPanelHint && (
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-lg bg-black/50 group-hover/panel:flex">
          <span className="rounded-md bg-white/90 px-3 py-1 text-sm font-medium text-slate-900">
            ✏️ Upravit v panelu
          </span>
        </div>
      )}
    </div>
  );
}


function splitIntoColumns<T>(arr: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => []);
  arr.forEach((item, i) => cols[i % n].push(item));
  return cols;
}

function HeroImageSlot({
  url,
  editable,
  onChange,
}: {
  url?: string;
  editable?: boolean;
  onChange?: (url: string) => void;
}) {
  const [heroFailed, setHeroFailed] = useState(false);
  const content = url ? (
    heroFailed ? (
      <SlideImageFallback className="h-full w-full" />
    ) : (
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover rounded-2xl"
        onError={() => setHeroFailed(true)}
      />
    )

  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/40 border-2 border-dashed border-white/20 rounded-2xl">
      <ImageIcon className="w-16 h-16" />
      <span className="text-lg">Bez obrázku</span>
    </div>
  );

  if (!editable) return content;

  return (
    <MediaPickerDialog
      imageOnly
      onPick={(picked) => onChange?.(picked)}
      trigger={
        <button type="button" className="w-full h-full relative group">
          {content}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl text-white text-sm font-medium transition-opacity">
            {url ? "Změnit obrázek" : "Vybrat obrázek"}
          </span>
        </button>
      }
    />
  );
}

/* ---------- Volné umístění bloku (opt-in) ---------- */

/**
 * Minimální pohyb myši (px), po kterém se flow-blok povýší do volné vrstvy.
 * 1px = blok se chová jako absolutně pozicovaný ihned po zahájení tažení,
 * ale samotný klik (bez pohybu) pořád jen vybere blok / spustí psaní.
 */
const PROMOTE_THRESHOLD = 5;

const HANDLES: { handle: FrameHandle; className: string; cursor: string }[] = [
  { handle: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { handle: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { handle: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { handle: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { handle: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { handle: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
  { handle: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { handle: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

/** Blok s vlastním rámcem – absolutně pozicovaný nad lineárním obsahem slidu. */
function FreeFrameBlock({
  block,
  frame,
  zIndex,
  editable,
  selected,
  layerRef,
  onSelect,
  onChangeFrame,
  onDelete,
  children,
}: {
  block: Block;
  frame: BlockFrame;
  zIndex: number;
  editable?: boolean;
  selected?: boolean;
  layerRef: React.RefObject<HTMLDivElement>;
  onSelect?: () => void;
  onChangeFrame?: (frame: BlockFrame) => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const startDrag =
    (handle: FrameHandle, threshold = 0) =>
    (e: React.PointerEvent) => {
      if (!editable || !onChangeFrame) return;
      if (threshold === 0) e.preventDefault();
      e.stopPropagation();
      onSelect?.();
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startFrame = frame;
      let active = threshold === 0;
      const move = (ev: PointerEvent) => {
        const px = ev.clientX - startX;
        const py = ev.clientY - startY;
        if (!active) {
          if (Math.abs(px) < threshold && Math.abs(py) < threshold) return;
          active = true;
        }
        const dx = (px / rect.width) * 100;
        const dy = (py / rect.height) * 100;
        onChangeFrame(applyFrameDrag(startFrame, handle, dx, dy));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

  const BODY_DRAG_BAILOUT =
    'button, a, input, textarea, select, [contenteditable="true"], [data-no-block-drag], [role="slider"]';

  const startBodyDrag = (e: React.PointerEvent) => {
    if (!editable) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(BODY_DRAG_BAILOUT)) {
      e.stopPropagation();
      onSelect?.();
      return;
    }
    startDrag("move", 5)(e);
  };


  const nudge = (e: React.KeyboardEvent) => {
    if (!onChangeFrame) return;
    const step = e.shiftKey ? 5 : 1;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    onChangeFrame(applyFrameDrag(frame, "move", delta[0], delta[1]));
  };

  return (
    <div
      data-slide-block-id={block.id}
      data-free-frame="true"
      className={`pointer-events-auto absolute rounded-lg ${
        editable
          ? selected
            ? "ring-2 ring-primary cursor-move"
            : "hover:ring-1 hover:ring-white/40 cursor-move"
          : ""
      }`}
      style={{
        left: `${frame.x}%`,
        top: `${frame.y}%`,
        width: `${frame.w}%`,
        height: `${frame.h}%`,
        zIndex,
      }}
      onPointerDown={editable ? startBodyDrag : undefined}
    >
      <div className="h-full w-full overflow-hidden">{children}</div>

      {editable && selected && (

        <>
          {/* Lišta pro posun + smazání */}
          <div className="absolute -top-9 left-0 flex items-center gap-1 rounded-md border border-border bg-background/95 p-0.5 shadow-sm">
            <button
              type="button"
              onPointerDown={startDrag("move")}
              onKeyDown={nudge}
              title="Přetáhnout blok (šipky = posun)"
              aria-label="Přesunout volně umístěný blok"
              className="cursor-grab touch-none rounded p-1 hover:bg-muted"
            >
              <Move className="h-3.5 w-3.5 text-foreground" />
            </button>
            <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
              {frame.x}% · {frame.y}% · {frame.w}×{frame.h}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Smazat blok"
                className="rounded p-1 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {HANDLES.map((h) => (
            <span
              key={h.handle}
              role="presentation"
              onPointerDown={startDrag(h.handle)}
              style={{ cursor: h.cursor }}
              className={`absolute h-3 w-3 touch-none rounded-full border-2 border-primary bg-background shadow ${h.className}`}
            />
          ))}
        </>
      )}
    </div>
  );
}


/* ---------- The shared slide body (no outer frame) ---------- */

export function SlideBody({
  slide,
  themeId,
  editable,
  darkMode = true,
  revealStep,
  onChangeHeadline,
  onChangeBlock,
  onMoveBlock,
  onDeleteBlock,
  onChangeHeroImage,
  onReorderBlock,
  selectedBlockId,
  onSelectBlock,
  drawMode,
  drawColor,
  drawWidth,
  onAddStroke,
}: BodyProps) {
  const freeLayerRef = useRef<HTMLDivElement>(null);
  const flowAreaRef = useRef<HTMLDivElement>(null);
  const flowContentRef = useRef<HTMLDivElement>(null);
  const [flowScale, setFlowScale] = useState(1);
  const theme = getPresentationTheme(themeId ?? slide?.themeId);


  const explicitTheme = themeId ?? slide?.themeId;
  const isDark = explicitTheme ? theme.isDark : darkMode;
  const layout: SlideLayout = (slide?.layout as SlideLayout) || "full";
  const headline: string = slide?.projector?.headline || "";
  const fontScale = slide?.projector?.fontScale || 1;
  const rawBlocks: Block[] = slide?.blocks || [];
  const heroImage: string | undefined = slide?.heroImage;

  // Apply progressive-reveal transformation when not editing.
  const allBlocks: Block[] = !editable && typeof revealStep === "number"
    ? rawBlocks.map((b) => {
        if (b.type !== "bullet_list" || !b.props?.revealMode) return b;
        const step = Math.max(0, revealStep);
        if (Array.isArray(b.props.items)) {
          return { ...b, props: { ...b.props, items: (b.props.items as string[]).slice(0, step) } } as Block;
        }
        if (typeof b.props.html === "string") {
          // Keep first N <li> elements and drop the rest.
          const html = b.props.html as string;
          let kept = 0;
          const truncated = html.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, (m) => {
            kept += 1;
            return kept <= step ? m : "";
          });
          return { ...b, props: { ...b.props, html: truncated } } as Block;
        }
        return b;
      })
    : rawBlocks;

  // Volné umístění (opt-in): bloky s `frame` jdou do absolutní vrstvy,
  // ostatní zůstávají v původním lineárním flow.
  const framedBlocks = allBlocks
    .map((b) => ({ block: b, frame: getBlockFrame(b) }))
    .filter((x): x is { block: Block; frame: BlockFrame } => !!x.frame);
  const blocks: Block[] = allBlocks.filter((b) => !getBlockFrame(b));

  // Obsah slidu se nikdy nescrolluje – když se nevejde do stage, zmenší se
  // (stejný princip jako živá projekce).
  useEffect(() => {
    const area = flowAreaRef.current;
    const content = flowContentRef.current;
    if (!area || !content) return;
    const update = () => {
      const availH = area.clientHeight;
      const contentH = content.scrollHeight;
      if (!availH || !contentH) return;
      setFlowScale(contentH > availH + 1 ? Math.max(0.35, availH / contentH) : 1);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(area);
    ro.observe(content);
    return () => ro.disconnect();
  }, [slide, blocks.length, layout]);




  // Bílý text jen na wrapperu; potomci barvu dědí (`text-inherit`), takže
  // inline `style.color` z props konkrétního bloku vždy vyhraje.
  const blockTextScope = isDark
    ? "text-white [&_*]:text-inherit [&_h1]:text-inherit [&_h2]:text-inherit [&_h3]:text-inherit [&_.bg-card]:!bg-white/10 [&_.bg-muted\\/40]:!bg-white/10 [&_.bg-muted\\/30]:!bg-white/10 [&_.border]:!border-white/20"
    : "";

  const headlineEl = (
    <EditableText
      editable={!!editable}
      value={headline}
      placeholder="Nadpis slidu"
      className={`text-6xl font-bold leading-tight ${layout === "title-only" ? "text-center text-7xl" : ""}`}
      style={{
        background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
      onCommit={(v) => onChangeHeadline?.(v)}
    />
  );

  const startDrag = (blockId: string) => (e: React.PointerEvent) => {
    if (!onReorderBlock) return;
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const target = el?.closest("[data-slide-block-id]") as HTMLElement | null;
      const overId = target?.getAttribute("data-slide-block-id");
      if (!overId || overId === blockId) return;
      const toIndex = blocks.findIndex((x) => x.id === overId);
      if (toIndex >= 0) onReorderBlock(blockId, toIndex);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /**
   * Tažení flow-bloku myší: po překonání 6px prahu se blok "povýší" do
   * absolutní vrstvy (dostane `frame` spočítaný z aktuální pozice) a drag
   * plynule pokračuje jako posun rámce.
   *
   * Textové bloky jsou `contenteditable`, proto se drag nezakazuje – při
   * překonání prahu se editovatelnému prvku jen odebere focus, takže rychlý
   * klik pořád spustí psaní, ale tažení funguje po celé ploše bloku.
   */
  const startPromoteDrag = (b: Block) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!editable || !onChangeBlock) return;
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest("button, a, input, textarea, select, [data-no-block-drag]")) {
      return;
    }
    const editableTarget = targetEl?.closest("[contenteditable='true']") as HTMLElement | null;
    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let startFrame: BlockFrame | null = null;
    let layerRect: DOMRect | null = null;

    const move = (ev: PointerEvent) => {
      if (!startFrame) {
        if (Math.abs(ev.clientX - startX) < PROMOTE_THRESHOLD && Math.abs(ev.clientY - startY) < PROMOTE_THRESHOLD) return;
        const layer = freeLayerRef.current;
        if (!layer) return;
        const lr = layer.getBoundingClientRect();
        if (!lr.width || !lr.height) return;
        const rect = el.getBoundingClientRect();
        layerRect = lr;
        // Tažení vyhrává nad editací textu – zrušíme focus i výběr.
        if (editableTarget) {
          editableTarget.blur();
          window.getSelection?.()?.removeAllRanges();
        }
        const rawW = (rect.width / lr.width) * 100;
        const rawH = (rect.height / lr.height) * 100;
        const cappedW = Math.min(rawW, 80);
        const cappedH = b.type === "image" && rawW > 0
          ? rawH * (cappedW / rawW)
          : rawH;
        startFrame = clampBlockFrame({
          x: ((rect.left - lr.left) / lr.width) * 100,
          y: ((rect.top - lr.top) / lr.height) * 100,
          w: cappedW,
          h: cappedH,
        });
        onSelectBlock?.(b.id);
        onChangeBlock(b.id, (prev: Block) => ({ ...prev, frame: startFrame } as Block));
      }
      if (!startFrame || !layerRect) return;
      const dx = ((ev.clientX - startX) / layerRect.width) * 100;
      const dy = ((ev.clientY - startY) / layerRect.height) * 100;
      const next = applyFrameDrag(startFrame, "move", dx, dy);
      onChangeBlock(b.id, (prev: Block) => ({ ...prev, frame: next } as Block));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const renderBlock = (b: Block, sliceIndex: number, asCard?: boolean) => {
    const globalIndex = blocks.findIndex((x) => x.id === b.id);
    const shell = (
      <BlockShell
        editable={editable}
        index={globalIndex}
        total={blocks.length}
        blockId={b.id}
        selected={selectedBlockId === b.id}
        onSelect={() => onSelectBlock?.(b.id)}
        onDragStart={onReorderBlock ? startDrag(b.id) : undefined}
        onMove={(dir) => onMoveBlock?.(b.id, dir)}
        onDelete={() => onDeleteBlock?.(b.id)}
      >
        {editable ? (
          <EditableBlock
            block={b}
            editable
            asCard={asCard}
            onChange={(patch) => onChangeBlock?.(b.id, patch)}
          />
        ) : (
          <div className={slideAnimationClass((b.props as any)?.animation)}>
            <EditableBlock block={b} asCard={asCard} />
          </div>
        )}
      </BlockShell>
    );

    if (!editable) return <div key={b.id}>{shell}</div>;

    return (
      <div key={b.id} className="touch-none cursor-move" data-no-pan="true" onPointerDown={startPromoteDrag(b)}>
        {shell}
      </div>
    );
  };


  let body: React.ReactNode = null;

  if (layout === "title-only") {
    body = <div className="flex-1 flex items-center justify-center">{headlineEl}</div>;
  } else if (layout === "two-cols") {
    const cols = splitIntoColumns(blocks, 2);
    body = (
      <>
        {headlineEl}
        <div className={`grid grid-cols-2 gap-8 w-full ${blockTextScope}`} style={{ zoom: fontScale } as any}>
          {cols.map((col, ci) => (
            <div key={ci} className="space-y-6">
              {col.map((b, i) => renderBlock(b, i))}
            </div>
          ))}
        </div>
      </>
    );
  } else if (layout === "three-cols") {
    const cols = splitIntoColumns(blocks, 3);
    body = (
      <>
        {headlineEl}
        <div className={`grid grid-cols-3 gap-6 w-full ${blockTextScope}`} style={{ zoom: fontScale } as any}>
          {cols.map((col, ci) => (
            <div key={ci} className="space-y-4">
              {col.map((b, i) => renderBlock(b, i, true))}
            </div>
          ))}
        </div>
      </>
    );
  } else if (layout === "img-left" || layout === "img-right") {
    const imgFirst = layout === "img-left";
    const imageCol = (
      <div className="h-[520px]">
        <HeroImageSlot url={heroImage} editable={editable} onChange={onChangeHeroImage} />
      </div>
    );
    const textCol = (
      <div className={`space-y-6 ${blockTextScope}`} style={{ zoom: fontScale } as any}>
        {blocks.map((b, i) => renderBlock(b, i))}
      </div>
    );
    body = (
      <>
        {headlineEl}
        <div className="grid grid-cols-2 gap-10 w-full items-start">
          {imgFirst ? imageCol : textCol}
          {imgFirst ? textCol : imageCol}
        </div>
      </>
    );
  } else {
    body = (
      <>
        {headlineEl}
        <div className={`w-full text-2xl space-y-6 ${blockTextScope}`} style={{ zoom: fontScale } as any}>
          {blocks.length === 0 && framedBlocks.length === 0 && editable ? (
            <div className="text-white/40 text-center text-lg py-8 border-2 border-dashed border-white/15 rounded-xl">
              Přidejte text, odrážky nebo obrázek pomocí tlačítek pod náhledem.
            </div>
          ) : (
            blocks.map((b, i) => renderBlock(b, i))
          )}
        </div>
      </>
    );
  }

  return (
    <div
      className={`relative flex h-full flex-col ${editable ? "" : "overflow-hidden"} ${
        isDark ? "text-white" : "text-foreground"
      }`}
      onPointerDown={
        editable && onSelectBlock
          ? (e) => {
              const target = e.target as HTMLElement;
              if (!target.closest("[data-slide-block-id]")) onSelectBlock(null);
            }
          : undefined
      }
    >

      <div ref={flowAreaRef} className="flex-1 min-h-0 overflow-hidden px-6 py-6">

        <div
          ref={flowContentRef}
          className="flex min-h-full w-full flex-col items-center justify-start gap-6"
          style={{
            transform: flowScale < 1 ? `scale(${flowScale})` : undefined,
            transformOrigin: "top center",
          }}
        >
          {body}
        </div>
      </div>

      {/* Vrstva ručního kreslení (tahy tužkou) – nad obsahem, pod volnými bloky */}
      <SlideDrawingLayer
        strokes={slide?.drawingStrokes}
        drawMode={drawMode}
        drawColor={drawColor}
        drawWidth={drawWidth}
        onAddStroke={onAddStroke}
      />

      {/* Vrstva volně umístěných bloků (jen bloky s `frame`) */}
      {(
        <div ref={freeLayerRef} className={`pointer-events-none absolute inset-0 ${blockTextScope}`}>

          {framedBlocks.map(({ block, frame }, frameIndex) => (
            <FreeFrameBlock
              key={block.id}
              block={block}
              frame={frame}
              zIndex={typeof block.zIndex === "number" ? block.zIndex : frameIndex + 1}
              editable={editable}
              selected={selectedBlockId === block.id}
              layerRef={freeLayerRef}
              onSelect={() => onSelectBlock?.(block.id)}
              onChangeFrame={
                onChangeBlock
                  ? (next) => onChangeBlock(block.id, (b: Block) => ({ ...b, frame: next }))
                  : undefined
              }
              onDelete={onDeleteBlock ? () => onDeleteBlock(block.id) : undefined}
            >
              {editable ? (
                <EditableBlock
                  block={block}
                  editable
                  framed
                  onChange={(patch) => onChangeBlock?.(block.id, patch)}
                />
              ) : (
                <div className={`${slideAnimationClass((block.props as any)?.animation)} h-full w-full`}>
                  <EditableBlock block={block} framed />
                </div>
              )}
            </FreeFrameBlock>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---------- Scaled canvas wrapper ---------- */

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

const SlideCanvas = ({
  fit = true,
  darkMode = true,
  themeId,
  zoom = 1,
  absoluteScale = null,
  pan = { x: 0, y: 0 },
  onZoomChange,
  onPanChange,
  ...rest
}: CanvasProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);

  // Explicit 16:9 box computed from the *available* space of the parent element
  // (width AND height), so the canvas never overflows its container.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!fit) return;
    const el = frameRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const update = () => {
      const style = window.getComputedStyle(parent);
      const availW =
        parent.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0");
      const availH =
        parent.clientHeight - parseFloat(style.paddingTop || "0") - parseFloat(style.paddingBottom || "0");
      if (availW > 0 && availH > 0) {
        const w = Math.min(availW, (availH * STAGE_W) / STAGE_H);
        const h = (w * STAGE_H) / STAGE_W;
        setBox({ w, h });
        setScale(w / STAGE_W);
        return;
      }
      // Fallback: parent has no definite height → keep width-driven aspect-video sizing.
      setBox(null);
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setScale(Math.min(w / STAGE_W, h / STAGE_H));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fit]);

  // Zoom kolečkem myši s kotvou pod kurzorem (Miro/Figma chování).
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !fit || absoluteScale) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(-dy * 0.0015)));
      if (nextZoom === zoom || !onZoomChange) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const effective = scale * zoom;
      const centerX = rect.width / 2 + pan.x;
      const centerY = rect.height / 2 + pan.y;
      const topLeftX = centerX - (STAGE_W * effective) / 2;
      const topLeftY = centerY - (STAGE_H * effective) / 2;
      const k = nextZoom / zoom;
      const newTopLeftX = px - (px - topLeftX) * k;
      const newTopLeftY = py - (py - topLeftY) * k;
      const newCenterX = newTopLeftX + (STAGE_W * scale * nextZoom) / 2;
      const newCenterY = newTopLeftY + (STAGE_H * scale * nextZoom) / 2;
      onZoomChange(nextZoom);
      onPanChange?.({ x: newCenterX - rect.width / 2, y: newCenterY - rect.height / 2 });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [fit, absoluteScale, zoom, pan, scale, onZoomChange, onPanChange]);

  // Pan tažením prázdné plochy (neblokujeme interakce s bloky/ovládacími prvky).
  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '[data-slide-block-id], [data-no-pan], [data-slide-drawing-layer], button, a, input, textarea, select, [role="slider"], [contenteditable="true"]'
      )
    ) {
      return;
    }
    if ((rest as any).drawMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { ...pan };
    const move = (ev: PointerEvent) => {
      onPanChange?.({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) });
    };
    const up = () => {
      setPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const effectiveThemeId = themeId ?? (rest as any).slide?.themeId;

  const theme = getPresentationTheme(effectiveThemeId);
  const bgOverride = slideBackgroundOverrideStyle((rest as any).slide);
  let bgStyle: React.CSSProperties = effectiveThemeId
    ? themeStageStyle(theme)
    : darkMode
      ? { background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", ...themeStageStyle(theme) }
      : { background: "hsl(var(--background))", ...themeStageStyle(theme), backgroundImage: "none" as any };

  if (bgOverride) {
    // Shorthand `background` se nesmí mísit s explicitními vlastnostmi – nejdřív ho odstraníme.
    const { background: _bg, backgroundImage: _bgi, backgroundColor: _bgc, ...withoutBg } = bgStyle as any;
    bgStyle = { ...withoutBg, ...bgOverride } as React.CSSProperties;
  }


  const body = <SlideBody darkMode={darkMode} themeId={effectiveThemeId} {...rest} />;

  if (!fit) {
    return (
      <div className="relative" style={{ width: STAGE_W, height: STAGE_H, ...bgStyle }}>
        {body}
      </div>
    );
  }

  // Pevný zoom (např. 150 %) – plátno má reálné rozměry a scrolluje se v rodiči.
  if (absoluteScale) {
    return (
      <div
        className={`relative rounded-xl shadow-lg border border-border ${
          (rest as any).editable ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{ ...bgStyle, width: STAGE_W * absoluteScale, height: STAGE_H * absoluteScale }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: `${STAGE_W}px`, height: `${STAGE_H}px`, transform: `scale(${absoluteScale})` }}
        >
          {body}
        </div>
      </div>
    );
  }

  const effectiveScale = scale * zoom;

  return (
    <div
      ref={frameRef}
      onPointerDown={startPan}
      className={`relative mx-auto max-h-full max-w-full rounded-xl shadow-lg border border-border ${
        (rest as any).editable ? "overflow-visible" : "overflow-hidden"
      } ${box ? "" : "aspect-video w-full"} ${(rest as any).editable ? "cursor-grab" : ""} ${
        panning ? "cursor-grabbing" : ""
      }`}
      style={box ? { ...bgStyle, width: box.w, height: box.h } : bgStyle}
    >
      <div
        className="absolute left-1/2 top-1/2 origin-center"

        style={{
          width: `${STAGE_W}px`,
          height: `${STAGE_H}px`,
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${effectiveScale})`,
        }}
      >
        {body}
      </div>
    </div>
  );

};

export default SlideCanvas;
