/**
 * Rozdělí markdown / plain text content lekce na "bloky" podle nadpisů a odstavců.
 * Vrací zkrácené úryvky, které učitel klikne v paletě "Z lekce".
 */

export interface LessonBlock {
  id: string;
  /** Krátký nadpis nebo prvních ~60 znaků pro mini-kartu. */
  title: string;
  /** Plný text úryvku odeslaný do AI. */
  text: string;
}

/**
 * Rozbalí bloky lekce tak, že vnořené bloky karet (slide_group → props.children)
 * jsou ve výstupu na stejné úrovni jako běžné bloky. Skryté bloky se vynechávají.
 * `topIndex` odpovídá indexu mezi VIDITELNÝMI bloky na nejvyšší úrovni
 * (konvence deep-linku `?aktivita=<index>` a student_activity_results).
 */
export function flattenLessonBlocks(
  blocks: unknown,
): Array<{ block: any; topIndex: number; nested: boolean }> {
  if (!Array.isArray(blocks)) return [];
  const out: Array<{ block: any; topIndex: number; nested: boolean }> = [];
  let topIndex = 0;
  const walk = (list: any[], top: number | null) => {
    for (const b of list) {
      if (!b || typeof b !== "object" || b.visible === false) continue;
      const myTop = top ?? topIndex++;
      const children = (b.props as any)?.children;
      if (b.type === "slide_group" && Array.isArray(children)) {
        walk(children, top === null ? myTop : top);
        continue;
      }
      out.push({ block: b, topIndex: myTop, nested: top !== null });
    }
  };
  walk(blocks as any[], null);
  return out;
}


/** Hrubě rozdělí text na bloky podle nadpisů (#, ##) a prázdných řádků. */
export function splitLessonContent(content: string): LessonBlock[] {
  if (!content || !content.trim()) return [];

  const lines = content.split(/\r?\n/);
  const blocks: { headline: string | null; lines: string[] }[] = [];
  let current: { headline: string | null; lines: string[] } = {
    headline: null,
    lines: [],
  };

  for (const raw of lines) {
    const line = raw.trim();
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      // start new block on heading
      if (current.lines.length > 0 || current.headline) {
        blocks.push(current);
      }
      current = { headline: headingMatch[1].trim(), lines: [] };
      continue;
    }
    if (line === "") {
      if (current.lines.length > 0) {
        blocks.push(current);
        current = { headline: null, lines: [] };
      }
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length > 0 || current.headline) blocks.push(current);

  // strip empty + map to LessonBlock
  return blocks
    .map((b, idx) => {
      const text = [b.headline, ...b.lines].filter(Boolean).join("\n").trim();
      if (!text) return null;
      const title = b.headline ?? text.slice(0, 60).replace(/\s+/g, " ");
      return {
        id: `lb-${idx}`,
        title: title.length > 80 ? title.slice(0, 80) + "…" : title,
        text: text.length > 8000 ? text.slice(0, 8000) + "…" : text,
      } as LessonBlock;
    })
    .filter((x): x is LessonBlock => x !== null)
    .slice(0, 200); // safety cap
}

/** Aktivita extrahovaná z lekce — připravená k převedení na položku pracovního listu. */
export interface LessonActivity {
  /** Stabilní ID v rámci lekce (index bloku). */
  id: string;
  /** Typ aktivity z lekce (např. "flashcards", "quiz", …). */
  activityType: string;
  /** Lidsky čitelný titulek aktivity. */
  title: string;
  /** Volitelné zadání/úvod aktivity. */
  instructions?: string;
  /** Raw props bloku — používá se k namapování dat na worksheet item. */
  props: Record<string, unknown>;
  /**
   * Index pro deep-link `?aktivita=<index>`. U aktivit vnořených v kartě
   * (slide_group) není samostatný odkaz dostupný → undefined.
   */
  deepLinkIndex?: number;
}

/**
 * Vrátí seznam aktivit nalezených v blocích lekce (jsonb `blocks`),
 * včetně aktivit vnořených v kartách (slide_group → props.children).
 * Učitel z nich může vytvářet odpovídající bloky v pracovním listu.
 */
