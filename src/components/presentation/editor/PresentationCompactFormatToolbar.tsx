import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import IconPickerDialog from "@/components/admin/IconPickerDialog";
import ColorPicker from "@/components/admin/ColorPicker";
import GradientPicker from "@/components/admin/GradientPicker";
import { SHAPE_KINDS } from "@/components/blocks/ShapeRenderer";
import type { Block } from "@/lib/textbook-config";
import type { AlignMode } from "@/lib/block-frame";
import { gradientCss } from "@/lib/slide-gradient";
import { SLIDE_FONTS, SLIDE_FONT_SIZES, SLIDE_HIGHLIGHT_COLORS } from "@/lib/slide-typography";
import BlockAnimationPanel from "@/components/presentation/editor/BlockAnimationPanel";
import {
  AlignCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween, AlignLeft, AlignRight, AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalSpaceBetween, ArrowDown, ArrowUp,
  Bold, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, Group, Highlighter, Italic,
  Layers, Maximize, Minus, MoreHorizontal, Paintbrush, Palette, Plus, Sparkles, Square, Trash2,
  Type, Underline, Ungroup,
} from "lucide-react";

interface Props {
  block: Block;
  onChangeProps: (props: Record<string, any>) => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  framed?: boolean;
  onChangeLayer?: (action: "front" | "forward" | "backward" | "back") => void;
  onCopyBlock?: () => void;
  onCopyStyle?: () => void;
  styleCopied?: boolean;
  onAlign?: (mode: AlignMode) => void;
  onFillStage?: () => void;
  selectedCount?: number;
  onAlignGroup?: (mode: AlignMode) => void;
  onDistribute?: (axis: "h" | "v") => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  slide?: any;
  onSlideBlocksChange?: (blocks: Block[]) => void;
  onPreviewAnimation?: () => void;
  onPlaySlide?: () => void;
  onSelectBlock?: (id: string) => void;
}

const TEXT_TYPES = new Set(["heading", "paragraph", "callout", "quote", "bullet_list", "summary", "two_column", "formula"]);
const ALIGNMENTS: { mode: AlignMode; Icon: typeof AlignLeft; label: string }[] = [
  { mode: "left", Icon: AlignHorizontalJustifyStart, label: "Zarovnat vlevo" },
  { mode: "hcenter", Icon: AlignHorizontalJustifyCenter, label: "Zarovnat vodorovně na střed" },
  { mode: "right", Icon: AlignHorizontalJustifyEnd, label: "Zarovnat vpravo" },
  { mode: "top", Icon: AlignVerticalJustifyStart, label: "Zarovnat nahoru" },
  { mode: "vcenter", Icon: AlignVerticalJustifyCenter, label: "Zarovnat svisle na střed" },
  { mode: "bottom", Icon: AlignVerticalJustifyEnd, label: "Zarovnat dolů" },
];

function ToolButton({ label, onClick, children, active, disabled, destructive }: {
  label: string; onClick?: () => void; children: ReactNode; active?: boolean; disabled?: boolean; destructive?: boolean;
}) {
  return <Button type="button" size="icon" variant={active ? "default" : "ghost"} className={`deck-tool-icon ${destructive ? "text-destructive" : ""}`} aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} onClick={onClick} disabled={disabled}>{children}</Button>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2 border-b border-deck-line pb-3 last:border-0 last:pb-0"><h3 className="text-xs font-semibold text-deck-violet-deep">{title}</h3>{children}</section>;
}

