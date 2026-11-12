/**
 * TableItem — tabulka v pracovním listu.
 *
 * Pevné buňky jsou jen text; buňky „k vyplnění“ mají běžné textarea
 * (klávesnice i rozpoznání rukopisu perem). Odpověď = string[] bez hlavičky.
 */

import type { WorksheetItemProps } from "./types";
import { InlineText } from "@/components/worksheet/InlineText";
import { isTableCellEditable, setTableCellAnswer, tableCellAnswer } from "@/lib/worksheet-table";

export default function TableItem({ item, value, onChange, disabled, onEditText }: WorksheetItemProps) {
  const rows = item.tableRows ?? [];
  if (rows.length === 0) return null;
  const [head, ...rest] = rows;

  return (
    <div className="space-y-2">
      <div className="w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              {head.map((cell, i) => (
                <th key={i} className="min-w-0 break-words border border-border px-3 py-2 text-left font-semibold text-foreground">
                  {onEditText ? (
                    <InlineText
                      value={cell}
                      onCommit={(text) => onEditText(`tableRows.0.${i}`, text)}
                      ariaLabel={`Hlavička ${i + 1}`}
                      placeholder={`Sloupec ${i + 1}`}
                    />
                  ) : cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rest.map((row, ri) => (
              <tr key={ri} className="h-[10mm]">
                {row.map((cell, ci) => {
                  const r = ri + 1;
                  const editable = isTableCellEditable(item, r, ci);
                  return (
                    <td key={ci} className="h-[10mm] min-w-0 break-words border border-border px-3 py-[2mm] align-top text-foreground">
                      {editable ? (
                        <textarea
                          rows={1}
                          value={tableCellAnswer(item, value, r, ci)}
                          disabled={disabled}
                          aria-label={`Řádek ${r}, sloupec ${ci + 1}${head[ci] ? ` (${head[ci]})` : ""}`}
                          onChange={(e) => onChange(setTableCellAnswer(item, value, r, ci, e.target.value))}
                          className="block min-h-11 w-full min-w-[6rem] resize-y rounded border border-input bg-background px-2 py-1 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-80"
                        />
                      ) : onEditText ? (
                        <InlineText
                          value={cell}
                          onCommit={(text) => onEditText(`tableRows.${r}.${ci}`, text)}
                          multiline
                          ariaLabel={`Buňka řádek ${r + 1}, sloupec ${ci + 1}`}
                          placeholder="Text buňky"
                        />
                      ) : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {item.tableCaption && (
        <p className="text-xs text-muted-foreground">{item.tableCaption}</p>
      )}
    </div>
  );
}
