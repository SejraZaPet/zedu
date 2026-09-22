/**
 * Spojení uložené prezentace s prezentací znovu vygenerovanou z lekce.
 *
 * Prezentace z lekce se před otevřením editoru i před spuštěním tiše
 * přegeneruje z aktuálního obsahu lekce. Ruční práce učitele (velikost písma,
 * upravené či přidané bloky, nadpisy, poznámky, motiv, pozadí) se přitom nesmí
 * ztratit.
 */

/** Id zdrojového bloku bez přípon z dělení/slučování (`#2`, `#part1`). */
export function baseSourceId(slide: any): string {
  return String(slide?.sourceBlockId || "").trim().split("#")[0];
}

/**
 * Klíče pro párování snímků: primárně id zdrojového bloku lekce bez přípon
 * (víc snímků z jednoho bloku se rozliší pořadím), u starších prezentací bez
 * `sourceBlockId` padáme na nadpis, jinak na `slideId`.
 */
export function buildSlideKeys(slides: any[]): string[] {
  const seen = new Map<string, number>();
  return (slides || []).map((slide: any, index: number) => {
    const base = baseSourceId(slide);
    if (base) {
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return `src:${base}#${n}`;
    }
    const headline = String(slide?.projector?.headline || "").trim().toLowerCase();
    if (headline) {
      const key = `head:${headline}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      return `${key}#${n}`;
    }
    return String(slide?.slideId || `index-${index}`);
  });
}

/**
 * Bloky snímku: obsah se aktualizuje z lekce, ale blok, který učitel ručně
 * upravil (`editedByTeacher`), zůstane jeho – včetně velikosti písma a barev.
 * Ručně přidané bloky bez předlohy v lekci se připojí na konec.
 */
export function mergeSlideBlocks(freshBlocks: any[], savedBlocks: any[]): any[] {
  const fresh = Array.isArray(freshBlocks) ? freshBlocks : [];
  const saved = Array.isArray(savedBlocks) ? savedBlocks : [];
  if (saved.length === 0) return fresh;

  const savedById = new Map<string, any>();
  saved.forEach((b: any) => { if (b?.id) savedById.set(String(b.id), b); });

  const merged = fresh.map((freshBlock: any) => {
    const savedBlock = freshBlock?.id ? savedById.get(String(freshBlock.id)) : null;
    if (!savedBlock) return freshBlock;
    if (savedBlock.editedByTeacher) return savedBlock;
    // Umístění a vrstvení z editoru drží i u neupraveného obsahu.
    return {
      ...freshBlock,
      ...(savedBlock.frame ? { frame: savedBlock.frame } : {}),
      ...(typeof savedBlock.zIndex === "number" ? { zIndex: savedBlock.zIndex } : {}),
    };
  });

  const freshIds = new Set(fresh.map((b: any) => String(b?.id || "")));
  const addedByTeacher = saved.filter(
    (b: any) => b?.editedByTeacher && !freshIds.has(String(b?.id || "")),
  );
  return [...merged, ...addedByTeacher];
}

/** Sloučí nově vygenerovaný snímek s dřív uloženými ručními úpravami. */
export function mergeSlideWithSaved(freshSlide: any, savedSlide: any): any {
  // Zamčený snímek se z lekce neaktualizuje vůbec.
  if (savedSlide?.lockedFromLesson) return savedSlide;
  const localHeadlineBackground = freshSlide.headlineBlockProps?.backgroundColor
    || freshSlide.headlineBlockProps?.backgroundStyle;
  const backgroundOverride = localHeadlineBackground
    ? freshSlide.backgroundOverride
    : savedSlide.backgroundOverride ?? freshSlide.backgroundOverride;
  return {
    ...savedSlide,
    ...freshSlide,
    projector: {
      ...savedSlide.projector,
      ...freshSlide.projector,
      fontScale: savedSlide.projector?.fontScale ?? freshSlide.projector?.fontScale,
    },
    device: savedSlide.device ?? freshSlide.device,
    teacherNotes: savedSlide.teacherNotes ?? freshSlide.teacherNotes,
    layout: savedSlide.layout ?? freshSlide.layout,
    themeId: savedSlide.themeId ?? freshSlide.themeId,
    backgroundOverride,
    heroImage: savedSlide.heroImage ?? freshSlide.heroImage,
    activitySpec: savedSlide.activitySpec ?? freshSlide.activitySpec,
    headlineLevel: freshSlide.headlineLevel ?? savedSlide.headlineLevel,
    headlineBlockProps: freshSlide.headlineBlockProps ?? savedSlide.headlineBlockProps,
    groupMinHeight: freshSlide.groupMinHeight ?? savedSlide.groupMinHeight,
    blocks: mergeSlideBlocks(freshSlide.blocks, savedSlide.blocks),
    tableData: freshSlide.tableData,
    cardData: freshSlide.cardData,
    type: freshSlide.type,
  };
}

/** Celá prezentace: nové snímky z lekce + zachované ruční úpravy a snímky. */
export function mergePresentationSlides(freshSlides: any[], savedSlides: any[]): any[] {
  if (!Array.isArray(savedSlides) || savedSlides.length === 0) return freshSlides;

  const savedKeys = buildSlideKeys(savedSlides);
  const savedByKey = new Map<string, any>();
  savedSlides.forEach((slide: any, index: number) => savedByKey.set(savedKeys[index], slide));

  const freshKeys = buildSlideKeys(freshSlides);
  const usedKeys = new Set<string>();
  const merged = freshSlides.map((freshSlide: any, index: number) => {
    const key = freshKeys[index];
    const savedSlide = savedByKey.get(key);
    if (!savedSlide) return freshSlide;
    usedKeys.add(key);
    return mergeSlideWithSaved(freshSlide, savedSlide);
  });

  // Ručně přidané i nespárované snímky se nesmí zahodit.
  const customSlides = savedSlides.filter(
    (_slide: any, index: number) => !usedKeys.has(savedKeys[index]),
  );
  return [...merged, ...customSlides];
}