/** Jednořádká statická lišta. Původní plovoucí lišta zůstává samostatně zachovaná. */
export default function PresentationCompactFormatToolbar(props: Props) {
  const { block, selectedCount = 1 } = props;
  const [animationOpen, setAnimationOpen] = useState(false);
  const values = (block.props || {}) as Record<string, any>;
  const set = (patch: Record<string, any>) => props.onChangeProps({ ...values, ...patch });
  const isText = TEXT_TYPES.has(block.type);
  const isBullet = block.type === "bullet_list" && Array.isArray(values.items);
  const isIcon = block.type === "image" && !!values.icon;
  const isImage = block.type === "image" && !isIcon;
  const isShape = block.type === "shape";
  const strokeOnly = isShape && ["line", "arrow"].includes(values.shapeKind);

  const layers = props.framed && props.onChangeLayer ? <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" className="deck-tool-icon" aria-label="Vrstvy" title="Vrstvy"><Layers /></Button></PopoverTrigger><PopoverContent className="w-48 p-2"><div className="grid grid-cols-2 gap-1">{([["front", "Na popředí", ChevronsUp], ["forward", "Dopředu", ChevronUp], ["backward", "Dozadu", ChevronDown], ["back", "Na pozadí", ChevronsDown]] as const).map(([action, label, Icon]) => <Button key={action} variant="ghost" size="sm" className="justify-start gap-2" onClick={() => props.onChangeLayer?.(action)}><Icon className="h-4 w-4" />{label}</Button>)}</div></PopoverContent></Popover> : null;

  const animation = <Popover open={animationOpen} onOpenChange={setAnimationOpen}><PopoverTrigger asChild><Button type="button" size="icon" variant={values.animation && values.animation !== "none" ? "default" : "ghost"} className="deck-tool-icon" aria-label="Animace" title="Animace"><Sparkles /></Button></PopoverTrigger><PopoverContent className="max-h-[min(76vh,680px)] w-[380px] overflow-y-auto p-4"><BlockAnimationPanel slide={props.slide || { blocks: [block] }} block={block} onChange={(nextAnimation) => set({ animation: nextAnimation })} onPreview={() => props.onPreviewAnimation?.()} onPlaySlide={() => props.onPlaySlide?.()} onReorder={(nextBlocks) => props.onSlideBlocksChange?.(nextBlocks)} onSelectBlock={(id) => { props.onSelectBlock?.(id); setAnimationOpen(false); }} onClose={() => setAnimationOpen(false)} /></PopoverContent></Popover>;

  const boxBackground = !isShape ? <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" className="deck-tool-icon" aria-label="Pozadí boxu" title="Pozadí boxu"><Square style={{ color: values.boxBackground || undefined }} /></Button></PopoverTrigger><PopoverContent className="w-auto space-y-3 p-3"><ColorPicker value={values.boxBackground === "none" ? null : values.boxBackground} onChange={(boxBackground) => set({ boxBackground: boxBackground ?? "none", boxGradient: null })} allowNull nullLabel="Bez pozadí" /><div className="border-t border-deck-line pt-2"><p className="mb-2 text-xs text-deck-muted">Barevný přechod pozadí</p><GradientPicker value={values.boxGradient} onChange={(boxGradient) => set({ boxGradient })} /></div><div className="border-t border-deck-line pt-2"><p className="mb-2 text-xs text-deck-muted">Rámeček boxu</p><ColorPicker value={values.boxBorderColor ?? null} onChange={(boxBorderColor) => set({ boxBorderColor: boxBorderColor ?? null })} allowNull nullLabel="Bez rámečku" /></div></PopoverContent></Popover> : null;

  const more = <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" className="deck-tool-icon" aria-label="Další možnosti" title="Další možnosti"><MoreHorizontal /></Button></PopoverTrigger><PopoverContent className="max-h-[min(70vh,560px)] w-80 space-y-3 overflow-y-auto p-3" aria-label="Další možnosti">
    {props.framed && props.onAlign && <Section title="Zarovnání podle slidu"><div className="grid grid-cols-3 gap-1">{ALIGNMENTS.map(({ mode, Icon, label }) => <Button key={mode} variant="outline" size="sm" className="gap-1 px-2 text-[11px]" onClick={() => props.onAlign?.(mode)}><Icon className="h-3.5 w-3.5" />{label.replace("Zarovnat ", "")}</Button>)}{props.onFillStage && <Button variant="outline" size="sm" className="col-span-3 gap-2" onClick={props.onFillStage}><Maximize className="h-4 w-4" />Vyplnit celý slide</Button>}{block.type === ("group" as Block["type"]) && props.onUngroup && <Button variant="outline" size="sm" className="col-span-3 gap-2" onClick={props.onUngroup}><Ungroup className="h-4 w-4" />Rozdělit skupinu</Button>}</div></Section>}
    {selectedCount > 1 && <Section title="Výběr více prvků"><div className="grid grid-cols-2 gap-1">{props.onDistribute && <><Button variant="outline" size="sm" onClick={() => props.onDistribute?.("h")}><AlignHorizontalSpaceBetween className="mr-1 h-4 w-4" />Rozmístit vodorovně</Button><Button variant="outline" size="sm" onClick={() => props.onDistribute?.("v")}><AlignVerticalSpaceBetween className="mr-1 h-4 w-4" />Rozmístit svisle</Button></>}{props.onGroup && <Button variant="outline" size="sm" className="col-span-2" onClick={props.onGroup}><Group className="mr-1 h-4 w-4" />Spojit do skupiny</Button>}</div></Section>}
    {isText && <Section title="Další formátování textu"><div className="flex flex-wrap items-center gap-2"><Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Highlighter className="h-4 w-4" />Zvýraznění</Button></PopoverTrigger><PopoverContent className="w-auto p-2"><ColorPicker value={values.highlightColor} onChange={(highlightColor) => set({ highlightColor })} allowNull nullLabel="Bez" swatches={SLIDE_HIGHLIGHT_COLORS} /></PopoverContent></Popover><Label className="text-xs" htmlFor="compact-line-height">Řádkování</Label><Select value={values.lineHeight ? String(values.lineHeight) : "inherit"} onValueChange={(lineHeight) => set({ lineHeight: lineHeight === "inherit" ? null : Number(lineHeight) })}><SelectTrigger id="compact-line-height" className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Auto</SelectItem><SelectItem value="1.2">1,2×</SelectItem><SelectItem value="1.5">1,5×</SelectItem><SelectItem value="2">2×</SelectItem></SelectContent></Select></div>{isBullet && <div className="mt-2 flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => set({ items: [...values.items, ""] })}><Plus className="mr-1 h-4 w-4" />Přidat odrážku</Button><Button variant="outline" size="icon" aria-label="Odebrat poslední odrážku" disabled={values.items.length <= 1} onClick={() => set({ items: values.items.slice(0, -1) })}><Minus className="h-4 w-4" /></Button><span className="text-xs text-deck-muted">{values.items.length}</span></div>}</Section>}
    {isIcon && <Section title="Ikona"><div className="flex flex-wrap gap-2"><Popover><PopoverTrigger asChild><Button variant="outline" size="sm">Barva ikony</Button></PopoverTrigger><PopoverContent className="w-auto p-2"><ColorPicker value={values.iconColor} onChange={(iconColor) => set({ iconColor })} allowNull nullLabel="Výchozí" /></PopoverContent></Popover><IconPickerDialog onPick={(picked) => set({ icon: picked.name, iconName: picked.name })} trigger={<Button variant="outline" size="sm">Změnit ikonu</Button>} /><Select value={values.width || "full"} onValueChange={(width) => set({ width })}><SelectTrigger className="w-32" aria-label="Velikost ikony"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">Malá</SelectItem><SelectItem value="medium">Střední</SelectItem><SelectItem value="full">Velká</SelectItem></SelectContent></Select></div></Section>}
    {isImage && <Section title="Obrázek"><div className="space-y-2"><Label className="text-xs" htmlFor="compact-image-alt">Alternativní text</Label><Input id="compact-image-alt" value={values.alt || ""} placeholder="Co je na obrázku…" onChange={(event) => set({ alt: event.target.value })} />{props.framed && <Button variant="outline" size="sm" onClick={() => set({ objectFit: values.objectFit === "cover" ? "contain" : "cover" })}><Maximize className="mr-2 h-4 w-4" />{values.objectFit === "cover" ? "Přizpůsobit celý obrázek" : "Oříznout do rámečku"}</Button>}<div className="flex gap-1">{(["left", "center", "right"] as const).map((alignment) => <Button key={alignment} size="sm" variant={(values.alignment || "center") === alignment ? "default" : "outline"} onClick={() => set({ alignment })}>{alignment === "left" ? "Vlevo" : alignment === "right" ? "Vpravo" : "Na střed"}</Button>)}</div></div></Section>}
    {isShape && <Section title="Tvar"><div className="space-y-2"><Select value={values.shapeKind || "rectangle"} onValueChange={(shapeKind) => set({ shapeKind })}><SelectTrigger aria-label="Typ tvaru"><SelectValue /></SelectTrigger><SelectContent>{SHAPE_KINDS.map((shape) => <SelectItem key={shape.value} value={shape.value}>{shape.label}</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap gap-2">{!strokeOnly && <Popover><PopoverTrigger asChild><Button variant="outline" size="sm">Výplň</Button></PopoverTrigger><PopoverContent className="w-auto space-y-2 p-2"><ColorPicker value={values.fillColor === "none" ? null : values.fillColor} onChange={(fillColor) => set({ fillColor: fillColor ?? "none", fillGradient: null })} allowNull nullLabel="Bez" /><GradientPicker value={values.fillGradient} onChange={(fillGradient) => set({ fillGradient })} /></PopoverContent></Popover>}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm">{strokeOnly ? "Barva linky" : "Obrys"}</Button></PopoverTrigger><PopoverContent className="w-auto p-2"><ColorPicker value={values.strokeColor === "none" ? null : values.strokeColor} onChange={(strokeColor) => set({ strokeColor: strokeColor ?? "none" })} allowNull nullLabel="Bez" /></PopoverContent></Popover></div><Label className="text-xs" htmlFor="compact-stroke-width">Šířka obrysu</Label><Input id="compact-stroke-width" type="number" min={0} max={20} value={values.strokeWidth ?? 2} onChange={(event) => set({ strokeWidth: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })} /></div></Section>}
    <Section title="Pořadí a schránka"><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" onClick={() => props.onMove("up")}><ArrowUp className="mr-1 h-4 w-4" />Posunout výš</Button><Button variant="outline" size="sm" onClick={() => props.onMove("down")}><ArrowDown className="mr-1 h-4 w-4" />Posunout níž</Button>{props.onCopyStyle && <Button variant={props.styleCopied ? "default" : "outline"} size="sm" onClick={props.onCopyStyle}><Paintbrush className="mr-1 h-4 w-4" />{props.styleCopied ? "Styl je připraven" : "Kopírovat styl"}</Button>}</div></Section>
    <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={props.onDelete}><Trash2 className="mr-2 h-4 w-4" />Smazat {selectedCount > 1 ? "vybrané prvky" : "prvek"}</Button>
  </PopoverContent></Popover>;

  return <div className="deck-compact-format" data-slide-toolbar="true" onMouseDown={(event) => event.preventDefault()}>
    {selectedCount > 1 ? <>{ALIGNMENTS.map(({ mode, Icon, label }) => <ToolButton key={mode} label={`${label} podle výběru`} onClick={() => props.onAlignGroup?.(mode)}><Icon /></ToolButton>)}</> : <>
      {isText && <>
        <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" className="deck-tool-icon" aria-label="Písmo a velikost" title="Písmo a velikost"><Type /></Button></PopoverTrigger><PopoverContent className="w-72 space-y-3 p-3"><div><Label className="text-xs">Písmo</Label><Select value={values.fontFamily || "inherit"} onValueChange={(fontFamily) => set({ fontFamily: fontFamily === "inherit" ? null : fontFamily })}><SelectTrigger className="mt-1" aria-label="Písmo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Podle tématu</SelectItem>{SLIDE_FONTS.map((font) => <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Velikost písma</Label><Select value={values.fontSize ? String(values.fontSize) : "inherit"} onValueChange={(fontSize) => set({ fontSize: fontSize === "inherit" ? null : Number(fontSize) })}><SelectTrigger className="mt-1" aria-label="Velikost písma"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Auto</SelectItem>{SLIDE_FONT_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size} pt</SelectItem>)}</SelectContent></Select></div>{block.type === "heading" && <div><Label className="text-xs">Úroveň nadpisu</Label><Select value={String(values.level || 2)} onValueChange={(level) => set({ level: Number(level) })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">H1</SelectItem><SelectItem value="2">H2</SelectItem><SelectItem value="3">H3</SelectItem></SelectContent></Select></div>}</PopoverContent></Popover>
        <ToolButton label="Tučně" active={!!values.bold} onClick={() => set({ bold: values.bold ? null : true })}><Bold /></ToolButton>
        <ToolButton label="Kurzíva" active={!!values.italic} onClick={() => set({ italic: values.italic ? null : true })}><Italic /></ToolButton>
        <ToolButton label="Podtržení" active={!!values.underline} onClick={() => set({ underline: values.underline ? null : true })}><Underline /></ToolButton>
        <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" className="deck-tool-icon" aria-label="Barva textu" title="Barva textu">{gradientCss(values.gradient) ? <span className="h-4 w-4 rounded-full border border-deck-line" style={{ backgroundImage: gradientCss(values.gradient) || undefined }} /> : <Palette style={{ color: values.color || undefined }} />}</Button></PopoverTrigger><PopoverContent className="w-auto space-y-3 p-3"><ColorPicker value={values.color} onChange={(color) => set({ color, gradient: null })} allowNull nullLabel="Výchozí" /><div className="border-t border-deck-line pt-2"><p className="mb-2 text-xs text-deck-muted">Barevný přechod textu</p><GradientPicker value={values.gradient} onChange={(gradient) => set({ gradient })} /></div></PopoverContent></Popover>
        {(["left", "center", "right"] as const).map((align) => { const Icon = align === "left" ? AlignLeft : align === "right" ? AlignRight : AlignCenter; return <ToolButton key={align} label={align === "left" ? "Zarovnat text vlevo" : align === "right" ? "Zarovnat text vpravo" : "Zarovnat text na střed"} active={(values.align || "left") === align} onClick={() => set({ align: align === "left" ? null : align })}><Icon /></ToolButton>; })}
      </>}
      {boxBackground}{animation}{layers}
      {props.onCopyBlock && <ToolButton label="Duplikovat prvek" onClick={props.onCopyBlock}><Copy /></ToolButton>}
    </>}
    {more}
  </div>;
}