export function extractActivitiesFromBlocks(blocks: unknown): LessonActivity[] {
  const out: LessonActivity[] = [];
  flattenLessonBlocks(blocks).forEach(({ block: b, topIndex, nested }, i) => {
    if (b.type !== "activity") return;
    const p = (b.props ?? {}) as Record<string, unknown>;
    const at = String(p.activityType ?? "flashcards");
    const title =
      (typeof p.title === "string" && p.title.trim()) || `Aktivita ${i + 1}`;
    const instructions =
      typeof p.instructions === "string" ? p.instructions : undefined;
    out.push({
      id: nested ? `lesson-activity-nested-${topIndex}-${i}` : `lesson-activity-${topIndex}`,
      activityType: at,
      title: title.length > 80 ? title.slice(0, 80) + "…" : title,
      instructions,
      props: p,
      ...(nested ? {} : { deepLinkIndex: topIndex }),
    });
  });
  return out;
}

/** Tabulka z lekce připravená k reprodukci v pracovním listu. */
export interface LessonTable {
  /** Index bloku v lekci (stabilní ID). */
  blockIndex: number;
  /** Řádky včetně hlavičky na prvním místě. */
  rows: string[][];
  /** Popisek tabulky, pokud v lekci je. */
  caption?: string;
}

/** Needitovatelný vizuální blok lekce připravený pro pracovní list. */
export type LessonVisualBlock =
  | {
      kind: "image";
      blockIndex: number;
      url: string;
      alt?: string;
      caption?: string;
      width?: "full" | "medium" | "small";
      alignment?: "left" | "center" | "right";
    }
  | {
      kind: "image_text";
      blockIndex: number;
      imageUrl: string;
      text: string;
      imagePosition: "left" | "right";
    }
  | {
      kind: "gallery";
      blockIndex: number;
      images: Array<{ url: string; alt?: string; caption?: string }>;
      columns: 2 | 3 | 4;
    }
  | {
      kind: "callout";
      blockIndex: number;
      variant: "note" | "info" | "tip" | "warning" | "remember" | "custom";
      title?: string;
      text: string;
      backgroundColor?: string;
      accentColor?: string;
    };

export type LessonSectionContent =
  | { kind: "table"; table: LessonTable }
  | { kind: "visual"; visual: LessonVisualBlock }
  | { kind: "activity"; activity: LessonActivity };

const cleanText = (value: unknown) =>
  String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function normalizeImageWidth(value: unknown): "full" | "medium" | "small" {
  if (value === "small" || value === "third") return "small";
  if (value === "medium" || value === "half") return "medium";
  return "full";
}

