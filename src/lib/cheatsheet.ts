export const CHEATSHEET_STORAGE_MARKER = "bezli:cheatsheet:v1";
export const CHEATSHEET_LIMITS = { widthMm: 90, heightMm: 55, lines: 8, characters: 220, minFontPt: 7, cardsPerPage: 10 } as const;
export interface CheatsheetData { version: 1; title: string; subject: string; front: string; back: string; fontPt: number }
export interface Cheatsheet extends CheatsheetData { id: string; notebookId: string }
export const emptyCheatsheet = (): CheatsheetData => ({ version: 1, title: "Tahák", subject: "", front: "", back: "", fontPt: 8 });
export const plainCheatsheetText = (text: string) => text.replace(/\r\n?/g, "\n");
export function sideStats(text: string) {
  const normalized = plainCheatsheetText(text);
  const characters = Array.from(normalized).length;
  const lines = normalized ? normalized.split("\n").length : 0;
  return { characters, lines, valid: characters <= 220 && lines <= 8 };
}
export function validCheatsheet(data: CheatsheetData) {
  return data.version === 1 && data.title.length <= 80 && data.subject.length <= 80 && sideStats(data.front).valid && sideStats(data.back).valid && Number.isFinite(data.fontPt) && data.fontPt >= 7 && data.fontPt <= 12;
}
export function parseCheatsheet(raw: unknown): CheatsheetData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== 1 || typeof d.title !== "string" || typeof d.subject !== "string" || typeof d.front !== "string" || typeof d.back !== "string" || typeof d.fontPt !== "number") return null;
  const data: CheatsheetData = { version: 1, title: d.title, subject: d.subject, front: d.front, back: d.back, fontPt: d.fontPt };
  return validCheatsheet(data) ? data : null;
}
export function cheatSheetAllowed(settings: unknown): boolean {
  return !!settings && typeof settings === "object" && (settings as Record<string, unknown>).cheatSheetAllowed === true;
}
/** Long-edge duplex: mirror columns, never the letters or row order. */
export function duplexIndex(index: number): number { return Math.floor(index / 2) * 2 + 1 - index % 2; }
export const CHEATSHEET_SYMBOLS = ["•", "→", "←", "↑", "↓", "⇒", "≈", "≠", "≤", "≥", "±", "°", "Δ", "∑", "✓", "✗"];