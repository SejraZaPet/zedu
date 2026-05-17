import { useRef, useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Trash2, ImageIcon } from "lucide-react";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import type { Block } from "@/lib/textbook-config";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import DOMPurify from "dompurify";

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

export const STAGE_W = 1600;
export const STAGE_H = 900;

interface BodyProps {
  slide: any;
  editable?: boolean;
  darkMode?: boolean;
  onChangeHeadline?: (v: string) => void;
  onChangeBlock?: (blockId: string, patch: Partial<Block> | ((b: Block) => Block)) => void;
  onMoveBlock?: (blockId: string, dir: "up" | "down") => void;
  onDeleteBlock?: (blockId: string) => void;
  onChangeHeroImage?: (url: string) => void;
}

interface CanvasProps extends BodyProps {
  /** When true (default), scale stage to fit container. Otherwise renders at native 1600×900. */
  fit?: boolean;
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
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  editable?: boolean;
  placeholder?: string;
  multiline?: boolean;
  html?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sanitizedValue = html ? DOMPurify.sanitize(value || "") : value || "";

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      if (html) ref.current.innerHTML = sanitizedValue;
      else ref.current.innerText = value || "";
    }
  }, [html, sanitizedValue, value]);

  if (!editable) {
    return (
      html ? (
        <div
          className={className}
          dangerouslySetInnerHTML={{ __html: sanitizedValue || (placeholder ? `<span class="opacity-40">${placeholder}</span>` : "") }}
        />
      ) : (
        <div className={className} style={{ whiteSpace: multiline ? "pre-wrap" : undefined }}>
          {value || (placeholder ? <span className="opacity-40">{placeholder}</span> : null)}
        </div>
      )
    );
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || ""}
      onBlur={(e) => onCommit(html ? e.currentTarget.innerHTML : e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      className={`${className || ""} cursor-text rounded px-1 -mx-1 outline-none focus:ring-2 focus:ring-primary focus:bg-white/5 hover:bg-white/5 transition-colors empty:before:content-[attr(data-placeholder)] empty:before:opacity-40`}
    />
  );
}

