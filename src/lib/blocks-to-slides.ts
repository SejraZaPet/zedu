import { blockBackgroundSlideColor } from "@/lib/block-backgrounds";
import { getGroupChildFrames } from "@/lib/slide-groups";
import { DEFAULT_THEME_ID } from "@/lib/presentation-themes";

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getText(props: any): string {
  return stripHtml(props.text || props.html || props.content || props.value || "");
}

function blockToBodyText(block: any): { text: string; assetRef?: string; activitySpec?: any; tableData?: any; cardData?: any } {
  const type = block.type;
  const props = block.props || {};
  switch (type) {
    case "paragraph":
    case "rich_text":
    case "callout":
    case "quote":
      return { text: getText(props) };
    case "bullet_list":
    case "bulletList": {
      const items = props.items || props.bullets || [];
      if (Array.isArray(items) && items.length > 0) {
        return { text: items.map((i: any) => `• ${typeof i === "string" ? i : i.text || i}`).join("\n") };
      }
      return { text: stripHtml(props.html || "") };
    }
    case "table": {
      const headers: string[] = props.headers || [];
      const rows: string[][] = props.rows || [];
      const headerLine = headers.join(" | ");
      const separator = headers.map(() => "---").join(" | ");
      const rowLines = rows.map((row: string[]) => row.join(" | ")).join("\n");
      const text = [headerLine, separator, rowLines].filter(Boolean).join("\n");
      return { text, tableData: { headers, rows } };
    }
    case "two_column":
    case "twoColumn": {
      const left = props.leftText || props.left || "";
      const right = props.rightText || props.right || "";
      return { text: `${stripHtml(left)}\n\n${stripHtml(right)}`.trim() };
    }
    case "card_grid": {
      const cards = props.cards || [];
      const text = cards.map((c: any) => `• ${c.title || ""}${c.text ? ": " + stripHtml(c.text) : ""}`).join("\n");
      return { text, cardData: cards };
    }
    case "accordion": {
      const items = props.items || [];
      return {
        text: items.map((item: any) => `▸ ${item.title || ""}\n${stripHtml(item.content || item.text || "")}`).join("\n\n"),
      };
    }
    case "summary": {
      const items = props.items || props.points || [];
      const text = Array.isArray(items) && items.length > 0
        ? items.map((i: any) => `✓ ${typeof i === "string" ? i : i.text || i}`).join("\n")
        : stripHtml(props.html || props.text || "");
      return { text };
    }
    case "image":
      return { text: stripHtml(props.caption || ""), assetRef: props.url || props.src || "" };
    case "image_text":
      return { text: stripHtml(props.text || props.html || ""), assetRef: props.imageUrl || props.url || "" };
    case "gallery": {
      const images = props.images || [];
      const firstUrl = images[0]?.url || "";
      return { text: images.length > 0 ? `Galerie (${images.length} obrázků)` : "", assetRef: firstUrl };
    }
    case "youtube": {
      const url = props.url || props.videoUrl || "";
      const title = props.title || "";
      return { text: [title, url ? `Video: ${url}` : ""].filter(Boolean).join("\n") };
    }
    case "activity": {
      const title = props.title || props.question || props.activityType || "Aktivita";
      const instructions = props.instructions || "";
      return { text: [title, instructions].filter(Boolean).join("\n"), activitySpec: props };
    }
    default:
      return { text: "" };
  }
}

/** Maximální „hustota“ jednoho automaticky vygenerovaného snímku. */
const MAX_BLOCKS_PER_SLIDE = 5;
const MAX_CHARS_PER_SLIDE = 900;

/**
 * Dolní hranice čitelného zmenšení obsahu na projekci (viz SlideCanvas).
 * Co se nevejde ani při tomto zmenšení, se NEOŘEZÁVÁ, ale reálně rozdělí
 * na navazující snímky.
 */
