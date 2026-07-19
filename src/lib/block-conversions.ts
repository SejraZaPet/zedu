import type { Block, BlockType } from "./textbook-config";

/**
 * Client-side helpers for the "Change to…" action in BlockEditor.
 *  - FORMAT_TARGETS: which types a given block can be losslessly-ish converted to.
 *  - convertBlock: produces new props for the target type from the source block.
 *  - blockToPlainText: extracts plaintext for AI prompts.
 */

const stripHtml = (html: unknown): string => {
  if (typeof html !== "string") return "";
  // Replace common block/line-break tags with newlines, then strip remaining tags.
  return html
    .replace(/<\s*\/?\s*(br|p|div|li)\s*[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const splitIntoItems = (text: string): string[] => {
  const parts = text
    .split(/\r?\n+/)
    .map((s) => s.replace(/^[\s•\-–—·*]+/, "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
};

/** Which target types are offered in the "Format" section for a given source type. */
export const FORMAT_TARGETS: Partial<Record<BlockType, BlockType[]>> = {
  heading: ["paragraph", "bullet_list", "quote", "callout"],
  paragraph: ["heading", "bullet_list", "quote", "callout"],
  bullet_list: ["heading", "paragraph", "quote", "callout"],
  quote: ["heading", "paragraph", "bullet_list", "callout"],
  callout: ["heading", "paragraph", "bullet_list", "quote"],
  table: ["card_grid", "two_column"],
  card_grid: ["table"],
  two_column: ["table"],
};

/**
 * Convert a block's props to the shape expected by `target`.
 * Returns null when the conversion isn't supported (or would be ambiguous).
 */
export const convertBlock = (
  block: Block,
  target: BlockType,
): Record<string, any> | null => {
  const p = block.props || {};

  // ---------- TEXT category ----------
  if (block.type === "heading") {
    const text = stripHtml(p.text);
    if (target === "paragraph") return { text };
    if (target === "bullet_list") return { items: [text].filter(Boolean) };
    if (target === "quote") return { text, author: "" };
    if (target === "callout") return { calloutType: "note", text };
  }

  if (block.type === "paragraph") {
    const text = stripHtml(p.text);
    if (target === "heading") return { level: 2, text };
    if (target === "bullet_list") return { items: splitIntoItems(text) };
    if (target === "quote") return { text, author: "" };
    if (target === "callout") return { calloutType: "note", text };
  }

  if (block.type === "bullet_list") {
    const items: string[] = Array.isArray(p.items)
      ? p.items.map((i: unknown) => stripHtml(i)).filter(Boolean)
      : [];
    if (target === "heading") return { level: 2, text: items.join(" · ") };
    if (target === "paragraph") return { text: items.join("\n\n") };
    if (target === "quote") return { text: items.join(" — "), author: "" };
    if (target === "callout") return { calloutType: "note", text: items.join("\n") };
  }

  if (block.type === "quote") {
    const text = stripHtml(p.text);
    const author = typeof p.author === "string" ? p.author.trim() : "";
    if (target === "heading") return { level: 2, text };
    if (target === "paragraph") return { text: author ? `${text} (${author})` : text };
    if (target === "bullet_list")
      return { items: [text, author].filter(Boolean) };
    if (target === "callout") return { calloutType: "note", text };
  }

  if (block.type === "callout") {
    const text = stripHtml(p.text);
    if (target === "heading") return { level: 2, text };
    if (target === "paragraph") return { text };
    if (target === "bullet_list") return { items: splitIntoItems(text) };
    if (target === "quote") return { text, author: "" };
  }

  // ---------- STRUCTURE category ----------
  if (block.type === "table") {
    const headers: string[] = Array.isArray(p.headers) ? p.headers.map(String) : [];
    const rows: string[][] = Array.isArray(p.rows)
      ? p.rows.map((r: any) => (Array.isArray(r) ? r.map(String) : []))
      : [];
    if (target === "card_grid") {
      const cards = rows.map((r) => ({
        title: r[0] ?? "",
        text: r.slice(1).filter(Boolean).join(" — "),
      }));
      return {
        columns: Math.min(Math.max(headers.length || 2, 2), 3),
        cards: cards.length > 0 ? cards : [{ title: "", text: "" }, { title: "", text: "" }],
      };
    }
    if (target === "two_column") {
      if (headers.length !== 2) return null;
      const left = rows.map((r) => r[0] ?? "").filter(Boolean).join("\n\n");
      const right = rows.map((r) => r[1] ?? "").filter(Boolean).join("\n\n");
      return { left, right };
    }
  }

  if (block.type === "card_grid") {
    const cards: { title?: string; text?: string }[] = Array.isArray(p.cards) ? p.cards : [];
    if (target === "table") {
      return {
        headers: ["Název", "Popis"],
        rows: cards.length > 0
          ? cards.map((c) => [stripHtml(c.title), stripHtml(c.text)])
          : [["", ""]],
      };
    }
  }

  if (block.type === "two_column") {
    if (target === "table") {
      return {
        headers: ["Sloupec 1", "Sloupec 2"],
        rows: [[stripHtml(p.left), stripHtml(p.right)]],
      };
    }
  }

  return null;
};

/** Extract a plaintext representation of the block for AI prompts. */
export const blockToPlainText = (block: Block): string => {
  const p = block.props || {};
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "quote":
    case "callout":
      return stripHtml(p.text);
    case "bullet_list":
      return (Array.isArray(p.items) ? p.items : [])
        .map((i: unknown) => `- ${stripHtml(i)}`)
        .join("\n");
    case "summary":
      return [stripHtml(p.title), stripHtml(p.text)].filter(Boolean).join("\n\n");
    case "table": {
      const headers: string[] = Array.isArray(p.headers) ? p.headers.map(String) : [];
      const rows: string[][] = Array.isArray(p.rows)
        ? p.rows.map((r: any) => (Array.isArray(r) ? r.map(String) : []))
        : [];
      const lines: string[] = [];
      if (headers.length) lines.push(headers.join("\t"));
      for (const r of rows) lines.push(r.join("\t"));
      return lines.join("\n");
    }
    case "card_grid":
      return (Array.isArray(p.cards) ? p.cards : [])
        .map((c: any) =>
          [stripHtml(c?.title), stripHtml(c?.text)].filter(Boolean).join(" — "),
        )
        .filter(Boolean)
        .join("\n");
    case "two_column":
      return [stripHtml(p.left), stripHtml(p.right)].filter(Boolean).join("\n\n");
    case "accordion":
      return (Array.isArray(p.items) ? p.items : [])
        .map((i: any) =>
          `${stripHtml(i?.title)}\n${stripHtml(i?.content)}`.trim(),
        )
        .filter(Boolean)
        .join("\n\n");
    default:
      return "";
  }
};

/** True when the block has enough textual content to feed an AI transformation. */
export const blockHasAiText = (block: Block): boolean =>
  blockToPlainText(block).trim().length > 8;
