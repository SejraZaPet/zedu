import { memo, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Eye, EyeOff, MoreHorizontal, MoveHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SlideBody, STAGE_H, STAGE_W } from "@/components/admin/SlideCanvas";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";
import { activityTypeLabel } from "@/lib/presentation-activity";
import { slideBackgroundOverrideStyle } from "@/lib/slide-typography";
import { isActivitySlide } from "@/lib/presentation-slide-actions";
import SlideInsertMenu, { type SlideInsertKind } from "@/components/presentation/editor/SlideInsertMenu";
import SlideTransitionPopover from "@/components/presentation/editor/SlideTransitionPopover";
import type { SlideTransitionConfig } from "@/lib/slide-transitions";

const thumbnailStep = () => typeof window !== "undefined" && (window.innerWidth <= 1024 || window.matchMedia?.("(pointer: coarse)").matches) ? 232 : 184;
const VIRTUALIZE_AFTER = 30;

function LazySlidePreview({ slide, themeId }: { slide: any; themeId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visible || !ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "240px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <div ref={ref} className="h-full w-full">
      {visible && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${136 / STAGE_W})` }}>
          <SlideBody slide={slide} themeId={themeId} />
        </div>
      )}
    </div>
  );
}

type SelectSlide = (index: number, event?: Pick<ReactMouseEvent, "shiftKey" | "ctrlKey" | "metaKey">) => void;

interface ThumbnailProps {
  slide: any;
  slides: any[];
  index: number;
  slideCount: number;
  selectedIndices: number[];
  themeId: string;
  active: boolean;
  selected: boolean;
  onSelect: SelectSlide;
  onDelete: (indices: number[]) => void;
  onDuplicate: (indices: number[]) => void;
  onMoveEdge: (indices: number[], edge: "start" | "end") => void;
  onToggleHidden: (indices: number[]) => void;
  onInsert: (kind: SlideInsertKind, index: number) => void;
  onTransitionChange: (index: number, config: SlideTransitionConfig) => void;
  onApplyTransitionAll: (config: SlideTransitionConfig) => void;
}

const Thumbnail = memo(function Thumbnail({
  slide, slides, index, slideCount, selectedIndices, themeId, active, selected,
  onSelect, onDelete, onDuplicate, onMoveEdge, onToggleHidden, onInsert, onTransitionChange, onApplyTransitionAll,
}: ThumbnailProps) {
  const id = String(slide?.slideId || index);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPointRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const title = String(slide?.projector?.headline || slide?.activitySpec?.question || `Slide ${index + 1}`);
  const activity = isActivitySlide(slide);
  const hidden = slide?.hiddenInPresentation === true;
  const actionIndices = selected && selectedIndices.length ? selectedIndices : [index];
  const allSelected = actionIndices.length >= slideCount;

  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
    longPressPointRef.current = null;
  };
  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Compose with the sortable activator: replacing it prevents every drag.
    listeners?.onPointerDown?.(event);
    if (event.pointerType === "mouse") return;
    cancelLongPress();
    longPressPointRef.current = { x: event.clientX, y: event.clientY };
    longPressRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      if (!selected) onSelect(index);
      setMenuOpen(true);
    }, 550);
  };
  useEffect(() => cancelLongPress, []);
  useEffect(() => { if (isDragging) cancelLongPress(); }, [isDragging]);

  const actionButton = (label: string, onClick: () => void, icon: ReactNode, disabled = false, destructive = false) => (
    <button
      type="button"
      className={`deck-thumbnail-action ${destructive ? "text-destructive" : "text-deck-ink"}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
    >{icon}</button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative w-[136px] shrink-0 ${isDragging ? "z-10 opacity-40" : ""}`}
      data-testid={`slide-thumbnail-${index}`}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <div className="relative">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            data-slide-thumbnail={index}
            onClick={(event) => {
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              onSelect(index, event);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Delete" && event.key !== "Backspace") {
                listeners?.onKeyDown?.(event);
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              onDelete(actionIndices);
            }}
            onContextMenu={(event) => { event.preventDefault(); if (!selected) onSelect(index); setMenuOpen(true); }}
            onPointerDown={pointerDown}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerMove={(event) => {
              const start = longPressPointRef.current;
              if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) cancelLongPress();
            }}
            aria-label={`Otevřít slide ${index + 1}: ${title}${activity ? ", obsahuje aktivitu" : ""}${hidden ? ", skrytý při promítání" : ""}`}
            aria-current={active ? "true" : undefined}
            aria-pressed={selected}
            className={`deck-thumbnail touch-none ${active ? "deck-thumbnail--active" : ""} ${selected && !active ? "ring-2 ring-deck-violet" : ""} ${hidden ? "opacity-65" : ""}`}
            style={{ ...themeStageStyle(getPresentationTheme(themeId)), ...slideBackgroundOverrideStyle(slide) }}
          >
            <LazySlidePreview slide={slide} themeId={themeId} />
            <span className="absolute bottom-1 left-1 rounded bg-deck-panel/90 px-1.5 text-[10px] font-bold text-deck-ink">{index + 1}</span>
            {activity && (
              <span className="absolute bottom-1 right-1 rounded-full bg-deck-teal px-2 py-0.5 text-[9px] font-bold text-deck-violet-deep" title={slide?.activitySpec?.activityType ? activityTypeLabel(slide.activitySpec.activityType) : "Aktivita"}>
                Aktivita
              </span>
            )}
            {hidden && <span className="absolute left-1 top-1 rounded-full bg-deck-panel/95 p-1 text-deck-violet-deep" title="Skryto při promítání"><EyeOff className="h-3 w-3" /></span>}
          </button>
          <div className={`deck-thumbnail-actions ${selected ? "opacity-100" : ""}`}>
            {actionButton(`Duplikovat ${actionIndices.length > 1 ? `${actionIndices.length} slidy` : `slide ${index + 1}`}`, () => onDuplicate(actionIndices), <Copy className="h-3.5 w-3.5" />)}
            <DropdownMenuTrigger asChild>
              <button type="button" className="deck-thumbnail-action text-deck-ink" aria-label={`Další akce slidu ${index + 1}`} title="Další akce slidu" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </DropdownMenuTrigger>
          </div>
        </div>
        <DropdownMenuContent align="end" className="z-[125] w-60">
          <DropdownMenuItem onSelect={() => onDuplicate(actionIndices)}><Copy className="mr-2 h-4 w-4" />Duplikovat{actionIndices.length > 1 ? ` (${actionIndices.length})` : ""}</DropdownMenuItem>
          <DropdownMenuItem disabled={allSelected} onSelect={() => onMoveEdge(actionIndices, "start")}><MoveHorizontal className="mr-2 h-4 w-4" />Přesunout na začátek</DropdownMenuItem>
          <DropdownMenuItem disabled={allSelected} onSelect={() => onMoveEdge(actionIndices, "end")}><MoveHorizontal className="mr-2 h-4 w-4 rotate-180" />Přesunout na konec</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggleHidden(actionIndices)}>{hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}{hidden ? "Zobrazit při promítání" : "Skrýt při promítání"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={slideCount <= 1} className="text-destructive focus:text-destructive" onSelect={() => onDelete(actionIndices)}>
            <Trash2 className="mr-2 h-4 w-4" />Smazat slide{actionIndices.length > 1 ? ` (${actionIndices.length})` : ""}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className={`mt-1 truncate text-center text-[11px] ${selected ? "font-semibold text-deck-violet-deep" : "text-deck-muted"}`} title={title}>{index + 1}. {title}</p>
      {index < slideCount - 1 && (
        <div className={`deck-thumbnail-gap-actions ${slides[index + 1]?.transitionStyle && slides[index + 1]?.transitionStyle !== "cut" ? "deck-thumbnail-gap-actions--active" : ""}`}>
          <SlideInsertMenu index={index + 1} onPick={onInsert} />
          <SlideTransitionPopover slides={slides} index={index + 1} onChange={onTransitionChange} onApplyAll={onApplyTransitionAll} />
        </div>
      )}
    </div>
  );
});

interface Props {
  slides: any[];
  activeIndex: number;
  selectedIndices?: number[];
  themeId: string;
  onSelect: SelectSlide;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  onDelete: (indices: number[]) => void;
  onDuplicate: (indices: number[]) => void;
  onMoveEdge: (indices: number[], edge: "start" | "end") => void;
  onToggleHidden: (indices: number[]) => void;
  onInsert: (kind: SlideInsertKind, index: number) => void;
  onTransitionChange: (index: number, config: SlideTransitionConfig) => void;
  onApplyTransitionAll: (config: SlideTransitionConfig) => void;
  open?: boolean;
  onToggle?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

/** Dolní pás miniatur: dnd-kit, líné náhledy a horizontální virtualizace nad 30 slidů. */
export default function PresentationThumbnails({
  slides, activeIndex, selectedIndices = [activeIndex], themeId, onSelect, onMove, onAdd,
  onDelete, onDuplicate, onMoveEdge, onToggleHidden, onInsert, onTransitionChange, onApplyTransitionAll,
  open = true, onToggle, onPrevious, onNext,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(slides.length, VIRTUALIZE_AFTER) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => slides.map((slide, index) => String(slide?.slideId || index)), [slides]);
  const virtual = slides.length > VIRTUALIZE_AFTER;

  const updateRange = () => {
    if (!virtual || !scrollRef.current) return;
    const el = scrollRef.current;
    const step = thumbnailStep();
    const start = Math.max(0, Math.floor(el.scrollLeft / step) - 3);
    const count = Math.ceil(el.clientWidth / step) + 7;
    setRange({ start, end: Math.min(slides.length, start + count) });
  };
  useEffect(() => {
    if (!virtual) { setRange({ start: 0, end: slides.length }); return; }
    updateRange();
    setRange((old) => activeIndex < old.start
      ? { start: Math.max(0, activeIndex - 2), end: Math.min(slides.length, activeIndex + 8) }
      : activeIndex >= old.end
        ? { start: Math.max(0, activeIndex - 7), end: Math.min(slides.length, activeIndex + 3) }
        : old);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, activeIndex, virtual]);

  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };
  const rendered = virtual ? slides.slice(range.start, range.end) : slides;

  if (!open) return (
    <footer className="deck-thumbnail-collapsed" aria-label="Navigace slidy" data-testid="presentation-thumbnails-collapsed">
      {onToggle && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle} aria-label="Zobrazit miniatury (Alt+M)" title="Zobrazit miniatury (Alt+M)"><ChevronUp className="h-4 w-4" /></Button>}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevious} disabled={activeIndex <= 0} aria-label="Předchozí slide" title="Předchozí slide"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-deck-muted" aria-live="polite">{activeIndex + 1} / {slides.length}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={activeIndex >= slides.length - 1} aria-label="Další slide" title="Další slide"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </footer>
  );

  return (
    <footer className="deck-thumbnail-strip" aria-label="Slidy prezentace" data-testid="presentation-thumbnails">
      {onToggle && <div className="flex h-full items-center border-r border-deck-line px-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle} aria-label="Skrýt miniatury (Alt+M)" title="Skrýt miniatury (Alt+M)"><ChevronDown className="h-4 w-4" /></Button></div>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div ref={scrollRef} onScroll={updateRange} className="deck-thumbnail-list flex min-w-0 flex-1 items-start overflow-x-auto px-4 py-2" aria-label="Miniatury; Shift nebo Ctrl vybere více slidů">
            {virtual && range.start > 0 && <div aria-hidden className="shrink-0" style={{ width: range.start * thumbnailStep() - (thumbnailStep() - 136) }} />}
            {rendered.map((slide, localIndex) => {
              const index = virtual ? range.start + localIndex : localIndex;
              return <Thumbnail key={ids[index]} slide={slide} slides={slides} index={index} slideCount={slides.length} selectedIndices={selectedIndices} themeId={themeId} active={index === activeIndex} selected={selectedIndices.includes(index)} onSelect={onSelect} onDelete={onDelete} onDuplicate={onDuplicate} onMoveEdge={onMoveEdge} onToggleHidden={onToggleHidden} onInsert={onInsert} onTransitionChange={onTransitionChange} onApplyTransitionAll={onApplyTransitionAll} />;
            })}
            {virtual && range.end < slides.length && <div aria-hidden className="shrink-0" style={{ width: (slides.length - range.end) * thumbnailStep() - (thumbnailStep() - 136) }} />}
            <button type="button" onClick={onAdd} className="deck-add-slide" aria-label="Přidat slide">
              <Plus className="h-5 w-5" /> Slide
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </footer>
  );
}