export const READABLE_SCALE_FLOOR = 0.72;
/** Absolutní strop znaků na snímek, než se obsah rozdělí. */
const HARD_MAX_CHARS_PER_SLIDE = Math.round(MAX_CHARS_PER_SLIDE / READABLE_SCALE_FLOOR);
/** Sekce pod touto délkou je „poloprázdná“ a slučuje se se sousedy. */
const SHORT_SECTION_CHARS = 120;
/** Cílová naplněnost snímku při slučování krátkých sekcí. */
const TARGET_FILL_CHARS = 480;

/** Výchozí rozvržení podle typu snímku, ať prezentace nepůsobí jako slepenec. */
function defaultLayoutForType(type: string): string {
  switch (type) {
    case "intro":
    case "summary":
      return "title-only";
    default:
      return "full";
  }
}

const bodyLen = (slide: any): number => String(slide?.projector?.body || "").length;

/** Snímek, který lze bezpečně slučovat / dělit (běžný textový výklad). */
function isPlainTextSlide(slide: any): boolean {
  if (!slide || slide.type !== "explain") return false;
  const layout = slide.layout || "full";
  if (layout !== "full") return false;
  if (slide.activitySpec || slide.tableData || slide.cardData) return false;
  if ((slide.projector?.assetRefs || []).length > 0) return false;
  if ((slide.blocks || []).some((b: any) => b?.frame)) return false;
  return true;
}

function headingBlock(text: string, id?: string | null, extraProps?: Record<string, any>): any {
  return {
    ...(id ? { id: `${id}-h` } : {}),
    type: "heading",
    props: { text, level: extraProps?.level ?? 3, ...(extraProps || {}) },
  };
}


/**
 * FÁZE 1 – slučování krátkých sekcí.
 * Lekce s desítkami drobných mezititulků negeneruje desítky poloprázdných
 * snímků; krátké sekce se spojují s následujícími, dokud snímek nemá rozumnou
 * náplň (a nepřekročí strop čitelnosti).
 */
function mergeShortSections(slides: any[]): any[] {
  const out: any[] = [];
  let i = 0;
  while (i < slides.length) {
    const slide = slides[i];
    if (!isPlainTextSlide(slide) || bodyLen(slide) >= SHORT_SECTION_CHARS) {
      out.push(slide);
      i += 1;
      continue;
    }

    const base: any = {
      ...slide,
      blocks: [...(slide.blocks || [])],
      projector: { ...slide.projector, assetRefs: [...(slide.projector?.assetRefs || [])] },
    };
    let chars = bodyLen(base);
    let j = i + 1;

    while (j < slides.length && chars < TARGET_FILL_CHARS) {
      const next = slides[j];
      if (!isPlainTextSlide(next)) break;
      const nextLen = bodyLen(next);
      if (chars + nextLen > HARD_MAX_CHARS_PER_SLIDE) break;
      if (chars >= SHORT_SECTION_CHARS && chars + nextLen > MAX_CHARS_PER_SLIDE) break;

      const nextHeadline = String(next.projector?.headline || "").trim();
      const takeHeadline = !String(base.projector?.headline || "").trim() && chars === 0;
      if (nextHeadline) {
        if (takeHeadline) {
          base.projector.headline = nextHeadline;
          base.sourceBlockId = next.sourceBlockId ?? base.sourceBlockId;
        } else {
          base.blocks.push(headingBlock(nextHeadline, next.sourceBlockId));
        }
      }
      base.blocks.push(...(next.blocks || []));
      const nextBody = [
        nextHeadline && !takeHeadline ? nextHeadline : "",
        next.projector?.body || "",
      ].filter(Boolean).join("\n");
      if (nextBody) {
        base.projector.body = base.projector.body ? `${base.projector.body}\n\n${nextBody}` : nextBody;
      }
      if (!base.backgroundOverride && next.backgroundOverride) base.backgroundOverride = next.backgroundOverride;
      chars = bodyLen(base);
      j += 1;
    }

    out.push(base);
    i = Math.max(j, i + 1);
  }
  return out;
}

