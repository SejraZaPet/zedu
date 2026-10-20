/**
 * TableFieldsEditor — editace tabulkového bloku v editoru pracovního listu.
 *
 * Umožňuje přidat/smazat řádek i sloupec a upravit text v libovolné buňce.
 * Buňky mimo hlavičku lze označit „k vyplnění“ — žák je vyplní v digitálním listu.
 */

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorksheetItem } from "@/lib/worksheet-spec";
import { isTableCellEditable } from "@/lib/worksheet-table";

const EMPTY: string[][] = [["Sloupec 1", "Sloupec 2"], ["", ""]];

export default function TableFieldsEditor({
  item,
  onUpdate,
}: {
  item: WorksheetItem;
  onUpdate: (patch: Partial<WorksheetItem>) => void;
}) {
  if (item.type !== "table") return null;

  const rows: string[][] = item.tableRows && item.tableRows.length > 0 ? item.tableRows : EMPTY;
  const colCount = Math.max(1, ...rows.map((r) => r.length));

  /** Zajistí, že všechny řádky mají stejný počet buněk. */
  const normalize = (next: string[][], cols = colCount) =>
    next.map((r) => {
      const copy = [...r];
      while (copy.length < cols) copy.push("");
      return copy.slice(0, cols);
    });

  // Explicitní mapa „k vyplnění“ se přepočítá jen když ji učitel už nastavil.
  const setRows = (next: string[][], cols = colCount) => {
    const tableRows = normalize(next, cols);
    onUpdate(item.tableEditable
      ? { tableRows, tableEditable: tableRows.map((r, ri) => r.map((_, ci) => ri > 0 && (item.tableEditable?.[ri]?.[ci] ?? r[ci].trim() === ""))) }
      : { tableRows });
  };

  const toggleEditable = (ri: number, ci: number, on: boolean) => {
    const map = rows.map((r, r2) => r.map((_, c2) => isTableCellEditable(item, r2, c2)));
    map[ri][ci] = on;
    onUpdate({ tableEditable: map });
  };

  const setCell = (ri: number, ci: number, value: string) => {
    const next = rows.map((r) => [...r]);
    next[ri][ci] = value;
    setRows(next);
  };

  const addRow = () => setRows([...rows, Array(colCount).fill("")]);
  const removeRow = (ri: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== ri));
  };
  const addColumn = () =>
    setRows(
      rows.map((r, ri) => [...r, ri === 0 ? `Sloupec ${colCount + 1}` : ""]),
      colCount + 1,
    );
  const removeColumn = (ci: number) => {
    if (colCount <= 1) return;
    setRows(
      rows.map((r) => r.filter((_, i) => i !== ci)),
      colCount - 1,
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Tabulka (první řádek je hlavička; žák vyplňuje buňky „k vyplnění“)</Label>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Řádek
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addColumn}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Sloupec
          </Button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className={`${colCount <= 4 ? "w-full" : "min-w-[720px]"} table-fixed border-separate border-spacing-1`}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: colCount }).map((_, ci) => (
                <th key={ci} className="align-bottom">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    aria-label={`Smazat sloupec ${ci + 1}`}
                    onClick={() => removeColumn(ci)}
                    disabled={colCount <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    aria-label={`Smazat řádek ${ri + 1}`}
                    onClick={() => removeRow(ri)}
                    disabled={rows.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
                {Array.from({ length: colCount }).map((_, ci) => (
                  <td key={ci}>
                    <Input
                      value={row[ci] ?? ""}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      className={`h-8 min-w-0 text-sm ${ri === 0 ? "font-semibold" : ""}`}
                      placeholder={ri === 0 ? `Sloupec ${ci + 1}` : ""}
                    />
                    {ri > 0 && (
                      <label className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={isTableCellEditable(item, ri, ci)}
                          onChange={(e) => toggleEditable(ri, ci, e.target.checked)}
                        />
                        k vyplnění
                      </label>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <Label className="text-xs">Popisek tabulky (volitelné)</Label>
        <Input
          value={item.tableCaption ?? ""}
          onChange={(e) => onUpdate({ tableCaption: e.target.value })}
          placeholder="Např. Zdroj: lekce"
        />
      </div>
    </div>
  );
}
