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
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, ChevronDown, ChevronUp,
  ChevronsDown, ChevronsUp, Copy, Highlighter, Italic,
  AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween, Group, Ungroup, Square,
  Maximize, Minus, Paintbrush, Palette, Plus, Sparkles, Trash2,
} from "lucide-react";


import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import IconPickerDialog from "@/components/admin/IconPickerDialog";
import ColorPicker from "@/components/admin/ColorPicker";
import GradientPicker from "@/components/admin/GradientPicker";
import { gradientCss } from "@/lib/slide-gradient";
import { SHAPE_KINDS } from "@/components/blocks/ShapeRenderer";
import type { Block } from "@/lib/textbook-config";
import type { AlignMode } from "@/lib/block-frame";


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
  /** Změna vrstvy (z-index) volně umístěného bloku. */
  onChangeLayer?: (action: "front" | "forward" | "backward" | "back") => void;
  /** ČÁST 1 – zkopíruje vybraný blok do „schránky“ editoru. */
  onCopyBlock?: () => void;
  /** ČÁST 2 – zkopíruje styl (props) vybraného bloku (štětec). */
  onCopyStyle?: () => void;
  /** Štětec je aktivní (styl je ve schránce a čeká na aplikaci). */
  styleCopied?: boolean;
  /** FÁZE 2 – zarovnání jednoho prvku vůči snímku. */
  onAlign?: (mode: AlignMode) => void;
  /** FÁZE 2 – prvek vyplní celý snímek. */
  onFillStage?: () => void;
  /** FÁZE 3 – počet vybraných prvků (>1 = hromadný režim lišty). */
  selectedCount?: number;
  /** FÁZE 3 – zarovnání výběru vůči sobě navzájem. */
  onAlignGroup?: (mode: AlignMode) => void;
  /** FÁZE 3 – rovnoměrné rozmístění výběru. */
  onDistribute?: (axis: "h" | "v") => void;
  /** FÁZE 3 – spojení výběru do skupiny. */
  onGroup?: () => void;
  /** FÁZE 3 – rozdělení vybrané skupiny na jednotlivé prvky. */
  onUngroup?: () => void;
}



const TEXT_BLOCK_TYPES = new Set([
  "heading", "paragraph", "callout", "quote", "bullet_list", "summary", "two_column", "formula",
]);

/**
 * Plovoucí formátovací lišta, která se zobrazí přímo nad vybraným blokem
 * na plátně slidu (místo dřívějšího „Pokročilého editoru bloků“).
 */