/**
 * Rozdělí text na části tak, aby žádná nepřekročila strop čitelnosti.
 * Části se dělí rovnoměrně, aby nevznikaly téměř prázdné „zbytkové“ snímky.
 */
function chunkText(text: string, hardLimit: number): string[] {
  const full = String(text || "");
  const parts = Math.max(1, Math.ceil(full.length / hardLimit));
  const limit = Math.max(200, Math.min(hardLimit, Math.ceil(full.length / parts) + 60));
  const paragraphs = full.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let buffer = "";
  const pushBuffer = () => {
    if (buffer.trim()) chunks.push(buffer.trim());
    buffer = "";
  };
  for (const paragraph of paragraphs) {
    if (paragraph.length > limit) {
      pushBuffer();
      const lines = paragraph.split("\n");
      let lineBuffer = "";
      for (const line of lines) {
        if (lineBuffer && (lineBuffer.length + line.length + 1) > limit) {
          chunks.push(lineBuffer.trim());
          lineBuffer = "";
        }
        lineBuffer = lineBuffer ? `${lineBuffer}\n${line}` : line;
        while (lineBuffer.length > limit) {
          chunks.push(lineBuffer.slice(0, limit).trim());
          lineBuffer = lineBuffer.slice(limit);
        }
      }
      if (lineBuffer.trim()) chunks.push(lineBuffer.trim());
      continue;
    }
    if (buffer && (buffer.length + paragraph.length + 2) > limit) pushBuffer();
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }
  pushBuffer();
  return chunks.length > 0 ? chunks : [full];
}

const continuationHeadline = (headline: string): string =>
  headline ? (headline.includes("(pokračování)") ? headline : `${headline} (pokračování)`) : "";

/** Rozdělí jeden příliš dlouhý textový blok na několik menších bloků. */
function splitTextBlock(block: any, limit: number): any[] {
  const text = blockToBodyText(block).text;
  if (text.length <= limit) return [block];
  const chunks = chunkText(text, limit);
  return chunks.map((chunk, idx) => ({
    ...block,
    ...(block?.id ? { id: idx === 0 ? block.id : `${block.id}#p${idx}` } : {}),
    type: block?.type === "bullet_list" || block?.type === "bulletList" ? block.type : "paragraph",
    props: { ...(block?.props || {}), text: chunk, html: undefined, items: undefined },
  }));
}

/**
 * FÁZE 2 – přeplněný obsah se reálně rozdělí na navazující snímky
 * (dřív se jen zmenšoval až do nečitelnosti / oříznutí).
 */