function visualFromBlock(block: any, blockIndex: number): LessonVisualBlock | null {
  const p = (block?.props ?? {}) as Record<string, any>;
  if (block?.type === "image") {
    const url = String(p.url ?? "").trim();
    if (!url) return null;
    return {
      kind: "image",
      blockIndex,
      url,
      ...(cleanText(p.alt) ? { alt: cleanText(p.alt) } : {}),
      ...(cleanText(p.caption) ? { caption: cleanText(p.caption) } : {}),
      width: normalizeImageWidth(p.width),
      alignment: p.alignment === "left" || p.alignment === "right" ? p.alignment : "center",
    };
  }
  if (block?.type === "image_text") {
    const imageUrl = String(p.imageUrl ?? "").trim();
    const text = String(p.text ?? "").trim();
    if (!imageUrl && !text) return null;
    return {
      kind: "image_text",
      blockIndex,
      imageUrl,
      text,
      imagePosition: p.imagePosition === "right" ? "right" : "left",
    };
  }
  if (block?.type === "gallery") {
    const images = (Array.isArray(p.images) ? p.images : [])
      .map((image: any) => ({
        url: String(image?.url ?? "").trim(),
        ...(cleanText(image?.alt) ? { alt: cleanText(image.alt) } : {}),
        ...(cleanText(image?.caption) ? { caption: cleanText(image.caption) } : {}),
      }))
      .filter((image: { url: string }) => image.url);
    if (images.length === 0) return null;
    const columns = p.columns === 2 || p.columns === 4 ? p.columns : 3;
    return { kind: "gallery", blockIndex, images, columns };
  }
  if (block?.type === "callout") {
    const text = String(p.text ?? "").trim();
    const title = cleanText(p.title);
    if (!text && !title) return null;
    const backgroundPresets: Record<string, { backgroundColor: string; accentColor: string }> = {
      note: { backgroundColor: "hsl(205, 100%, 96%)", accentColor: "hsl(205, 85%, 52%)" },
      important: { backgroundColor: "hsl(34, 100%, 95%)", accentColor: "hsl(28, 92%, 53%)" },
      example: { backgroundColor: "hsl(146, 55%, 95%)", accentColor: "hsl(150, 58%, 40%)" },
      tip: { backgroundColor: "hsl(266, 100%, 96%)", accentColor: "hsl(266, 80%, 62%)" },
      neutral: { backgroundColor: "hsl(220, 16%, 96%)", accentColor: "hsl(220, 10%, 66%)" },
    };
    const preset = backgroundPresets[String(p.backgroundStyle ?? "")];
    const customBackground = typeof p.backgroundColor === "string" && p.backgroundColor.trim() ? p.backgroundColor.trim() : undefined;
    const rawVariant = String(p.calloutType ?? "note");
    const variant = customBackground
      ? "custom"
      : rawVariant === "warning" || rawVariant === "tip" || rawVariant === "remember" || rawVariant === "info"
        ? rawVariant
        : "note";
    return {
      kind: "callout",
      blockIndex,
      variant,
      ...(title ? { title } : {}),
      text,
      ...(customBackground || preset?.backgroundColor ? { backgroundColor: customBackground ?? preset?.backgroundColor } : {}),
      ...(preset?.accentColor ? { accentColor: preset.accentColor } : {}),
    };
  }
  return null;
}

/** Vrátí obrazové a zvýrazněné bloky v přesném pořadí lekce. */
export function extractVisualBlocksFromBlocks(blocks: unknown): LessonVisualBlock[] {
  return flattenLessonBlocks(blocks)
    .map(({ block, topIndex }) => visualFromBlock(block, topIndex))
    .filter((visual): visual is LessonVisualBlock => visual !== null);
}

/**
 * Vrátí tabulky nalezené v blocích lekce (jsonb `blocks`) — hlavička + řádky,
 * včetně tabulek vnořených v kartách (slide_group).
 * Používá se k tomu, aby se tabulka do pracovního listu propsala 1:1.
 */
