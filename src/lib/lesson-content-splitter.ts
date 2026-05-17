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
        text: text.length > 1500 ? text.slice(0, 1500) + "…" : text,
      } as LessonBlock;
    })
    .filter((x): x is LessonBlock => x !== null)
    .slice(0, 30); // safety cap
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
}

/**
 * Vrátí seznam aktivit nalezených v blocích lekce (jsonb `blocks`).
 * Učitel z nich může vytvářet odpovídající bloky v pracovním listu.
 */
export function extractActivitiesFromBlocks(blocks: unknown): LessonActivity[] {
  if (!Array.isArray(blocks)) return [];
  const out: LessonActivity[] = [];
  (blocks as any[]).forEach((b, idx) => {
    if (!b || typeof b !== "object" || b.type !== "activity") return;
    const p = (b.props ?? {}) as Record<string, unknown>;
    const at = String(p.activityType ?? "flashcards");
    const title =
      (typeof p.title === "string" && p.title.trim()) ||
      `Aktivita ${idx + 1}`;
    const instructions =
      typeof p.instructions === "string" ? p.instructions : undefined;
    out.push({
      id: `lesson-activity-${idx}`,
      activityType: at,
      title: title.length > 80 ? title.slice(0, 80) + "…" : title,
      instructions,
      props: p,
    });
  });
  return out;
}

/**
 * Extrahuje plain-text / markdown z blokové struktury (jsonb `blocks`)
 * používané v učitelských lekcích a textbook_lessons.
 */
export function extractTextFromBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const stripHtml = (s: unknown) =>
    String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const parts: string[] = [];

  for (const b of blocks as any[]) {
    if (!b || typeof b !== "object") continue;
    const p = b.props ?? {};
    switch (b.type) {
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
          // Extract <li> contents from HTML
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
        // Unknown block — try generic text/title fields as fallback
        const generic = [stripHtml(p.title), stripHtml(p.text), stripHtml(p.content), stripHtml(p.caption)].filter(Boolean);
        if (generic.length) parts.push(generic.join(" "));
        break;
      }
    }
  }
  return parts.filter(Boolean).join("\n");
}