export const SlideFloatingFormatToolbar = ({
  containerRef, block, onChangeProps, onMove, onDelete, positionKey, framed, staticBar,
  onChangeLayer, onCopyBlock, onCopyStyle, styleCopied,
  onAlign, onFillStage, selectedCount = 1, onAlignGroup, onDistribute, onGroup, onUngroup,
}: Props) => {


  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const props = (block?.props || {}) as Record<string, any>;
  const set = (patch: Record<string, any>) => onChangeProps({ ...props, ...patch });
  const isText = block ? TEXT_BLOCK_TYPES.has(block.type) : false;
  const isHeading = block?.type === "heading";
  const isBulletList = block?.type === "bullet_list" && Array.isArray(props.items);
  const isIcon = block?.type === "image" && !!props.icon;
  const isImage = block?.type === "image" && !isIcon;
  const isShape = block?.type === "shape";
  /** Linka a šipka se kreslí jen obrysovou barvou – výplň u nich nemá efekt. */
  const isStrokeOnlyShape = isShape && ((block?.props as any)?.shapeKind === "line" || (block?.props as any)?.shapeKind === "arrow");



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
    if (staticBar) return;
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
    if (staticBar || !block) return;
    const t = window.setTimeout(() => {
      const next = measurePos();
      if (next) setPos(next);
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props)]);


  if (!block || (!staticBar && !pos)) return null;

  const barClass = staticBar
    ? "flex max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-popover px-1.5 py-1 shadow-sm"
    : "absolute z-30 flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-popover/95 px-1.5 py-1 shadow-lg backdrop-blur";

  const ALIGN_BUTTONS: { mode: AlignMode; Icon: typeof AlignLeft; label: string }[] = [
    { mode: "left", Icon: AlignHorizontalJustifyStart, label: "Zarovnat vlevo" },
    { mode: "hcenter", Icon: AlignHorizontalJustifyCenter, label: "Zarovnat vodorovně na střed" },
    { mode: "right", Icon: AlignHorizontalJustifyEnd, label: "Zarovnat vpravo" },
    { mode: "top", Icon: AlignVerticalJustifyStart, label: "Zarovnat nahoru" },
    { mode: "vcenter", Icon: AlignVerticalJustifyCenter, label: "Zarovnat svisle na střed" },
    { mode: "bottom", Icon: AlignVerticalJustifyEnd, label: "Zarovnat dolů" },
  ];

  /* ── FÁZE 3 – hromadný režim pro víc vybraných prvků ─────────────── */
  if (selectedCount > 1) {
    return (
      <div
        data-slide-toolbar="true"
        className={barClass}
        style={staticBar ? undefined : { top: pos!.top, left: pos!.left }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="px-1 text-[11px] text-muted-foreground">
          Vybráno {selectedCount} prvků
        </span>
        <div className="mx-0.5 h-5 w-px bg-border" />
        {ALIGN_BUTTONS.map(({ mode, Icon, label }) => (
          <Button
            key={mode}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title={`${label} (podle výběru)`}
            onClick={() => onAlignGroup?.(mode)}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <div className="mx-0.5 h-5 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Rozmístit vodorovně (stejné mezery)"
          onClick={() => onDistribute?.("h")}
        >
          <AlignHorizontalSpaceBetween className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Rozmístit svisle (stejné mezery)"
          onClick={() => onDistribute?.("v")}
        >
          <AlignVerticalSpaceBetween className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[11px]"
          title="Spojit vybrané prvky do skupiny"
          onClick={() => onGroup?.()}
        >
          <Group className="h-3.5 w-3.5" /> Spojit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive"
          title="Smazat vybrané prvky"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      data-slide-toolbar="true"
      className={barClass}
      style={staticBar ? undefined : { top: pos!.top, left: pos!.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {framed && onAlign && (
        <>
          {ALIGN_BUTTONS.map(({ mode, Icon, label }) => (
            <Button
              key={mode}
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title={`${label} (podle snímku)`}
              onClick={() => onAlign(mode)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          {onFillStage && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Vyplnit celý snímek"
              onClick={onFillStage}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
          {block.type === ("group" as Block["type"]) && onUngroup && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px]"
              title="Rozdělit skupinu na jednotlivé prvky"
              onClick={onUngroup}
            >
              <Ungroup className="h-3.5 w-3.5" /> Rozdělit
            </Button>
          )}
          <div className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}

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
                {gradientCss((props as any).gradient) ? (
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundImage: gradientCss((props as any).gradient) || undefined }}
                  />
                ) : (
                  <Palette className="h-3.5 w-3.5" style={{ color: props.color || undefined }} />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto space-y-2 p-2">
              <ColorPicker
                value={props.color}
                onChange={(v) => set({ color: v, gradient: null })}
                allowNull
                nullLabel="Výchozí"
              />
              <div className="border-t border-border pt-2">
                <p className="mb-1 text-[11px] text-muted-foreground">Barevný přechod textu</p>
                <GradientPicker
                  value={(props as any).gradient}
                  onChange={(v) => set({ gradient: v })}
                />
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
              <ColorPicker
                value={props.highlightColor}
                onChange={(v) => set({ highlightColor: v })}
                allowNull
                nullLabel="Bez"
                swatches={SLIDE_HIGHLIGHT_COLORS}
              />
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

      {isIcon && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" title="Barva ikony">
                <span
                  className="mr-1 inline-block h-3 w-3 rounded-full border border-border"
                  style={{ background: props.iconColor || "#ffffff" }}
                />
                Barva
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <ColorPicker
                value={props.iconColor}
                onChange={(v) => set({ iconColor: v })}
                allowNull
                nullLabel="Výchozí"
              />
            </PopoverContent>
          </Popover>
          <IconPickerDialog
            onPick={(picked) => set({ icon: picked.name, iconName: picked.name })}
            trigger={
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" title="Změnit ikonu">
                Změnit ikonu
              </Button>
            }
          />
          <Select
            value={(props.width as string) || "full"}
            onValueChange={(v) => set({ width: v })}
          >
            <SelectTrigger className="h-7 w-[92px] text-xs" title="Velikost ikony">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Malá</SelectItem>
              <SelectItem value="medium">Střední</SelectItem>
              <SelectItem value="full">Velká</SelectItem>
            </SelectContent>
          </Select>
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

      {isShape && (
        <>
          <Select value={props.shapeKind || "rectangle"} onValueChange={(v) => set({ shapeKind: v })}>
            <SelectTrigger className="h-7 w-[140px] text-xs" title="Typ tvaru">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHAPE_KINDS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isStrokeOnlyShape && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" title="Barva výplně">
                <span
                  className="mr-1 inline-block h-3 w-3 rounded-full border border-border"
                  style={{
                    backgroundImage: gradientCss((props as any).fillGradient) || undefined,
                    backgroundColor:
                      !gradientCss((props as any).fillGradient) && props.fillColor && props.fillColor !== "none"
                        ? props.fillColor
                        : "transparent",
                  }}
                />
                Výplň
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto space-y-2 p-2">
              <ColorPicker
                value={props.fillColor === "none" ? null : props.fillColor}
                onChange={(v) => set({ fillColor: v ?? "none", fillGradient: null })}
                allowNull
                nullLabel="Bez"
              />
              <div className="border-t border-border pt-2">
                <p className="mb-1 text-[11px] text-muted-foreground">Barevný přechod výplně</p>
                <GradientPicker
                  value={(props as any).fillGradient}
                  onChange={(v) => set({ fillGradient: v })}
                />
              </div>
            </PopoverContent>
          </Popover>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" title={isStrokeOnlyShape ? "Barva linky" : "Barva obrysu"}>
                <span
                  className="mr-1 inline-block h-3 w-3 rounded-full border-2"
                  style={{ borderColor: props.strokeColor && props.strokeColor !== "none" ? props.strokeColor : "hsl(var(--border))" }}
                />
                {isStrokeOnlyShape ? "Barva linky" : "Obrys"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <ColorPicker
                value={props.strokeColor === "none" ? null : props.strokeColor}
                onChange={(v) => set({ strokeColor: v ?? "none" })}
                allowNull
                nullLabel="Bez"
              />
            </PopoverContent>
          </Popover>

          <Input
            type="number"
            min={0}
            max={20}
            className="h-7 w-[64px] text-xs"
            title="Šířka obrysu (0–20)"
            aria-label="Šířka obrysu"
            value={props.strokeWidth ?? 2}
            onChange={(e) =>
              set({ strokeWidth: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
            }
          />

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

      {framed && onChangeLayer && (
        <>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Na popředí" onClick={() => onChangeLayer("front")}>
            <ChevronsUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Dopředu" onClick={() => onChangeLayer("forward")}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Dozadu" onClick={() => onChangeLayer("backward")}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Na pozadí" onClick={() => onChangeLayer("back")}>
            <ChevronsDown className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      <div className="mx-0.5 h-5 w-px bg-border" />

      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Posunout výš" onClick={() => onMove("up")}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Posunout níž" onClick={() => onMove("down")}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      {onCopyBlock && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Kopírovat blok (vložíte tlačítkem „Vložit kopii“ v horní liště)"
          onClick={onCopyBlock}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
      {onCopyStyle && (
        <Button
          size="sm"
          variant={styleCopied ? "default" : "ghost"}
          className="h-7 w-7 p-0"
          title="Kopírovat styl – pak klikněte na blok, na který se má styl použít"
          aria-pressed={!!styleCopied}
          onClick={onCopyStyle}
        >
          <Paintbrush className="h-3.5 w-3.5" />
        </Button>
      )}
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
