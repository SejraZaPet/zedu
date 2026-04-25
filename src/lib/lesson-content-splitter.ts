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
