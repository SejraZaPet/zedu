import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SLIDE_ANIMATIONS, SLIDE_FONTS, SLIDE_FONT_SIZES, SLIDE_HIGHLIGHT_COLORS, SLIDE_TEXT_COLORS,
} from "@/lib/slide-typography";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Highlighter, Italic,
  Maximize, Minus, Palette, Plus, Sparkles, Trash2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Block } from "@/lib/textbook-config";

interface Props {
  /** Kontejner, ve kterém je plátno slidu (pozice se počítá relativně k němu). */
  containerRef: RefObject<HTMLElement>;
  block: Block | null;
  onChangeProps: (props: Record<string, any>) => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  /** Klíč, jehož změna vynutí přepočet pozice (např. index slidu). */
  positionKey?: string | number;
  /** Blok je volně umístěný (má `frame`) – u obrázku pak nabídneme object-fit. */
  framed?: boolean;
  /** Statická lišta (vždy nad plátnem, nepozicuje se nad blok). */
  staticBar?: boolean;
}

const TEXT_BLOCK_TYPES = new Set([
  "heading", "paragraph", "callout", "quote", "bullet_list", "summary", "two_column", "formula",
]);

/**
 * Plovoucí formátovací lišta, která se zobrazí přímo nad vybraným blokem
 * na plátně slidu (místo dřívějšího „Pokročilého editoru bloků“).
 */