export function extractTablesFromBlocks(blocks: unknown): LessonTable[] {
  const clean = (v: unknown) =>
    String(v ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const out: LessonTable[] = [];
  flattenLessonBlocks(blocks).forEach(({ block: b, topIndex }) => {
    if (b.type !== "table") return;
    const p = (b.props ?? {}) as any;
    const headers: string[] = Array.isArray(p.headers) ? p.headers.map(clean) : [];
    const body: string[][] = Array.isArray(p.rows)
      ? p.rows.filter(Array.isArray).map((r: unknown[]) => r.map(clean))
      : [];
    const rows = headers.length > 0 ? [headers, ...body] : body;
    if (rows.length === 0) return;
    const caption = clean(p.caption);
    out.push({ blockIndex: topIndex, rows, ...(caption ? { caption } : {}) });
  });
  return out;
}


/** Převede JEDEN blok lekce na řádky plain-textu / markdownu. */
export function blockToText(b: any): string[] {
  const stripHtml = (s: unknown) =>
    String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const parts: string[] = [];
  const p = b?.props ?? {};

  switch (b?.type) {
    case "heading": {
      const lvl = Number(p.level) > 0 && Number(p.level) <= 6 ? Number(p.level) : 2;
      if (p.text) parts.push(`${"#".repeat(lvl)} ${stripHtml(p.text)}`);
      break;
    }
    case "paragraph":
      if (p.text) parts.push(stripHtml(p.text));
      break;
    case "bullet_list": {
      if (p.html) {
        const liMatches = String(p.html).match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
        for (const li of liMatches) {
          const txt = stripHtml(li);
          if (txt) parts.push(`- ${txt}`);
        }
      } else if (Array.isArray(p.items)) {
        for (const it of p.items) {
          const txt = stripHtml(it);
          if (txt) parts.push(`- ${txt}`);
        }
      }
      break;
    }
    case "callout": {
      const label = p.calloutType ? `[${String(p.calloutType).toUpperCase()}]` : "";
      if (p.text) parts.push(`${label} ${stripHtml(p.text)}`.trim());
      break;
    }
    case "quote": {
      const txt = stripHtml(p.text);
      const author = stripHtml(p.author);
      if (txt) parts.push(`> ${txt}${author ? ` — ${author}` : ""}`);
      break;
    }
    case "summary": {
      if (p.title) parts.push(`## ${stripHtml(p.title)}`);
      if (p.text) parts.push(stripHtml(p.text));
      break;
    }
    case "image": {
      const bits = [stripHtml(p.alt), stripHtml(p.caption), stripHtml(p.title)].filter(Boolean);
      if (bits.length) parts.push(`[Obrázek] ${bits.join(" — ")}`);
      break;
    }
    case "image_text": {
      const bits = [stripHtml(p.caption), stripHtml(p.text)].filter(Boolean);
      if (bits.length) parts.push(bits.join("\n"));
      break;
    }
    case "gallery": {
      const imgs: any[] = Array.isArray(p.images) ? p.images : [];
      const captions = imgs.map((i) => stripHtml(i?.caption)).filter(Boolean);
      if (captions.length) parts.push(`[Galerie] ${captions.join(" / ")}`);
      break;
    }
    case "card_grid": {
      const cards: any[] = Array.isArray(p.cards) ? p.cards : [];
      for (const c of cards) {
        const title = stripHtml(c?.title);
        if (title) parts.push(`### ${title}`);
        if (c?.mode === "bullets" && Array.isArray(c?.items)) {
          for (const it of c.items) {
            const t = stripHtml(it);
            if (t) parts.push(`- ${t}`);
          }
        } else if (c?.text) {
          parts.push(stripHtml(c.text));
        }
      }
      break;
    }
    case "table": {
      const headers: any[] = Array.isArray(p.headers) ? p.headers : [];
      const rows: any[] = Array.isArray(p.rows) ? p.rows : [];
      if (headers.length) parts.push(headers.map((h) => stripHtml(h)).join(" | "));
      for (const row of rows) {
        if (Array.isArray(row)) {
          parts.push(row.map((c) => stripHtml(c)).join(" | "));
        }
      }
      break;
    }
    case "accordion": {
      const items: any[] = Array.isArray(p.items) ? p.items : [];
      for (const it of items) {
        const title = stripHtml(it?.title);
        const content = stripHtml(it?.content);
        if (title) parts.push(`### ${title}`);
        if (content) parts.push(content);
      }
      break;
    }
    case "two_column": {
      const left = stripHtml(p.left);
      const right = stripHtml(p.right);
      if (left) parts.push(left);
      if (right) parts.push(right);
      break;
    }
    case "lesson_link": {
      const bits = [stripHtml(p.title), stripHtml(p.buttonText), stripHtml(p.description)].filter(Boolean);
      if (bits.length) parts.push(`[Odkaz na lekci] ${bits.join(" — ")}`);
      break;
    }
    case "youtube": {
      const bits = [stripHtml(p.caption), stripHtml(p.title)].filter(Boolean);
      if (bits.length) parts.push(`[YouTube] ${bits.join(" — ")}`);
      break;
    }
    case "activity": {
      const bits = [stripHtml(p.title), stripHtml(p.instruction), stripHtml(p.description)].filter(Boolean);
      if (bits.length) parts.push(`[Aktivita${p.activityType ? `: ${p.activityType}` : ""}] ${bits.join(" — ")}`);
      break;
    }
    case "divider":
      // visual only — skip
      break;
    default: {
      const generic = [stripHtml(p.title), stripHtml(p.text), stripHtml(p.content), stripHtml(p.caption)].filter(Boolean);
      if (generic.length) parts.push(generic.join(" "));
      break;
    }
  }
  return parts.filter(Boolean);
}

/**
 * Extrahuje plain-text / markdown z blokové struktury (jsonb `blocks`)
 * používané v učitelských lekcích a textbook_lessons.
 * Vnořené bloky karet (slide_group → props.children) se zpracují stejně
 * jako bloky na nejvyšší úrovni.
 */
export function extractTextFromBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  for (const { block: b } of flattenLessonBlocks(blocks)) {
    parts.push(...blockToText(b));
  }
  return parts.filter(Boolean).join("\n");
}

