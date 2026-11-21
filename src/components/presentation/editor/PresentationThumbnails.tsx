import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { SlideBody, STAGE_H, STAGE_W } from "@/components/admin/SlideCanvas";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";
import { activityTypeLabel } from "@/lib/presentation-activity";

const ITEM_W = 152;
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

const Thumbnail = memo(function Thumbnail({ slide, index, themeId, active, onSelect }: {
  slide: any; index: number; themeId: string; active: boolean; onSelect: (index: number) => void;
}) {
  const id = String(slide?.slideId || index);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const title = String(slide?.projector?.headline || slide?.activitySpec?.question || `Slide ${index + 1}`);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`w-[136px] shrink-0 ${isDragging ? "z-10 opacity-40" : ""}`}
      data-testid={`slide-thumbnail-${index}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onSelect(index)}
        aria-label={`Otevřít slide ${index + 1}: ${title}`}
        aria-current={active ? "true" : undefined}
        className={`deck-thumbnail ${active ? "deck-thumbnail--active" : ""}`}
        style={themeStageStyle(getPresentationTheme(themeId))}
      >
        <LazySlidePreview slide={slide} themeId={themeId} />
        <span className="absolute bottom-1 left-1 rounded bg-deck-panel/90 px-1.5 text-[10px] font-bold text-deck-ink">{index + 1}</span>
        {(slide?.type === "activity" || slide?.type === "studio_step") && (
          <span className="absolute left-1 top-1 rounded-full bg-deck-teal px-2 py-0.5 text-[9px] font-bold text-deck-violet-deep" title={slide?.activitySpec?.activityType ? activityTypeLabel(slide.activitySpec.activityType) : "Aktivita"}>
            Aktivita
          </span>
        )}
      </button>
      <p className="mt-1 truncate text-center text-[11px] text-deck-muted" title={title}>{index + 1}. {title}</p>
    </div>
  );
});

interface Props {
  slides: any[];
  activeIndex: number;
  themeId: string;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
}

/** Dolní pás miniatur: dnd-kit, líné náhledy a horizontální virtualizace nad 30 slidů. */
export default function PresentationThumbnails({ slides, activeIndex, themeId, onSelect, onMove, onAdd }: Props) {
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
    const start = Math.max(0, Math.floor(el.scrollLeft / ITEM_W) - 3);
    const count = Math.ceil(el.clientWidth / ITEM_W) + 7;
    setRange({ start, end: Math.min(slides.length, start + count) });
  };
  useEffect(() => {
    if (!virtual) { setRange({ start: 0, end: slides.length }); return; }
    updateRange();
    // Aktivní slide musí být vykreslený i po změně výběru klávesou.
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

  return (
    <footer className="deck-thumbnail-strip" aria-label="Slidy prezentace" data-testid="presentation-thumbnails">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div ref={scrollRef} onScroll={updateRange} className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto px-4 py-2">
            {virtual && range.start > 0 && <div aria-hidden className="shrink-0" style={{ width: range.start * ITEM_W - 16 }} />}
            {rendered.map((slide, localIndex) => {
              const index = virtual ? range.start + localIndex : localIndex;
              return <Thumbnail key={ids[index]} slide={slide} index={index} themeId={themeId} active={index === activeIndex} onSelect={onSelect} />;
            })}
            {virtual && range.end < slides.length && <div aria-hidden className="shrink-0" style={{ width: (slides.length - range.end) * ITEM_W - 16 }} />}
            <button type="button" onClick={onAdd} className="deck-add-slide" aria-label="Přidat slide">
              <Plus className="h-5 w-5" /> Slide
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </footer>
  );
}
