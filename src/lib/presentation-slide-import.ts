/** Bezeztrátové kopie slidů z lekcí, Studia a jiných prezentací. */
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function renewBlockIds(value: any): any {
  if (Array.isArray(value)) return value.map(renewBlockIds);
  if (!value || typeof value !== "object") return value;
  const copy: Record<string, any> = { ...value };
  if (typeof copy.id === "string") copy.id = uid();
  if (copy.props && typeof copy.props === "object") {
    copy.props = Object.fromEntries(Object.entries(copy.props).map(([key, child]) => [key, renewBlockIds(child)]));
  }
  return copy;
}

/** Zachová celý JSON; obnoví pouze identity slidů a bloků, nikdy ID odpovědí v activitySpec. */
export function cloneSlidesForInsertion(slides: any[], selectedIds?: Set<string>): any[] {
  return (Array.isArray(slides) ? slides : [])
    .filter((slide, index) => !selectedIds || selectedIds.has(String(slide?.slideId ?? index)))
    .map((slide) => {
      const copy = JSON.parse(JSON.stringify(slide));
      copy.slideId = uid();
      if (Array.isArray(copy.blocks)) copy.blocks = renewBlockIds(copy.blocks);
      // Kopie se nesmí později přepsat synchronizací s původní lekcí.
      delete copy.lockedFromLesson;
      delete copy.sourceLessonId;
      return copy;
    });
}

export type SlideInsertPosition = "before" | "after" | "end";

export function insertSlidesAtPosition(current: any[], incoming: any[], activeIndex: number, position: SlideInsertPosition) {
  if (!incoming.length) return { slides: current, activeIndex };
  const at = position === "end" ? current.length : Math.max(0, Math.min(current.length, activeIndex + (position === "after" ? 1 : 0)));
  const slides = [...current];
  slides.splice(at, 0, ...incoming);
  return { slides, activeIndex: at };
}
