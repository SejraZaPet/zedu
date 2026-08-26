import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShapeRenderer, { SHAPE_KINDS, type ShapeKind } from "@/components/blocks/ShapeRenderer";
import ColorPicker from "@/components/admin/ColorPicker";
import { Square } from "lucide-react";

interface Props {
  onPick: (props: { shapeKind: ShapeKind; fillColor: string; strokeColor: string; strokeWidth: number }) => void;
}

/** Rychlé vložení tvaru na slide s volbou typu a barev. */
const ShapePickerPopover = ({ onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [fillColor, setFillColor] = useState("#6EC6D9");
  const [strokeColor, setStrokeColor] = useState("#9B6CFF");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1">
          <Square className="h-3.5 w-3.5" /> Tvar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Typ tvaru</Label>
          <Select value={shapeKind} onValueChange={(v) => setShapeKind(v as ShapeKind)}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHAPE_KINDS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Výplň</Label>
          <ColorPicker
            value={fillColor === "none" ? null : fillColor}
            onChange={(v) => setFillColor(v ?? "none")}
            allowNull
            nullLabel="Bez"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Obrys</Label>
          <ColorPicker
            value={strokeColor === "none" ? null : strokeColor}
            onChange={(v) => setStrokeColor(v ?? "none")}
            allowNull
            nullLabel="Bez"
            className="mt-1"
          />
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-2">
          <ShapeRenderer shapeKind={shapeKind} fillColor={fillColor} strokeColor={strokeColor} strokeWidth={2} height={80} />
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            onPick({ shapeKind, fillColor, strokeColor, strokeWidth: 2 });
            setOpen(false);
          }}
        >
          Vložit tvar
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default ShapePickerPopover;
