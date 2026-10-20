import type { WorksheetItem } from "@/lib/worksheet-spec";

/** Počet sloupců tabulky. */
export const tableColCount = (item: Pick<WorksheetItem, "tableRows">) =>
  Math.max(1, ...(item.tableRows ?? []).map((r) => r.length));

/** Vyplňuje žák buňku? Hlavička nikdy; bez nastavení učitele = prázdná buňka. */
export function isTableCellEditable(item: Pick<WorksheetItem, "tableRows" | "tableEditable">, r: number, c: number): boolean {
  if (r <= 0) return false;
  const explicit = item.tableEditable?.[r]?.[c];
  if (typeof explicit === "boolean") return explicit;
  return String(item.tableRows?.[r]?.[c] ?? "").trim() === "";
}

export function hasEditableTableCells(item: Pick<WorksheetItem, "type" | "tableRows" | "tableEditable">): boolean {
  if (item.type !== "table") return false;
  const rows = item.tableRows ?? [];
  return rows.some((row, r) => row.some((_, c) => isTableCellEditable(item, r, c)));
}

/** Index buňky v odpovědi: řádky bez hlavičky, řádek po řádku. */
export const tableCellIndex = (item: Pick<WorksheetItem, "tableRows">, r: number, c: number) =>
  (r - 1) * tableColCount(item) + c;

export function tableCellAnswer(item: Pick<WorksheetItem, "tableRows">, value: unknown, r: number, c: number): string {
  if (!Array.isArray(value)) return "";
  return String(value[tableCellIndex(item, r, c)] ?? "");
}

/** Nová odpověď s jednou změněnou buňkou. */
export function setTableCellAnswer(item: Pick<WorksheetItem, "tableRows">, value: unknown, r: number, c: number, text: string): string[] {
  const rows = item.tableRows ?? [];
  const size = Math.max(0, rows.length - 1) * tableColCount(item);
  const next = Array.from({ length: size }, (_, i) => (Array.isArray(value) ? String(value[i] ?? "") : ""));
  next[tableCellIndex(item, r, c)] = text;
  return next;
}
