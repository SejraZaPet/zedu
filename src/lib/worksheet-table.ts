import type { WorksheetItem } from "@/lib/worksheet-spec";

/** Počet sloupců tabulky. */
export const tableColCount = (item: Pick<WorksheetItem, "tableRows">) =>
  Math.max(1, ...(item.tableRows ?? []).map((r) => r.length));

const EMPTY_TABLE_ROWS: string[][] = [["Sloupec 1", "Sloupec 2"], ["", ""]];

/** Stejná výchozí tabulka pro formulář i inline úpravy. */
export const tableRowsForEditor = (item: Pick<WorksheetItem, "tableRows">): string[][] =>
  item.tableRows && item.tableRows.length > 0 ? item.tableRows : EMPTY_TABLE_ROWS;

/** Sjednotí počet buněk a zachová explicitní mapu „k vyplnění“ jako dosavadní formulář. */
export function updateTableRows(
  item: Pick<WorksheetItem, "tableRows" | "tableEditable">,
  next: string[][],
  cols = tableColCount(item),
): Pick<WorksheetItem, "tableRows" | "tableEditable"> {
  const tableRows = next.map((row) => {
    const copy = [...row];
    while (copy.length < cols) copy.push("");
    return copy.slice(0, cols);
  });
  return item.tableEditable
    ? {
        tableRows,
        tableEditable: tableRows.map((row, ri) => row.map((_, ci) =>
          ri > 0 && (item.tableEditable?.[ri]?.[ci] ?? row[ci].trim() === ""))),
      }
    : { tableRows };
}

/** Jedna textová buňka; sdíleno formulářem i inline editorem. */
export function updateTableCellText(
  item: Pick<WorksheetItem, "tableRows" | "tableEditable">,
  row: number,
  col: number,
  value: string,
): Pick<WorksheetItem, "tableRows" | "tableEditable"> {
  const rows = tableRowsForEditor(item);
  const cols = tableColCount({ tableRows: rows });
  if (!rows[row] || col < 0 || col >= cols) return { tableRows: rows };
  const next = rows.map((entry) => [...entry]);
  next[row][col] = value;
  return updateTableRows(item, next, cols);
}

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
