import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShapeRenderer, { SHAPE_KINDS } from "@/components/blocks/ShapeRenderer";
import { SLIDE_TEXT_COLORS } from "@/lib/slide-typography";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ColorRow = ({
  label,
  value,
  onPick,
  allowNone,
}: {
  label: string;
  value: string | null | undefined;
  onPick: (v: string | null) => void;
  allowNone?: boolean;
}) => (
  <div>
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <div className="mt-1 flex items-center gap-1.5">
      {allowNone && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`h-6 rounded border px-1.5 text-[10px] ${!value ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
        >
          Bez
        </button>
      )}
      {SLIDE_TEXT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`${label} ${c}`}
          onClick={() => onPick(c)}
          className={`h-6 w-6 rounded-full border-2 transition-transform ${value === c ? "border-primary scale-110" : "border-border"}`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={/^#/.test(value || "") ? (value as string) : "#000000"}
        onChange={(e) => onPick(e.target.value)}
        className="h-6 w-9 cursor-pointer rounded border border-border bg-transparent"
        aria-label={`Vlastní ${label.toLowerCase()}`}
      />
    </div>
  </div>
);

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

      <ColorRow label="Výplň" value={p.fillColor} onPick={(v) => set({ fillColor: v ?? "none" })} allowNone />
      <ColorRow label="Obrys" value={p.strokeColor} onPick={(v) => set({ strokeColor: v ?? "none" })} allowNone />

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