export const SlideFloatingFormatToolbar = ({
  containerRef, block, onChangeProps, onMove, onDelete, positionKey, framed,
}: Props) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const props = (block?.props || {}) as Record<string, any>;
  const set = (patch: Record<string, any>) => onChangeProps({ ...props, ...patch });
  const isText = block ? TEXT_BLOCK_TYPES.has(block.type) : false;
  const isHeading = block?.type === "heading";
  const isBulletList = block?.type === "bullet_list" && Array.isArray(props.items);
  const isImage = block?.type === "image";


  /** Spočítá pozici lišty – nad blokem, u horní třetiny plátna pod ním. */
  const measurePos = () => {
    const container = containerRef.current;
    const el = container?.querySelector(`[data-slide-block-id="${block?.id}"]`) as HTMLElement | null;
    if (!container || !el || !block) return null;
    const cRect = container.getBoundingClientRect();
    const bRect = el.getBoundingClientRect();
    const relTop = bRect.top - cRect.top;
    const inTopThird = cRect.height > 0 && relTop < cRect.height * 0.3;
    const top = inTopThird
      ? Math.min(bRect.bottom - cRect.top + 8, Math.max(4, cRect.height - 46))
      : Math.max(4, relTop - 46);
    return {
      top,
      left: Math.max(4, Math.min(bRect.left - cRect.left, cRect.width - 320)),
    };
  };

  useLayoutEffect(() => {
    if (!block) {
      setPos(null);
      return;
    }
    let frame = 0;
    const measure = () => setPos(measurePos());
    measure();
    frame = window.requestAnimationFrame(measure);
    const container = containerRef.current;
    container?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      container?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id, positionKey]);

  // Po změně obsahu bloku se může posunout i lišta.
  useEffect(() => {
    if (!block) return;
    const t = window.setTimeout(() => {
      const next = measurePos();
      if (next) setPos(next);
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props)]);


  if (!block || !pos) return null;

  return (
    <div
      data-slide-toolbar="true"
      className="absolute z-30 flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-popover/95 px-1.5 py-1 shadow-lg backdrop-blur"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isHeading && (
        <Select
          value={String(props.level || 2)}
          onValueChange={(v) => set({ level: Number(v) })}
        >
          <SelectTrigger className="h-7 w-[62px] text-xs" title="Úroveň nadpisu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">H1</SelectItem>
            <SelectItem value="2">H2</SelectItem>
            <SelectItem value="3">H3</SelectItem>
          </SelectContent>
        </Select>
      )}

      {isText && (
        <>
          <Button
            size="sm"
            variant={props.bold ? "default" : "ghost"}
            className="h-7 w-7 p-0"
            title="Tučně"
            aria-pressed={!!props.bold}
            onClick={() => set({ bold: props.bold ? null : true })}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={props.italic ? "default" : "ghost"}
            className="h-7 w-7 p-0"
            title="Kurzíva"
            aria-pressed={!!props.italic}
            onClick={() => set({ italic: props.italic ? null : true })}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>

          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "right" ? AlignRight : AlignCenter;
            const active = (props.align || "left") === a;
            return (
              <Button
                key={a}
                size="sm"
                variant={active ? "default" : "ghost"}
                className="h-7 w-7 p-0"
                title={a === "left" ? "Zarovnat vlevo" : a === "right" ? "Zarovnat vpravo" : "Zarovnat na střed"}
                aria-pressed={active}
                onClick={() => set({ align: a === "left" ? null : a })}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}

          <Select
            value={props.lineHeight ? String(props.lineHeight) : "inherit"}
            onValueChange={(v) => set({ lineHeight: v === "inherit" ? null : Number(v) })}
          >
            <SelectTrigger className="h-7 w-[64px] text-xs" title="Řádkování">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Auto</SelectItem>
              <SelectItem value="1.2">1.2×</SelectItem>
              <SelectItem value="1.5">1.5×</SelectItem>
              <SelectItem value="2">2×</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={props.fontSize ? String(props.fontSize) : "inherit"}
            onValueChange={(v) => set({ fontSize: v === "inherit" ? null : Number(v) })}
          >
            <SelectTrigger className="h-7 w-[74px] text-xs" title="Velikost písma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Auto</SelectItem>
              {SLIDE_FONT_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={props.fontFamily || "inherit"}
            onValueChange={(v) => set({ fontFamily: v === "inherit" ? null : v })}
          >
            <SelectTrigger className="h-7 w-[118px] text-xs" title="Písmo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Podle tématu</SelectItem>
              {SLIDE_FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Barva textu">
                <Palette className="h-3.5 w-3.5" style={{ color: props.color || undefined }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Barva textu ${c}`}
                    onClick={() => set({ color: c })}
                    className="h-6 w-6 rounded-full border-2 border-border"
                    style={{ background: c }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => set({ color: null })}
                  className="rounded border border-border px-2 text-[11px]"
                >
                  Výchozí
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Zvýraznění">
                <Highlighter className="h-3.5 w-3.5" style={{ color: props.highlightColor || undefined }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Zvýraznění ${c}`}
                    onClick={() => set({ highlightColor: c })}
                    className="h-6 w-6 rounded-full border-2 border-border"
                    style={{ background: c }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => set({ highlightColor: null })}
                  className="rounded border border-border px-2 text-[11px]"
                >
                  Bez
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}

      {isBulletList && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Přidat odrážku"
            onClick={() => set({ items: [...(props.items as string[]), ""] })}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Odebrat poslední odrážku"
            disabled={(props.items as string[]).length <= 1}
            onClick={() => set({ items: (props.items as string[]).slice(0, -1) })}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
            {(props.items as string[]).length}
          </span>
          <div className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}

      {isImage && (
        <>
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "right" ? AlignRight : AlignCenter;
            const active = (props.alignment || "center") === a;
            return (
              <Button
                key={a}
                size="sm"
                variant={active ? "default" : "ghost"}
                className="h-7 w-7 p-0"
                title={a === "left" ? "Zarovnat vlevo" : a === "right" ? "Zarovnat vpravo" : "Zarovnat na střed"}
                aria-pressed={active}
                onClick={() => set({ alignment: a })}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}

          {framed && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px]"
              title="Přepnout přizpůsobení obrázku v rámci"
              onClick={() => set({ objectFit: props.objectFit === "cover" ? "contain" : "cover" })}
            >
              <Maximize className="h-3.5 w-3.5" />
              {props.objectFit === "cover" ? "Oříznout" : "Přizpůsobit"}
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" title="Alternativní text">
                Alt
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2 p-2">
              <Label className="text-xs">Alternativní text (pro čtečky)</Label>
              <Input
                className="h-8 text-xs"
                value={props.alt || ""}
                placeholder="Co je na obrázku…"
                onChange={(e) => set({ alt: e.target.value })}
              />
            </PopoverContent>
          </Popover>

          <div className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}



      <Select
        value={props.animation || "none"}
        onValueChange={(v) => set({ animation: v === "none" ? null : v })}
      >
        <SelectTrigger className="h-7 w-[112px] text-xs" title="Animace vstupu">
          <SelectValue placeholder="Animace" />
        </SelectTrigger>
        <SelectContent>
          {SLIDE_ANIMATIONS.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> {a.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Posunout výš" onClick={() => onMove("up")}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Posunout níž" onClick={() => onMove("down")}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-destructive"
        title="Smazat blok"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default SlideFloatingFormatToolbar;
