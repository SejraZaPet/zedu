/**
 * Čitelný popisek položky pracovního listu pro hodnocení, výsledky a statistiky.
 * Mnoho položek (write_lines, blank_box, table, two_boxes) nemá vlastní `prompt`;
 * text zadání je v typovém poli nebo v předchozím nadpisu/pokynu.
 */
const HEADING_TYPES = new Set(["section_header", "instruction_box"]);

function clean(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/<[^>]*>/g, " ").replace(/[*_#`>]+/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
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

export function worksheetItemLabel(item: any, items: any[] = []): string {
  const fallback = `Úloha ${item?.itemNumber ?? ""}`.trim();
  const own = ownText(item);
  if (own) return own;
  const idx = items.findIndex((it) => it?.id === item?.id);
  for (let i = idx - 1; i >= 0; i--) {
    const prev = items[i];
    if (HEADING_TYPES.has(prev?.type)) {
      const t = ownText(prev);
      if (t) return item?.itemNumber != null ? `${t} (úloha ${item.itemNumber})` : t;
      break;
    }
  }
  return fallback;
}