function splitSlide(slide: any): any[] {
  const layout = slide?.layout || "full";
  const chars = bodyLen(slide);

  if (chars <= HARD_MAX_CHARS_PER_SLIDE || layout === "free" || slide?.type === "intro" || slide?.type === "summary") {
    return [slide];
  }

  const out: any[] = [];

  // Aktivita zůstává celá (je interaktivní) – přeteklý popis pokračuje dál.
  if (slide.type === "activity") {
    const chunks = chunkText(slide.projector?.body || "", HARD_MAX_CHARS_PER_SLIDE);
    out.push({ ...slide, projector: { ...slide.projector, body: chunks[0] } });
    chunks.slice(1).forEach((chunk, idx) => {
      out.push({
        ...slide,
        slideId: "",
        type: "explain",
        layout: "full",
        activitySpec: undefined,
        blocks: [],
        sourceBlockId: slide.sourceBlockId ? `${slide.sourceBlockId}#txt${idx + 1}` : undefined,
        device: { instructions: "Sledujte výklad." },
        projector: {
          ...slide.projector,
          headline: continuationHeadline(String(slide.projector?.headline || "")),
          body: chunk,
          assetRefs: [],
        },
      });
    });
    return out;
  }

  // Karty / textové snímky dělíme po blocích, aby obsah zůstal celý.
  // Příliš dlouhý jednotlivý blok se předtím rozpadne na menší bloky.
  const blocks: any[] = (slide.blocks || []).flatMap((b: any) => splitTextBlock(b, HARD_MAX_CHARS_PER_SLIDE));
  if (blocks.length > 1) {
    const groups: any[][] = [];
    let group: any[] = [];
    let groupChars = 0;
    for (const block of blocks) {
      const len = blockToBodyText(block).text.length;
      if (group.length > 0 && groupChars + len > HARD_MAX_CHARS_PER_SLIDE) {
        groups.push(group);
        group = [];
        groupChars = 0;
      }
      group.push(block);
      groupChars += len;
    }
    if (group.length > 0) groups.push(group);

    groups.forEach((groupBlocks, idx) => {
      const texts = groupBlocks.map((b) => blockToBodyText(b).text).filter(Boolean);
      out.push({
        ...slide,
        slideId: idx === 0 ? slide.slideId : "",
        blocks: groupBlocks,
        sourceBlockId: idx === 0
          ? slide.sourceBlockId
          : slide.sourceBlockId ? `${slide.sourceBlockId}#part${idx}` : undefined,
        projector: {
          ...slide.projector,
          headline: idx === 0
            ? slide.projector?.headline
            : continuationHeadline(String(slide.projector?.headline || "")),
          body: texts.join("\n\n"),
        },
      });
    });
    return out;
  }

  // Jediný obří blok bez možnosti dělení – rozdělíme aspoň jeho text.
  const chunks = chunkText(slide.projector?.body || "", HARD_MAX_CHARS_PER_SLIDE);
  return chunks.map((chunk, idx) => ({
    ...slide,
    slideId: idx === 0 ? slide.slideId : "",
    blocks: idx === 0 ? blocks : [],
    sourceBlockId: idx === 0
      ? slide.sourceBlockId
      : slide.sourceBlockId ? `${slide.sourceBlockId}#part${idx}` : undefined,
    projector: {
      ...slide.projector,
      headline: idx === 0
        ? slide.projector?.headline
        : continuationHeadline(String(slide.projector?.headline || "")),
      body: chunk,
    },
  }));
}

function splitOverfullSlides(slides: any[]): any[] {
  let current = slides;
  // Dělení může být potřeba opakovat (velká karta → velké části).
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.flatMap((slide) => splitSlide(slide));
    if (next.length === current.length) return next;
    current = next;
  }
  return current;
}

/**
 * Prázdný titulní snímek (jen nadpis bez obsahu) předá svůj nadpis
 * následujícímu snímku, pokud ten žádný nemá – místo poloprázdného snímku.
 */
function absorbEmptyHeadingSlides(slides: any[]): any[] {
  const out: any[] = [];
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    const isEmptyHeading =
      slide?.type === "explain" &&
      String(slide.projector?.headline || "").trim() &&
      !String(slide.projector?.body || "").trim() &&
      (slide.blocks || []).length === 0;
    const next = slides[i + 1];
    if (isEmptyHeading && next && next.type !== "summary" && !String(next.projector?.headline || "").trim()) {
      slides[i + 1] = {
        ...next,
        projector: { ...next.projector, headline: slide.projector.headline },
        sourceBlockId: next.sourceBlockId ?? slide.sourceBlockId,
      };
      continue;
    }
    out.push(slide);
  }
  return out;
}


/** Po slučování a dělení přečísluje snímky, ať mají stabilní unikátní id. */
function renumberSlides(slides: any[]): any[] {
  let index = 1;
  return slides.map((slide) => {
    if (slide.type === "intro") return { ...slide, slideId: "slide-intro" };
    if (slide.type === "summary") return { ...slide, slideId: "slide-summary" };
    return { ...slide, slideId: `slide-${index++}` };
  });
}


