/**
 * Vložení aktivity jako prvku aktuálního slidu.
 * Bezpečné jen u slidu bez vlastního obsahu (prázdný nebo jen s nadpisem): projektor
 * u aktivity zobrazuje aktivitu, takže text by se v promítání ztratil. Jinak vznikne nový slide.
 */
const hasText = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").trim().length > 0;

export function canHostActivity(slide: any): boolean {
  if (!slide || slide.type === "activity" || slide.activitySpec) return false;
  if (hasText(slide.projector?.body)) return false;
  const blocks: any[] = Array.isArray(slide.blocks) ? slide.blocks : [];
  return blocks.every((b) => b?.visible === false || (b?.type === "heading" && !hasText(b?.props?.text)));
}

/** Slide s aktivitou z hotového slidu aktivity (preset / lekce); zachová pozadí, motiv a nadpis. */
export function buildPresetIntoSlide(current: any, activitySlide: any, opts: { withBlock?: boolean } = {}): any {
  const headline = hasText(current?.projector?.headline) ? current.projector.headline : activitySlide?.projector?.headline;
  const activityBlocks = opts.withBlock ? (activitySlide?.blocks ?? []).filter((b: any) => b?.type === "activity") : [];
  return {
    ...current,
    type: "activity",
    projector: { ...(current?.projector ?? {}), headline, body: "" },
    device: { ...(current?.device ?? {}), instructions: activitySlide?.device?.instructions ?? current?.device?.instructions ?? "" },
    activitySpec: { ...(activitySlide?.activitySpec ?? {}), question: activitySlide?.activitySpec?.question ?? headline },
    ...(activitySlide?.ai_generated ? { ai_generated: true } : {}),
    ...(activitySlide?.ai_modified_at ? { ai_modified_at: activitySlide.ai_modified_at } : {}),
    blocks: activityBlocks,
    structureEditedByTeacher: true,
  };
}
