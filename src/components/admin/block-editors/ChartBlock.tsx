import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import ChartRenderer, { type ChartDatum } from "@/components/blocks/ChartRenderer";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ChartBlock = ({ block, onChange }: Props) => {
  const p = block.props || {};
  const data: ChartDatum[] = Array.isArray(p.data) ? p.data : [];
  const set = (patch: Record<string, any>) => onChange({ ...p, ...patch });
  const setRow = (i: number, patch: Partial<ChartDatum>) =>
    set({ data: data.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label className="text-[11px] text-muted-foreground">Typ grafu</Label>
          <Select value={p.chartKind || "bar"} onValueChange={(v) => set({ chartKind: v })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Sloupcový</SelectItem>
              <SelectItem value="pie">Kruhový (výsečový)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label className="text-[11px] text-muted-foreground">Nadpis grafu (volitelné)</Label>
          <Input
            className="mt-1 h-8 text-xs"
            value={p.title || ""}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="např. Podíl surovin"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Data</Label>
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="h-8 flex-1 text-xs"
              value={d.label ?? ""}
              onChange={(e) => setRow(i, { label: e.target.value })}
              placeholder="Popisek"
            />
            <Input
              type="number"
              className="h-8 w-24 text-xs"
              value={Number.isFinite(d.value) ? d.value : 0}
              onChange={(e) => setRow(i, { value: Number(e.target.value) })}
              placeholder="Hodnota"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => set({ data: data.filter((_, j) => j !== i) })}
              aria-label="Smazat řádek"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          onClick={() => set({ data: [...data, { label: "", value: 0 }] })}
        >
          <Plus className="h-3.5 w-3.5" /> Přidat řádek
        </Button>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-2">
        <ChartRenderer chartKind={p.chartKind} title={p.title} data={data} height={200} />
      </div>
    </div>
  );
};

export default ChartBlock;