export function blocksToSlides(blocks: any[], lessonTitle: string): any[] {
  const slides: any[] = [];

  slides.push({
    slideId: "slide-intro",
    type: "intro",
    projector: { headline: lessonTitle, body: "Připojte se pomocí kódu níže." },
    device: { instructions: "Naskenujte QR kód nebo zadejte kód pro připojení." },
    teacherNotes: "",
    themeId: DEFAULT_THEME_ID,
    layout: defaultLayoutForType("intro"),
  });

  let slideIndex = 1;
  let current: any = null;
  /** Kontext aktuální sekce (nadpis + stabilní id zdrojového bloku lekce). */
  let sectionHeadline = "";
  let sectionSourceId: string | null = null;
  let sectionPart = 0;

  const flush = () => {
    if (
      current &&
      (current.projector.headline ||
        current.projector.body ||
        (current.projector.assetRefs && current.projector.assetRefs.length) ||
        (current.blocks && current.blocks.length))
    ) {
      current.slideId = `slide-${slideIndex++}`;
      if (!current.themeId) current.themeId = DEFAULT_THEME_ID;
      if (!current.layout) current.layout = defaultLayoutForType(current.type);
      slides.push(current);
    }
    current = null;
  };


  const newSlide = (headline = "", sourceBlockId?: string | null): any => ({
    slideId: "",
    type: "explain",
    projector: { headline, body: "", assetRefs: [] as string[] },
    device: { instructions: "Sledujte výklad." },
    teacherNotes: "",
    blocks: [] as any[],
    ...(sourceBlockId ? { sourceBlockId } : {}),
  });

  /** Je aktuální snímek už tak plný, že by se obsah nevešel? */
  const isOverfull = (slide: any): boolean => {
    if (!slide) return false;
    const blockCount = (slide.blocks || []).length;
    const chars = String(slide.projector?.body || "").length;
    return blockCount >= MAX_BLOCKS_PER_SLIDE || chars >= MAX_CHARS_PER_SLIDE;
  };

  /** Pokračovací snímek téže sekce (nadpis se nepřepisuje, jen doplní). */
  const continueSection = () => {
    flush();
    sectionPart += 1;
    const headline = sectionHeadline ? `${sectionHeadline} (pokračování)` : "";
    current = newSlide(headline, sectionSourceId ? `${sectionSourceId}#${sectionPart}` : null);
  };

  const appendBody = (text: string) => {
    if (!text) return;
    current.projector.body = current.projector.body
      ? `${current.projector.body}\n\n${text}`
      : text;
  };

  for (const block of (blocks || [])) {
    if (!block || block.visible === false) continue;
    const type = block.type;
    const props = block.props || {};

    if (type === "divider") {
      flush();
      continue;
    }

    // Spojené bloky ("Snímek") vytvoří vždy JEDEN snímek s dětmi vedle sebe.
    if (type === "slide_group") {
      flush();
      const children: any[] = Array.isArray(props.children) ? props.children : [];
      const visibleChildren = children.filter((c) => c && c.visible !== false);
      if (visibleChildren.length === 0) continue;

      const cols = props.layout === 1 ? 1 : props.layout === 3 ? 3 : 2;
      let headline = "";
      let bodyChildren = visibleChildren;
      if (visibleChildren[0]?.type === "heading") {
        headline = getText(visibleChildren[0].props || {});
        bodyChildren = visibleChildren.slice(1);
      }
      if (bodyChildren.length === 0) {
        bodyChildren = visibleChildren;
        headline = "";
      }

      if (props.mode === "free") {
        // Ve volném režimu zůstávají všechny bloky na plátně včetně nadpisu.
        headline = "";
        bodyChildren = visibleChildren;
      }

      const groupSlide = newSlide(headline, block.id);
      const groupBg = blockBackgroundSlideColor(props)
        || visibleChildren.map((c) => blockBackgroundSlideColor(c?.props)).find(Boolean)
        || null;
      if (groupBg) groupSlide.backgroundOverride = { color: groupBg };
      const freeMode = props.mode === "free";
      groupSlide.layout = freeMode
        ? "free"
        : cols === 3 ? "three-cols" : cols === 2 ? "two-cols" : "full";
      if (freeMode) {
        const frames = getGroupChildFrames(block as any);
        groupSlide.blocks = bodyChildren.map((c: any) => ({ ...c, frame: c.frame ?? frames[c.id] }));
      } else {
        groupSlide.blocks = bodyChildren;
      }
      const groupMinHeight = Number(props.groupMinHeight);
      if (Number.isFinite(groupMinHeight) && groupMinHeight > 0) {
        (groupSlide as any).groupMinHeight = Math.round(groupMinHeight);
      }

      const texts: string[] = [];
      for (const child of bodyChildren) {
        const c = blockToBodyText(child);
        if (c.text) texts.push(c.text);
        if (c.assetRef) groupSlide.projector.assetRefs.push(c.assetRef);
      }
      groupSlide.projector.body = texts.join("\n\n");
      current = groupSlide;
      flush();
      continue;
    }

    if (type === "heading") {
      flush();
      const headline = getText(props);
      if (!headline) continue;
      sectionHeadline = headline;
      sectionSourceId = block.id ?? null;
      sectionPart = 0;
      current = newSlide(headline, block.id);
      const headingBg = blockBackgroundSlideColor(props);
      if (headingBg) current.backgroundOverride = { color: headingBg };
      continue;
    }


    const converted = blockToBodyText(block);

    // Activity blocks always get their own standalone slide so results
    // can be shared on the projector like other presentation activities.
    if (type === "activity" || converted.activitySpec) {
      flush();
      const activityHeadline =
        props.title || props.question || props.activityType || "Aktivita";
      const activitySlide = newSlide(activityHeadline, block.id);
      activitySlide.type = "activity";
      activitySlide.activitySpec = converted.activitySpec || props;
      activitySlide.blocks.push(block);
      if (converted.text) activitySlide.projector.body = converted.text;
      if (converted.assetRef) activitySlide.projector.assetRefs.push(converted.assetRef);
      activitySlide.device = { instructions: "Odpovězte na svém zařízení." };
      const activityBg = blockBackgroundSlideColor(props);
      if (activityBg) activitySlide.backgroundOverride = { color: activityBg };
      current = activitySlide;
      flush();
      continue;
    }

    if (!current) {
      sectionHeadline = "";
      sectionSourceId = block.id ?? null;
      sectionPart = 0;
      current = newSlide("", block.id);
    } else if (isOverfull(current)) {
      // Mezi dvěma nadpisy je víc obsahu, než se vejde na jeden snímek –
      // pokračujeme dalším navazujícím snímkem místo přeplněného.
      continueSection();
    }
    current.blocks.push(block);
    const blockBg = blockBackgroundSlideColor(props);
    if (blockBg && !current.backgroundOverride) current.backgroundOverride = { color: blockBg };

    appendBody(converted.text);
    if (converted.assetRef) current.projector.assetRefs.push(converted.assetRef);
    if (converted.tableData) current.tableData = converted.tableData;
    if (converted.cardData) current.cardData = converted.cardData;
  }

  flush();

  slides.push({
    slideId: "slide-summary",
    type: "summary",
    projector: { headline: "Shrnutí", body: `Lekce: ${lessonTitle}` },
    device: { instructions: "Zkontrolujte si znalosti." },
    teacherNotes: "",
    themeId: DEFAULT_THEME_ID,
    layout: defaultLayoutForType("summary"),
  });

  return renumberSlides(
    splitOverfullSlides(absorbEmptyHeadingSlides(mergeShortSections(slides))),
  );

}
