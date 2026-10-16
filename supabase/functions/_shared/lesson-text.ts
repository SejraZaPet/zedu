// Pure extraction shared by lesson AI functions and the client; no runtime imports.
export const LESSON_TEXT_LIMIT = 8000;
export const MIN_PRACTICE_TEXT_LENGTH = 200;
export const INSUFFICIENT_LESSON_TEXT = "Tato lekce zatím nemá dost textu pro procvičení";

const entities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", bull: "•", copy: "©",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í",
  oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú", yacute: "ý", Yacute: "Ý",
  times: "×", divide: "÷", deg: "°", euro: "€", ensp: " ", emsp: " ", thinsp: " ",
};

/** Strip markup before decoding entities, retaining paragraph/heading boundaries. */
export function cleanLessonText(value: string): string {
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|section)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, name: string) => {
      if (!name.startsWith("#")) return entities[name] ?? entity;
      const code = name[1]?.toLowerCase() === "x"
        ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : "";
    })
    .replace(/[\t\r \u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Only traverse content fields; never include IDs, media URLs or styling metadata. */
export function blocksToText(blocks: unknown, maxLength = LESSON_TEXT_LIMIT): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  const textFields = ["text", "title", "heading", "caption", "content", "question", "explanation", "front", "back"];
  const nestedFields = ["props", "children", "blocks", "items", "data", "quiz", "answers", "flashcards", "revealCards", "cards"];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      const text = cleanLessonText(node);
      if (text) out.push(text);
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const field of textFields) {
        if (typeof record[field] === "string") walk(record[field]);
      }
      for (const field of nestedFields) {
        if (record[field] && typeof record[field] === "object") walk(record[field]);
      }
    }
  };
  walk(blocks);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, Math.max(0, maxLength));
}

export function hasEnoughLessonText(text: string): boolean {
  return text.trim().length >= MIN_PRACTICE_TEXT_LENGTH;
}