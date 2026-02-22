import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const TableBlock = ({ block, onChange }: Props) => {
  const headers: string[] = block.props.headers || [""];
  const rows: string[][] = block.props.rows || [[""]];

  const updateHeader = (i: number, val: string) => {
    const next = [...headers];
    next[i] = val;
    onChange({ ...block.props, headers: next });
  };

  const updateCell = (r: number, c: number, val: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = val;
    onChange({ ...block.props, rows: next });
  };

  const addColumn = () => {
    onChange({
      ...block.props,
      headers: [...headers, ""],
      rows: rows.map((row) => [...row, ""]),
    });
  };

  const removeColumn = (i: number) => {
    if (headers.length <= 1) return;
    onChange({
      ...block.props,
      headers: headers.filter((_, idx) => idx !== i),
      rows: rows.map((row) => row.filter((_, idx) => idx !== i)),
    });
  };

  const addRow = () => onChange({ ...block.props, rows: [...rows, headers.map(() => "")] });

  const removeRow = (i: number) => {
    if (rows.length <= 1) return;
    onChange({ ...block.props, rows: rows.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="p-1">
                <div className="flex gap-1">
                  <Input value={h} onChange={(e) => updateHeader(i, e.target.value)} placeholder="Hlavička" className="font-semibold" />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeColumn(i)}><X className="w-3 h-3" /></Button>
                </div>
              </th>
            ))}
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="p-1">
                  <Input value={cell} onChange={(e) => updateCell(r, c, e.target.value)} />
                </td>
              ))}
              <td className="p-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeRow(r)}><X className="w-3 h-3" /></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={addRow}><Plus className="w-3 h-3 mr-1" />Řádek</Button>
        <Button size="sm" variant="ghost" onClick={addColumn}><Plus className="w-3 h-3 mr-1" />Sloupec</Button>
      </div>
    </div>
  );
};

export default TableBlock;
