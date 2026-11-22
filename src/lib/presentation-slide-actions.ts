import { attachLessonRef, readLessonRef } from "@/lib/presentation-lesson-ref";

export interface SlideEditResult {
  slides: any[];
  activeIndex: number;
  selectedIndices: number[];
}

const uniqueIndices = (slides: any[], indices: number[]) => [...new Set(indices)]
  .filter((index) => Number.isInteger(index) && index >= 0 && index < slides.length)
  .sort((a, b) => a - b);

const withLessonRef = (before: any[], slides: any[]) => attachLessonRef(slides, readLessonRef(before));

export function isActivitySlide(slide: any): boolean {
  return slide?.type === "activity" || slide?.type === "studio_step" || !!slide?.activitySpec;
}

/** Poslední slide se nemaže. Při hromadném výběru celé prezentace se neprovede nic. */
export function deletePresentationSlides(slides: any[], indices: number[], activeIndex: number): SlideEditResult | null {
  const selected = uniqueIndices(slides, indices);
  if (!selected.length || selected.length >= slides.length) return null;
  const selectedSet = new Set(selected);
  const remaining = slides.filter((_, index) => !selectedSet.has(index));
  const removedBeforeActive = selected.filter((index) => index <= activeIndex).length;
  const nextActive = Math.max(0, Math.min(activeIndex - removedBeforeActive, remaining.length - 1));
  return {
    slides: withLessonRef(slides, remaining),
    activeIndex: nextActive,
    selectedIndices: [nextActive],
  };
}

const freshId = () => globalThis.crypto?.randomUUID?.() ?? `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function clonePresentationSlide(slide: any): any {
  const copy = JSON.parse(JSON.stringify(slide));
  copy.slideId = freshId();
  if (Array.isArray(copy.blocks)) copy.blocks = copy.blocks.map((block: any) => ({ ...block, id: freshId() }));
  delete copy.lessonRef;
  return copy;
}

/** Kopie se vkládají přímo za své originály, ve stejném pořadí jako výběr. */
export function duplicatePresentationSlides(slides: any[], indices: number[], activeIndex: number): SlideEditResult | null {
  const selected = uniqueIndices(slides, indices);
  if (!selected.length) return null;
  const selectedSet = new Set(selected);
  const next: any[] = [];
  const copies: number[] = [];
  let nextActive = activeIndex;
  slides.forEach((slide, index) => {
    next.push(slide);
    if (!selectedSet.has(index)) return;
    const copy = clonePresentationSlide(slide);
    const copyIndex = next.push(copy) - 1;
    copies.push(copyIndex);
    if (index === activeIndex) nextActive = copyIndex;
  });
  if (!selectedSet.has(activeIndex)) nextActive = copies[0];
  return {
    slides: withLessonRef(slides, next),
    activeIndex: nextActive,
    selectedIndices: copies,
  };
}

export function movePresentationSlidesToEdge(
  slides: any[],
  indices: number[],
  edge: "start" | "end",
  activeIndex: number,
): SlideEditResult | null {
  const selected = uniqueIndices(slides, indices);
  if (!selected.length || selected.length === slides.length) return null;
  const selectedSet = new Set(selected);
  const picked = slides.filter((_, index) => selectedSet.has(index));
  const rest = slides.filter((_, index) => !selectedSet.has(index));
  const next = edge === "start" ? [...picked, ...rest] : [...rest, ...picked];
  const activeSlide = slides[activeIndex];
  const nextActive = Math.max(0, next.indexOf(activeSlide));
  const selectedIndices = next.map((slide, index) => selectedSet.has(slides.indexOf(slide)) ? index : -1).filter((index) => index >= 0);
  return { slides: withLessonRef(slides, next), activeIndex: nextActive, selectedIndices };
}

export function setPresentationSlidesHidden(slides: any[], indices: number[], hidden: boolean, activeIndex: number): SlideEditResult | null {
  const selected = uniqueIndices(slides, indices);
  if (!selected.length) return null;
  const selectedSet = new Set(selected);
  return {
    slides: withLessonRef(slides, slides.map((slide, index) => selectedSet.has(index)
      ? { ...slide, ...(hidden ? { hiddenInPresentation: true } : { hiddenInPresentation: undefined }) }
      : slide)),
    activeIndex,
    selectedIndices: selected,
  };
}

/** Skrytí se týká pouze promítání; editor, miniatury a tisk obsah nemažou. */
export function visiblePresentationSlides(slides: any[] | null | undefined): any[] {
  return (slides ?? []).filter((slide) => slide?.hiddenInPresentation !== true);
}
