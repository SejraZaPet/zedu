/**
 * Čitelný popisek položky pracovního listu pro hodnocení, výsledky a statistiky.
 * Mnoho položek (blank_box, write_lines, table, two_boxes) nemá vlastní `prompt`;
 * zadání je v typovém poli nebo v předchozím nadpisu/pokynu. Nikdy nevrací „Úloha N“.
 */
const HEADING_TYPES = new Set(["section_header", "instruction_box"]);
const MAX_LEN = 140;

export const WORKSHEET_TYPE_NAMES: Record<string, string> = {
  blank_box: "Volná odpověď",
  write_lines: "Odpověď na řádky",
  table: "Tabulka",
  two_boxes: "Dva rámečky",
  open_answer: "Otevřená odpověď",
  short_answer: "Krátká odpověď",
  mcq: "Výběr z možností",
  true_false: "Pravda / nepravda",
  matching: "Spojování",
  ordering: "Řazení",
  sorting: "Třídění",
  fill_blank: "Doplňování",
  image_label: "Popis obrázku",
  mind_map: "Myšlenková mapa",
  word_search: "Osmisměrka",
  offline_activity: "Aktivita",
};

function clean(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/[*_#`>]+/g, "").replace(/\s+/g, " ").trim();
}

function shorten(t: string): string {
  const s = t.replace(/[\s:–-]+$/, "").trim();
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1).trimEnd() + "…" : s;
}

function ownText(item: any): string {
  if (!item) return "";
  const cands = [
    item.prompt, item.tableCaption, item.leftTitle, item.rightTitle, item.calloutText,
    item.imageCaption, item.imageText, item.imageAlt, item.mindMap?.root?.text, item.mindMap?.root?.label,
    typeof item.mindMap?.root === "string" ? item.mindMap.root : undefined,
    item.activitySpec?.question, item.activitySpec?.title, item.title, item.text, item.instruction,
  ];
  for (const c of cands) { const t = clean(c); if (t) return t; }
  return "";
}

export type WorksheetLabelSource = "own" | "heading" | "type";

/** Popisek bez čísla úlohy; číslo doplňuje volající jen jednou. */
export function worksheetItemLabelInfo(item: any, items: any[] = []): { text: string; source: WorksheetLabelSource } {
  const own = ownText(item);
  if (own) return { text: shorten(own), source: "own" };
  const idx = items.findIndex((it) => it?.id === item?.id);
  for (let i = idx - 1; i >= 0; i--) {
    const prev = items[i];
    if (HEADING_TYPES.has(prev?.type)) {
      const t = ownText(prev);
      if (t) return { text: shorten(t), source: "heading" };
      break;
    }
    if (prev && !HEADING_TYPES.has(prev.type)) break;
  }
  return { text: WORKSHEET_TYPE_NAMES[item?.type] ?? "Odpověď", source: "type" };
}

export function worksheetItemLabel(item: any, items: any[] = []): string {
  return worksheetItemLabelInfo(item, items).text;
}

/** Pro výpisy bez pořadí (výsledky, statistiky): odliší shodné popisky číslem z listu. */
export function worksheetItemLabelNumbered(item: any, items: any[] = []): string {
  const { text, source } = worksheetItemLabelInfo(item, items);
  return source !== "own" && item?.itemNumber != null ? `${text} (č. ${item.itemNumber})` : text;
}
