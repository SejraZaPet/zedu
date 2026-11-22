import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight, Ban, Blend, Circle, Layers, Move, Paintbrush, PanelLeft,
  ScanSearch, Slice, Waves, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  SLIDE_TRANSITION_DIRECTIONS,
  SLIDE_TRANSITIONS,
  slideTransitionClass,
  slideTransitionStyle,
  transitionConfigFromSlide,
  transitionFromSlides,
  type SlideTransition,
  type SlideTransitionConfig,
  type SlideTransitionDirection,
} from "@/lib/slide-transitions";

const TRANSITION_ICONS: Record<SlideTransition, LucideIcon> = {
  cut: Ban,
  fade: Blend,
  push: Move,
  "circle-wipe": Circle,
  "color-wipe": Paintbrush,
  "line-wipe": PanelLeft,
  "match-move": ScanSearch,
  flow: Waves,
  stack: Layers,
  slice: Slice,
};

export function TransitionMiniPreview({ config, icon: Icon }: { config: SlideTransitionConfig; icon?: LucideIcon }) {
  return (
    <span className="deck-transition-mini" aria-hidden="true">
      <span className="deck-transition-mini-before" />
      <span
        key={`${config.style}-${config.direction}`}
        className={`deck-transition-mini-after ${slideTransitionClass(config.style, config.direction)}`}
        style={slideTransitionStyle({ ...config, duration: Math.min(config.duration, 0.8) })}
      />
      {Icon && <Icon className="deck-transition-mini-icon" strokeWidth={1.8} />}
    </span>
  );
}

export default function SlideTransitionPopover({
  slides,
  index,
  onChange,
  onApplyAll,
  trigger,
  compact = false,
}: {
  slides: any[];
  /** Index vstupního slidu N+1. */
  index: number;
  onChange: (index: number, config: SlideTransitionConfig) => void;
  onApplyAll: (config: SlideTransitionConfig) => void;
  trigger?: ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fallback = transitionFromSlides(slides);
  const [draft, setDraft] = useState<SlideTransitionConfig>(() => transitionConfigFromSlide(slides[index], fallback));
  const active = slides[index]?.transitionStyle && slides[index]?.transitionStyle !== "cut";
  const displayedStyle = open ? draft.style : transitionConfigFromSlide(slides[index], fallback).style;
  const label = SLIDE_TRANSITIONS.find((item) => item.value === displayedStyle)?.label || "Žádný";

  useEffect(() => {
    if (open) setDraft(transitionConfigFromSlide(slides[index], transitionFromSlides(slides)));
    // Obnovit lokální návrh jen při otevření konkrétního přechodu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  const update = (patch: Partial<SlideTransitionConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(index, next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            className={`deck-transition-gap-button ${active ? "deck-transition-gap-button--active" : ""}`}
            aria-label={`Přechod mezi slidem ${index} a ${index + 1}: ${label}`}
            title={`Přechod: ${label}`}
            data-transition-active={active ? "true" : undefined}
          >
            <Blend className="h-3.5 w-3.5" />
            {active && <span className="deck-transition-active-dot" aria-hidden="true" />}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className={`${compact ? "w-[min(380px,calc(100vw-24px))]" : "w-[380px]"} border-deck-line bg-deck-panel p-4 font-deck-body text-deck-ink`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-deck-heading text-lg uppercase tracking-wide text-deck-violet-deep">Přechody</h3>
            <p className="sr-only">Ze slidu {index} na slide {index + 1}. Náhled se přehraje po najetí, zaostření nebo výběru.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-deck-muted hover:bg-deck-soft hover:text-deck-violet-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deck-teal" aria-label="Zavřít přechody" title="Zavřít">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Přechody mezi slidy">
          {SLIDE_TRANSITIONS.map((item) => {
            const config = { ...draft, style: item.value };
            const selected = draft.style === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={item.label}
                title={item.hint}
                onClick={() => update({ style: item.value })}
                className={`deck-transition-option ${selected ? "deck-transition-option--selected" : ""}`}
              >
                <TransitionMiniPreview config={config} icon={TRANSITION_ICONS[item.value]} />
                <span className="min-h-8 text-center text-[11px] font-semibold leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
        {draft.style === "push" && (
          <div className="mt-4">
            <Label htmlFor={`transition-direction-${index}`}>Směr posunutí</Label>
            <Select value={draft.direction} onValueChange={(value) => update({ direction: value as SlideTransitionDirection })}>
              <SelectTrigger id={`transition-direction-${index}`} className="mt-1 border-deck-line"><SelectValue /></SelectTrigger>
              <SelectContent>{SLIDE_TRANSITION_DIRECTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label htmlFor={`transition-duration-${index}`}>Délka</Label>
            <output htmlFor={`transition-duration-${index}`} className="text-xs font-semibold tabular-nums text-deck-violet-deep">{draft.duration.toFixed(1).replace(".", ",")} s</output>
          </div>
          <input
            id={`transition-duration-${index}`}
            type="range"
            min={MIN_TRANSITION_DURATION}
            max={MAX_TRANSITION_DURATION}
            step={0.05}
            value={draft.duration}
            onChange={(event) => update({ duration: Number(event.target.value) })}
            aria-label="Délka přechodu v sekundách"
            className="min-h-11 w-full accent-deck-violet"
          />
          <div className="mt-1 flex justify-between text-[10px] text-deck-muted"><span>0,2 s</span><span>2 s</span></div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 min-h-11 w-full border-deck-line text-deck-violet-deep"
          onClick={() => { onApplyAll(draft); setOpen(false); }}
        >
          <ArrowRight className="mr-2 h-4 w-4" />Použít na všechny přechody
        </Button>
      </PopoverContent>
    </Popover>
  );
}
