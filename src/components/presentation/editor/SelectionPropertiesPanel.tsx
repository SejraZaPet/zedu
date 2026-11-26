import type { ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Eye, EyeOff, Italic, Lock, LockOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_ROUNDED_RADIUS_PX, frameSizePx, isRoundableRect, maxCornerRadiusPx, resolveCornerRadiusPx } from "@/lib/shape-corner-radius";
import ColorPicker from "@/components/admin/ColorPicker";
import GradientPicker from "@/components/admin/GradientPicker";
import ThemeGalleryPopover from "@/components/admin/ThemeGalleryPopover";
import { SingleBlockEditor } from "@/components/admin/BlockEditor";
import { SLIDE_BACKGROUND_COLORS, SLIDE_FONTS, SLIDE_FONT_SIZES } from "@/lib/slide-typography";
import { SLIDE_LAYOUTS, type SlideLayout } from "@/components/admin/SlideCanvas";
import type { Block } from "@/lib/textbook-config";
import { BLOCK_TYPE_LABELS } from "./editor-labels";

interface Props {
  slide: any;
  block: Block | null;
  themeId: string;
  onThemeChange: (themeId: string) => void;
  onSlideChange: (patch: Record<string, unknown>) => void;
  onBlockChange: (id: string, patch: Record<string, unknown>) => void;
  onClose?: () => void;
  children?: ReactNode;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-t border-deck-line pt-4"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">{title}</h3>{children}</section>;
}

