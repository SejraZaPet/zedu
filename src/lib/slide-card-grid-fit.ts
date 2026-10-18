export interface SlideCardLike {
  title?: string;
  text?: string;
  mode?: string;
  items?: string[];
}

export interface CardGridFit {
  columns: number;
  rows: number;
  titleRem: number;
  bodyRem: number;
  /** Minimální výška jedné karty v px na scéně 1600×900. */
  cardMinHeight: number;
}

const contentLength = (c: SlideCardLike) =>
  (c.title?.length || 0) +
  (c.mode === "bullets" ? (c.items || []).join(" ").length : (c.text || "").replace(/<[^>]+>/g, "").length);

/**
 * Velikost písma karet při promítání: čím méně karet a textu, tím větší písmo.
 * Výsledek se ještě zmenší plátnem, pokud by obsah přetekl.
 */
export function fitCardGrid(cards: SlideCardLike[], requestedColumns?: number): CardGridFit {
  const n = Math.max(1, cards.length);
  const columns = n === 1 ? 1 : n === 2 || n === 4 ? 2 : requestedColumns === 2 ? 2 : 3;
  const rows = Math.ceil(n / columns);
  const maxLen = Math.max(0, ...cards.map(contentLength));

  let bodyRem = n === 1 ? 3 : columns === 2 && rows === 1 ? 2.5 : 2;
  if (maxLen > 120) bodyRem -= 0.25;
  if (maxLen > 240) bodyRem -= 0.25;
  if (rows > 1) bodyRem = Math.min(bodyRem, 1.875);
  bodyRem = Math.max(1.75, bodyRem);

  const titleRem = Math.round(bodyRem * 1.3 * 100) / 100;
  const cardMinHeight = rows === 1 ? 640 : Math.floor(660 / rows);
  return { columns, rows, titleRem, bodyRem, cardMinHeight };
}
