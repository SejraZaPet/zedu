import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShapeRenderer, { SHAPE_KINDS } from "@/components/blocks/ShapeRenderer";
import ColorPicker from "@/components/admin/ColorPicker";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ShapeBlock = ({ block, onChange }: Props) => {
  const p = block.props || {};
  const set = (patch: Record<string, any>) => onChange({ ...p, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label className="text-[11px] text-muted-foreground">Typ tvaru</Label>
          <Select value={p.shapeKind || "rectangle"} onValueChange={(v) => set({ shapeKind: v })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHAPE_KINDS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <Label className="text-[11px] text-muted-foreground">Šířka obrysu</Label>
          <Input
            type="number"
            min={0}
            max={20}
            className="mt-1 h-8 text-xs"
            value={p.strokeWidth ?? 2}
            onChange={(e) => set({ strokeWidth: Number(e.target.value) })}
          />
        </div>
        <div className="w-28">
          <Label className="text-[11px] text-muted-foreground">Výška (px)</Label>
          <Input
            type="number"
            min={20}
            max={800}
            className="mt-1 h-8 text-xs"
            value={p.height ?? 160}
            onChange={(e) => set({ height: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Výplň</Label>
        <ColorPicker
          value={p.fillColor === "none" ? null : p.fillColor}
          onChange={(v) => set({ fillColor: v ?? "none" })}
          allowNull
          nullLabel="Bez"
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Obrys</Label>
        <ColorPicker
          value={p.strokeColor === "none" ? null : p.strokeColor}
          onChange={(v) => set({ strokeColor: v ?? "none" })}
          allowNull
          nullLabel="Bez"
          className="mt-1"
        />
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-2">
        <ShapeRenderer
          shapeKind={p.shapeKind}
          fillColor={p.fillColor}
          strokeColor={p.strokeColor}
          strokeWidth={p.strokeWidth}
          height={Math.min(Number(p.height) || 160, 160)}
        />
      </div>
    </div>
  );
};

export default ShapeBlock;