/** Pravý panel pro text, obrázek, tvar nebo – bez výběru – vlastnosti slidu. */
export default function SelectionPropertiesPanel({ slide, block, themeId, onThemeChange, onSlideChange, onBlockChange, onClose, children }: Props) {
  const props = (block?.props || {}) as Record<string, any>;
  const setProps = (patch: Record<string, unknown>) => {
    if (block) onBlockChange(block.id, { props: { ...props, ...patch } });
  };
  const isText = !!block && ["heading", "paragraph", "callout", "quote", "bullet_list", "summary", "two_column", "formula"].includes(block.type);
  const isShape = block?.type === "shape";
  const isImage = block?.type === "image";

  return (
    <aside className="deck-properties-panel" aria-label="Vlastnosti" data-testid="selection-properties">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-deck-muted">Vlastnosti</p>
          <h2 className="font-deck-heading text-lg uppercase tracking-wide text-deck-violet-deep">{block ? BLOCK_TYPE_LABELS[block.type] || "Prvek" : "Slide"}</h2>
        </div>
        {onClose && <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label="Skrýt vlastnosti"><X className="h-4 w-4" /></Button>}
      </div>

      {block ? (
        <>
          {isText && (
            <Section title="Text">
              <div className="grid grid-cols-[1fr_76px] gap-2">
                <Select value={props.fontFamily || "inherit"} onValueChange={(v) => setProps({ fontFamily: v === "inherit" ? null : v })}>
                  <SelectTrigger aria-label="Písmo"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="inherit">Podle motivu</SelectItem>{SLIDE_FONTS.map((font) => <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={props.fontSize ? String(props.fontSize) : "inherit"} onValueChange={(v) => setProps({ fontSize: v === "inherit" ? null : Number(v) })}>
                  <SelectTrigger aria-label="Velikost písma"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="inherit">Auto</SelectItem>{SLIDE_FONT_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant={props.bold ? "default" : "outline"} size="icon" aria-label="Tučně" aria-pressed={!!props.bold} onClick={() => setProps({ bold: props.bold ? null : true })}><Bold className="h-4 w-4" /></Button>
                <Button type="button" variant={props.italic ? "default" : "outline"} size="icon" aria-label="Kurzíva" aria-pressed={!!props.italic} onClick={() => setProps({ italic: props.italic ? null : true })}><Italic className="h-4 w-4" /></Button>
                {(["left", "center", "right"] as const).map((align) => {
                  const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                  const label = align === "left" ? "Zarovnat vlevo" : align === "center" ? "Zarovnat na střed" : "Zarovnat vpravo";
                  return <Button key={align} type="button" variant={(props.align || "left") === align ? "default" : "outline"} size="icon" aria-label={label} onClick={() => setProps({ align: align === "left" ? null : align })}><Icon className="h-4 w-4" /></Button>;
                })}
              </div>
              <div><Label className="mb-2 block text-xs">Barva textu</Label><ColorPicker value={props.color} onChange={(color) => setProps({ color, gradient: null })} allowNull nullLabel="Podle motivu" /></div>
            </Section>
          )}

          {(isShape || isImage) && (
            <Section title={isShape ? "Vzhled tvaru" : "Vzhled obrázku"}>
              {isShape && <>
                <div><Label className="mb-2 block text-xs">Výplň</Label><ColorPicker value={props.fillColor === "none" ? null : props.fillColor} onChange={(fillColor) => setProps({ fillColor: fillColor ?? "none", fillGradient: null })} allowNull nullLabel="Bez výplně" /></div>
                <div><Label className="mb-2 block text-xs">Ohraničení</Label><ColorPicker value={props.strokeColor === "none" ? null : props.strokeColor} onChange={(strokeColor) => setProps({ strokeColor: strokeColor ?? "none" })} allowNull nullLabel="Bez ohraničení" /></div>
                <Label className="text-xs" htmlFor="shape-radius">Zaoblení</Label>
                <Select value={props.shapeKind || "rectangle"} onValueChange={(shapeKind) => setProps(shapeKind === "rectangle" ? { shapeKind, cornerRadiusPx: 0 } : shapeKind === "rounded-rect" && !(Number(props.cornerRadiusPx) > 0) ? { shapeKind, cornerRadiusPx: DEFAULT_ROUNDED_RADIUS_PX } : { shapeKind })}><SelectTrigger id="shape-radius"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rectangle">Ostré rohy</SelectItem><SelectItem value="rounded-rect">Zaoblené rohy</SelectItem><SelectItem value="circle">Kruh</SelectItem></SelectContent></Select>
                {isRoundableRect(props.shapeKind) && (() => {
                  const sz = frameSizePx((block as any).frame, Number(props.height) || 160);
                  const max = Math.floor(maxCornerRadiusPx(sz.w, sz.h));
                  const value = Math.round(resolveCornerRadiusPx(props, sz.w, sz.h));
                  const commit = (raw: number) => { if (Number.isFinite(raw)) setProps({ cornerRadiusPx: Math.min(max, Math.max(0, Math.round(raw))) }); };
                  return (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2"><Label htmlFor="shape-radius-px" className="text-xs">Poloměr rohů (px)</Label>
                        <Input id="shape-radius-px" type="number" min={0} max={max} step={1} value={value} onChange={(e) => commit(Number(e.target.value))} className="h-8 w-20 text-right" /></div>
                      <input aria-label="Poloměr rohů" type="range" min={0} max={max} step={1} value={value} onChange={(e) => commit(Number(e.target.value))} className="w-full accent-deck-violet" />
                    </div>
                  );
                })()}
              </>}
              {isImage && <Select value={props.objectFit || "contain"} onValueChange={(objectFit) => setProps({ objectFit })}><SelectTrigger aria-label="Vyplnění obrázku"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contain">Přizpůsobit bez oříznutí</SelectItem><SelectItem value="cover">Vyplnit a oříznout</SelectItem></SelectContent></Select>}
              <div>
                <div className="mb-1 flex justify-between"><Label htmlFor="element-opacity" className="text-xs">Průhlednost</Label><span className="text-xs text-deck-muted">{props.opacity ?? 100} %</span></div>
                <input id="element-opacity" type="range" min={10} max={100} step={5} value={props.opacity ?? 100} onChange={(e) => setProps({ opacity: Number(e.target.value) })} className="w-full accent-deck-violet" />
              </div>
            </Section>
          )}

          <Section title="Pokročilé úpravy">
            <SingleBlockEditor block={block} onChange={(nextProps) => setProps(nextProps)} />
          </Section>
          <Section title="Viditelnost a zámek">
            <div className="flex items-center justify-between gap-3"><Label className="flex items-center gap-2 text-xs" htmlFor="block-visible">{block.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Zobrazit prvek</Label><Switch id="block-visible" checked={block.visible !== false} onCheckedChange={(visible) => onBlockChange(block.id, { visible })} /></div>
            <div className="flex items-center justify-between gap-3"><Label className="flex items-center gap-2 text-xs" htmlFor="block-locked">{(block as any).locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />} Zamknout úpravy</Label><Switch id="block-locked" checked={!!(block as any).locked} onCheckedChange={(locked) => onBlockChange(block.id, { locked })} /></div>
          </Section>
        </>
      ) : (
        <>
          {slide?.projector?.headline ? (
            <Section title="Nadpis slidu">
              <Button variant="outline" size="sm" className="w-full" onClick={() => onSlideChange({ projector: { ...(slide.projector || {}), headline: "" } })}>Odstranit nadpis</Button>
            </Section>
          ) : null}
          <Section title="Pozadí a motiv">
            <ThemeGalleryPopover themeId={themeId} onChange={onThemeChange} />
            <Button variant="outline" size="sm" className="w-full" onClick={() => onSlideChange({ backgroundOverride: null })}>Podle motivu prezentace</Button>
            <ColorPicker value={slide?.backgroundOverride?.color || null} onChange={(color) => onSlideChange({ backgroundOverride: color ? { color } : null })} swatches={SLIDE_BACKGROUND_COLORS} />
            <GradientPicker value={slide?.backgroundOverride?.gradient || null} onChange={(gradient) => onSlideChange({ backgroundOverride: gradient ? { gradient } : null })} />
          </Section>
          <Section title="Rozvržení slidu">
            <Select value={(slide?.layout as SlideLayout) || "full"} onValueChange={(layout) => onSlideChange({ layout })}><SelectTrigger aria-label="Rozvržení slidu"><SelectValue /></SelectTrigger><SelectContent>{SLIDE_LAYOUTS.map((layout) => <SelectItem key={layout.value} value={layout.value}>{layout.label}</SelectItem>)}</SelectContent></Select>
            <Label className="text-xs" htmlFor="slide-section">Název sekce</Label>
            <Input id="slide-section" value={slide?.sectionTitle || ""} onChange={(e) => onSlideChange({ sectionTitle: e.target.value || undefined })} placeholder="Např. Opakování" />
            <Label className="text-xs" htmlFor="student-instructions">Instrukce pro žáka</Label>
            <Input id="student-instructions" value={slide?.device?.instructions || ""} onChange={(e) => onSlideChange({ device: { ...slide?.device, instructions: e.target.value } })} />
          </Section>
          <Section title="Poznámky řečníka">
            <div className="deck-speaker-notes">
              <p className="mb-2 text-[11px] text-deck-muted">Poznámky vidíte jen vy, žáci je neuvidí.</p>
              <Textarea aria-label="Poznámky řečníka" rows={6} value={slide?.teacherNotes || ""} onChange={(e) => onSlideChange({ teacherNotes: e.target.value })} placeholder="Co chcete k tomuto slidu říct…" className="border-deck-line bg-transparent" />
            </div>
          </Section>
        </>
      )}
      {children}
    </aside>
  );
}
