import type { Block } from "./textbook-config";

/**
 * Převod jednoduchého Markdownu (nadpisy, tučný text, odrážky, obrázkové
 * placeholdery `![popis](url)`) na blokovou strukturu používanou WYSIWYG
 * editorem lekcí (`BlockEditor`) a rendererem `LessonBlock`.
 *
 * Používá se při přechodu starších modulů Akademie z Markdownu na bloky.
 */

const newId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `blk-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline Markdown → bezpečné HTML (tučně, kurzíva, kód, odkazy). */
export const inlineMarkdownToHtml = (raw: string): string => {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return s;
};

const block = (type: Block["type"], props: Record<string, unknown>): Block =>
  ({ id: newId(), type, visible: true, props } as Block);

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]*)\)\s*$/;

export const markdownToBlocks = (markdown: string): Block[] => {
  if (!markdown || !markdown.trim()) return [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const html = paragraph.map(inlineMarkdownToHtml).join("<br />");
    blocks.push(block("paragraph", { text: html }));
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(block("bullet_list", { items: bullets.map(inlineMarkdownToHtml) }));
    bullets = [];
  };
  const flushOrdered = () => {
    if (ordered.length === 0) return;
    const html = `<ol>${ordered.map((i) => `<li>${inlineMarkdownToHtml(i)}</li>`).join("")}</ol>`;
    blocks.push(block("bullet_list", { html }));
    ordered = [];
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push(block("quote", { text: quote.map(inlineMarkdownToHtml).join(" "), author: "" }));
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushOrdered();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") {
      flushAll();
      continue;
    }

    const img = line.match(IMAGE_LINE);
    if (img) {
      flushAll();
      const alt = img[1].trim();
      const url = img[2].trim();
      blocks.push(
        block("image", {
          url,
          alt,
          caption: alt,
          width: "full",
          alignment: "center",
        }),
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      blocks.push(block("divider", {}));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(Math.max(heading[1].length, 2), 4);
      blocks.push(block("heading", { level, text: inlineMarkdownToHtml(heading[2].trim()) }));
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushOrdered();
      flushQuote();
      bullets.push(bullet[1].trim());
      continue;
    }

    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (num) {
      flushParagraph();
      flushBullets();
      flushQuote();
      ordered.push(num[1].trim());
      continue;
    }

    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      quote.push(q[1].trim());
      continue;
    }

    flushBullets();
    flushOrdered();
    flushQuote();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
};

/** True když jsou bloky prázdné a je potřeba fallback na Markdown. */
export const hasBlocks = (blocks: unknown): blocks is Block[] =>
  Array.isArray(blocks) && blocks.length > 0;

export default markdownToBlocks;