/** Sekce lekce v chronologickém pořadí — podklad pro stavbu pracovního listu. */
export interface LessonSection {
  /** Pořadové číslo sekce (1-based). */
  index: number;
  /** Nadpis sekce (nebo automatický „Část N“). */
  title: string;
  /** Textový obsah sekce (markdown-ish). */
  text: string;
  /** Aktivita nalezená v sekci (pokud sekce/karta nějakou obsahuje). */
  activity?: LessonActivity;
  /** Tabulka nalezená v sekci (pokud nějakou obsahuje). */
  table?: LessonTable;
  /** Tabulky, vizuální bloky a aktivita v původním pořadí uvnitř sekce. */
  content: LessonSectionContent[];
}

/**
 * Rozdělí lekci na sekce v pořadí, v jakém jsou — stejná logika jako u
 * `blocksToSlides`: novou sekci začíná nadpis, a každá karta (slide_group)
 * tvoří vlastní sekci. U každé sekce vrací text, případnou aktivitu a tabulku.
 */
export function splitLessonIntoSections(blocks: unknown): LessonSection[] {
  const flat = flattenLessonBlocks(blocks);
  if (flat.length === 0) return [];

  const activities = extractActivitiesFromBlocks(blocks);
  const tables = extractTablesFromBlocks(blocks);
  let activityCursor = 0;
  let tableCursor = 0;

  type Draft = {
    title: string;
    lines: string[];
    activity?: LessonActivity;
    table?: LessonTable;
    content: LessonSectionContent[];
  };
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let currentCardTop: number | null = null;

  const startNew = () => {
    current = { title: "", lines: [], content: [] };
    drafts.push(current);
  };

  const stripHtml = (s: unknown) =>
    String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  for (const entry of flat) {
    const b = entry.block;
    if (entry.nested) {
      if (entry.topIndex !== currentCardTop || !current) {
        startNew();
        currentCardTop = entry.topIndex;
      }
    } else {
      currentCardTop = null;
      if (!current || b.type === "heading") startNew();
    }
    const draft = current!;

    if (b.type === "heading") {
      const t = stripHtml(b.props?.text);
      if (!draft.title) draft.title = t;
      else if (t) draft.lines.push(`### ${t}`);
      continue;
    }
    if (b.type === "activity") {
      const activity = activities[activityCursor];
      draft.activity = draft.activity ?? activity;
      if (activity) draft.content.push({ kind: "activity", activity });
      activityCursor += 1;
      continue;
    }
    if (b.type === "table") {
      const table = tables[tableCursor];
      draft.table = draft.table ?? table;
      if (table) draft.content.push({ kind: "table", table });
      tableCursor += 1;
      continue;
    }
    const visual = visualFromBlock(b, entry.topIndex);
    if (visual) {
      draft.content.push({ kind: "visual", visual });
      continue;
    }
    draft.lines.push(...blockToText(b));
  }

  return drafts
    .filter((d) => d.title || d.lines.length > 0 || d.activity || d.table || d.content.length > 0)
    .map((d, i) => ({
      index: i + 1,
      title: d.title || (d.lines[0] ?? `Část ${i + 1}`).slice(0, 80),
      text: d.lines.join("\n"),
      ...(d.activity ? { activity: d.activity } : {}),
      ...(d.table ? { table: d.table } : {}),
      content: d.content,
    }));
}