function BlockShell({
  editable,
  index,
  total,
  onMove,
  onDelete,
  children,
}: {
  editable?: boolean;
  index: number;
  total: number;
  onMove?: (dir: "up" | "down") => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  if (!editable) return <>{children}</>;
  return (
    <div className="group relative rounded-lg hover:bg-white/5 transition-colors p-1 -m-1">
      {children}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background/90 border border-border rounded-md shadow-sm p-0.5">
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
    </div>
  );
}

function EditableBlock({
  block,
  editable,
  asCard,
  onChange,
}: {
  block: Block;
  editable?: boolean;
  asCard?: boolean;
  onChange?: (patch: Partial<Block> | ((b: Block) => Block)) => void;
}) {
  const update = (patch: Partial<Block> | ((b: Block) => Block)) => onChange?.(patch);

  if (block.type === "paragraph") {
    const value = block.props?.text || "";
    const isHtml = /<[^>]+>/.test(value);
    return (
      <div className={asCard ? "bg-white/10 rounded-xl p-4 border border-white/15" : ""}>
        <EditableText
          editable={editable}
          multiline
          html={isHtml}
          value={value}
          placeholder="Napište text…"
          className="text-2xl leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold"
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
        placeholder="Nadpis…"
        className={`${cls} [&_strong]:font-semibold`}
        onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, text: v } }))}
      />
    );
  }

  if (block.type === "bullet_list") {
    const items: string[] = block.props?.items || [""];
    if (block.props?.html) {
      return (
        <div className={asCard ? "bg-white/10 rounded-xl p-4 border border-white/15" : ""}>
          <EditableText
            editable={editable}
            multiline
            html
            value={block.props.html}
            placeholder="Zadejte odrážky…"
            className="text-2xl leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2"
            onCommit={(v) => update((b) => ({ ...b, props: { ...b.props, html: v } }))}
          />
        </div>
      );
    }
    return (
      <ul className={`space-y-2 ${asCard ? "bg-white/10 rounded-xl p-4 border border-white/15" : ""}`}>
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-2xl">
            <span className="text-purple-400 mt-1 flex-shrink-0">•</span>
            <div className="flex-1 flex items-center gap-2">
              <EditableText
                editable={editable}
                value={item}
                placeholder="Odrážka…"
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
        {editable && (
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
    );
  }

  // Fallback (image, table, accordion, etc.): use existing renderer
  return (
    <div className={asCard ? "bg-white/10 rounded-xl p-4 border border-white/15" : ""}>
      <LessonBlock block={block} blockIndex={0} isTeacher={false} />
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
  const content = url ? (
    <img src={url} alt="" className="w-full h-full object-cover rounded-2xl" />
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

/* ---------- The shared slide body (no outer frame) ---------- */

export function SlideBody({
  slide,
  editable,
  darkMode = true,
  onChangeHeadline,
  onChangeBlock,
  onMoveBlock,
  onDeleteBlock,
  onChangeHeroImage,
}: BodyProps) {
  const layout: SlideLayout = (slide?.layout as SlideLayout) || "full";
  const headline: string = slide?.projector?.headline || "";
  const fontScale = slide?.projector?.fontScale || 1;
  const blocks: Block[] = slide?.blocks || [];
  const heroImage: string | undefined = slide?.heroImage;

  const blockTextScope = darkMode
    ? "[&_*]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_.bg-card]:!bg-white/10 [&_.bg-muted\\/40]:!bg-white/10 [&_.bg-muted\\/30]:!bg-white/10 [&_.border]:!border-white/20"
    : "";

  const headlineEl = (
    <EditableText
      editable={!!editable}
      value={headline}
      placeholder="Nadpis slidu"
      className={`text-6xl font-bold leading-tight ${
        darkMode ? "bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200" : ""
      } ${layout === "title-only" ? "text-center text-7xl" : ""}`}
      onCommit={(v) => onChangeHeadline?.(v)}
    />
  );

  const renderBlock = (b: Block, sliceIndex: number, asCard?: boolean) => {
    const globalIndex = blocks.findIndex((x) => x.id === b.id);
    return (
      <BlockShell
        key={b.id}
        editable={editable}
        index={globalIndex}
        total={blocks.length}
        onMove={(dir) => onMoveBlock?.(b.id, dir)}
        onDelete={() => onDeleteBlock?.(b.id)}
      >
        <EditableBlock
          block={b}
          editable={editable}
          asCard={asCard}
          onChange={(patch) => onChangeBlock?.(b.id, patch)}
        />
      </BlockShell>
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
          {blocks.length === 0 && editable ? (
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
    <div className={`flex h-full flex-col overflow-hidden ${darkMode ? "text-white" : "text-foreground"}`}>
      <div className="flex-1 flex flex-col items-center justify-start px-12 py-10 gap-6 min-h-0 overflow-y-auto">
        {body}
      </div>
    </div>
  );
}

/* ---------- Scaled canvas wrapper ---------- */

const SlideCanvas = ({ fit = true, darkMode = true, ...rest }: CanvasProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!fit) return;
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setScale(Math.min(w / STAGE_W, h / STAGE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const bgStyle = darkMode
    ? { background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }
    : { background: "hsl(var(--background))" };

  const body = <SlideBody darkMode={darkMode} {...rest} />;

  if (!fit) {
    return (
      <div className="relative" style={{ width: STAGE_W, height: STAGE_H, ...bgStyle }}>
        {body}
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className="relative aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-border"
      style={bgStyle}
    >
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: `${STAGE_W}px`,
          height: `${STAGE_H}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {body}
      </div>
    </div>
  );
};

export default SlideCanvas;
