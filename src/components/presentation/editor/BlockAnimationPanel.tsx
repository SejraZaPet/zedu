import { useState } from "react";
import { Ban, Blend, ChevronDown, ChevronUp, Circle, Clock3, Expand, Eye, Move, MousePointerClick, Play, Sparkles, Type, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BLOCK_ANIMATION_PRESETS, animationOrders, blockAnimation, moveBlockAnimationOrder, slideClickAnimations, type BlockAnimationPreset, type SlideBlockAnimation } from "@/lib/slide-block-animations";
import type { Block } from "@/lib/textbook-config";

const ICONS = { none: Ban, appear: Eye, fade: Blend, rise: ChevronUp, shift: Move, pop: Sparkles, scale: Expand, blur: Circle, drift: WandSparkles, typewriter: Type } as const;
const TEXT_TYPES = new Set(["heading", "paragraph", "callout", "quote", "bullet_list", "summary", "two_column", "formula"]);

interface Props {
  slide: any;
  block?: Block | null;
  onChange: (animation: SlideBlockAnimation | null) => void;
  onPreview: () => void;
  onPlaySlide: () => void;
  onReorder: (blocks: Block[]) => void;
  onSelectBlock?: (id: string) => void;
  onClose?: () => void;
}

export default function BlockAnimationPanel({ slide, block, onChange, onPreview, onPlaySlide, onReorder, onSelectBlock, onClose }: Props) {
  const [tab, setTab] = useState(block ? "element" : "page");
  const [hoverPreview, setHoverPreview] = useState<{ preset: string; key: number } | null>(null);
  const blocks = (slide?.blocks || []) as Block[];
  const animation = blockAnimation(block);
  const isText = !!block && TEXT_TYPES.has(block.type);
  const clickItems = slideClickAnimations(blocks);
  const orderMap = animationOrders(blocks);
  const set = (patch: Partial<SlideBlockAnimation>) => onChange({ ...animation, ...patch });
  const choose = (preset: BlockAnimationPreset) => {
    if (preset === "none") onChange(null);
    else set({ preset, ...(preset === "typewriter" ? { direction: undefined } : {}) });
    onPreview();
  };
  const tiles = (items: readonly typeof BLOCK_ANIMATION_PRESETS[number][]) => <div className="grid grid-cols-3 gap-2">{items.map((item) => {
    const Icon = ICONS[item.value];
    const selected = item.value === "none" ? !block || animation.preset === "none" : animation.preset === item.value;
    return <button key={item.value} type="button" aria-label={`Animace ${item.label}`} aria-pressed={selected}
      className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-lg border p-2 text-[11px] transition-colors ${selected ? "border-deck-violet bg-deck-soft text-deck-violet-deep" : "border-deck-line bg-deck-panel text-deck-text hover:border-deck-violet"}`}
      onMouseEnter={() => setHoverPreview({ preset: item.value, key: Date.now() })}
      onFocus={() => setHoverPreview({ preset: item.value, key: Date.now() })}
      onClick={() => choose(item.value)}>
      <span className="flex h-7 w-9 items-center justify-center overflow-hidden">
        <Icon key={hoverPreview?.preset === item.value ? hoverPreview.key : "static"} className={`h-5 w-5 ${hoverPreview?.preset === item.value && item.value !== "none" ? `slide-block-anim slide-block-anim-${item.value}` : ""}`} style={{ "--slide-block-animation-duration": ".6s", "--slide-block-animation-delay": "0s" } as React.CSSProperties} />
      </span>
      <span>{item.label}</span>
    </button>;
  })}</div>;
  const orderList = clickItems.length > 0 && <section className="space-y-2 border-t border-deck-line pt-3">
    <h4 className="text-xs font-semibold text-deck-violet-deep">Pořadí při kliknutí</h4>
    <div className="space-y-1">{clickItems.map((item, index) => {
      const itemBlock = blocks[item.index];
      const label = String((itemBlock?.props as any)?.title || (itemBlock?.props as any)?.text || (itemBlock?.type === "activity" ? "Aktivita" : `Prvek ${item.index + 1}`)).replace(/<[^>]+>/g, "").trim();
      return <div key={item.id} className="flex items-center gap-1 rounded-md border border-deck-line bg-deck-panel p-1.5">
        <button type="button" className="min-w-0 flex-1 text-left text-xs" onClick={() => onSelectBlock?.(item.id)}><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-deck-soft font-semibold text-deck-violet-deep">{index + 1}</span><span className="align-middle">{label || `Prvek ${item.index + 1}`}</span></button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} aria-label={`Přesunout ${label} výš`} onClick={() => onReorder(moveBlockAnimationOrder(blocks, item.id, -1))}><ChevronUp /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === clickItems.length - 1} aria-label={`Přesunout ${label} níž`} onClick={() => onReorder(moveBlockAnimationOrder(blocks, item.id, 1))}><ChevronDown /></Button>
      </div>;
    })}</div>
  </section>;

  return <div className="space-y-4" aria-label="Panel Animace">
    <div className="flex items-center justify-between"><h3 className="font-deck-heading text-base text-deck-violet-deep">Animace</h3>{onClose && <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Zavřít animace" onClick={onClose}><X /></Button>}</div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="page">Strana</TabsTrigger><TabsTrigger value="element" disabled={!block}>{isText ? "Text" : "Prvek"}</TabsTrigger></TabsList>
      <TabsContent value="page" className="space-y-4 pt-3">
        <Button type="button" variant="outline" className="w-full gap-2" onClick={onPlaySlide}><Play />Přehrát celý slide</Button>
        <div><h4 className="mb-2 text-xs font-semibold text-deck-violet-deep">Animace stránek</h4><p className="text-xs leading-relaxed text-deck-muted">Přehrajte všechny animované prvky najednou. Stylizované balíčky stránek doplní další etapa.</p></div>
        {blocks.length > 0 && <div className="space-y-1"><h4 className="text-xs font-semibold text-deck-violet-deep">Prvky na straně</h4>{blocks.map((item, index) => { const spec = blockAnimation(item, index); return <button key={item.id} type="button" onClick={() => onSelectBlock?.(item.id)} className="flex w-full items-center justify-between rounded-md border border-deck-line px-2 py-2 text-left text-xs hover:bg-deck-soft"><span>{item.type === "activity" ? "Aktivita" : `Prvek ${index + 1}`}</span><span className="text-deck-muted">{BLOCK_ANIMATION_PRESETS.find((preset) => preset.value === spec.preset)?.label}{orderMap.has(item.id) ? ` · ${orderMap.get(item.id)}.` : ""}</span></button>; })}</div>}
        {orderList}
      </TabsContent>
      <TabsContent value="element" className="space-y-4 pt-3">
        {block && <>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-deck-line bg-deck-panel p-3"><div><Label htmlFor="animation-click" className="text-xs">Zobrazit při kliknutí</Label><p className="mt-1 text-[11px] text-deck-muted">Jinak se spustí po příchodu slidu.</p></div><Switch id="animation-click" checked={animation.trigger === "click" && animation.preset !== "none"} onCheckedChange={(checked) => set({ trigger: checked ? "click" : "auto", order: checked ? animation.order || clickItems.length : animation.order })} /></div>
          {isText && <section><h4 className="mb-2 text-xs font-semibold text-deck-violet-deep">Navržené</h4>{tiles(BLOCK_ANIMATION_PRESETS.filter((item) => "textOnly" in item && item.textOnly))}</section>}
          <section><h4 className="mb-2 text-xs font-semibold text-deck-violet-deep">Obecné</h4>{tiles(BLOCK_ANIMATION_PRESETS.filter((item) => !("textOnly" in item && item.textOnly)))}</section>
          <section className="space-y-3 border-t border-deck-line pt-3">
            <div><div className="mb-1 flex justify-between"><Label htmlFor="animation-speed" className="text-xs">Rychlost / délka</Label><span className="text-xs text-deck-muted">{animation.speed.toFixed(1).replace(".", ",")} s</span></div><input id="animation-speed" aria-label="Rychlost animace" type="range" min="0.2" max="2" step="0.1" value={animation.speed} onChange={(event) => set({ speed: Number(event.target.value) })} className="w-full accent-deck-violet" /></div>
            <div><div className="mb-1 flex justify-between"><Label htmlFor="animation-delay" className="text-xs">Zpoždění</Label><span className="text-xs text-deck-muted">{animation.delay.toFixed(1).replace(".", ",")} s</span></div><input id="animation-delay" aria-label="Zpoždění animace" type="range" min="0" max="10" step="0.1" value={animation.delay} onChange={(event) => set({ delay: Number(event.target.value) })} className="w-full accent-deck-violet" /></div>
            {["rise", "shift", "drift"].includes(animation.preset) && <div><Label className="text-xs">Směr</Label><Select value={animation.direction || (animation.preset === "rise" ? "up" : "left")} onValueChange={(direction) => set({ direction: direction as SlideBlockAnimation["direction"] })}><SelectTrigger className="mt-1" aria-label="Směr animace"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="up">Nahoru</SelectItem><SelectItem value="down">Dolů</SelectItem><SelectItem value="left">Vlevo</SelectItem><SelectItem value="right">Vpravo</SelectItem></SelectContent></Select></div>}
            <Button type="button" variant="outline" className="w-full gap-2" onClick={onPreview}><Play />Přehrát prvek</Button>
            <Button type="button" variant="ghost" className="w-full text-destructive" disabled={animation.preset === "none"} onClick={() => { onChange(null); onPreview(); }}>Odebrat animaci</Button>
          </section>
          {orderList}
        </>}
      </TabsContent>
    </Tabs>
    <div className="flex items-center gap-2 text-[11px] text-deck-muted"><MousePointerClick className="h-3.5 w-3.5" /><span>Pořadí kliknutí se uloží až uložením prezentace.</span></div>
  </div>;
}
