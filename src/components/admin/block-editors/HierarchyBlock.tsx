import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Level {
  id: string;
  label: string;
  description?: string;
  color?: string;
}

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const MIN_LEVELS = 2;
const MAX_LEVELS = 8;

const HierarchyBlock = ({ block, onChange }: Props) => {
  const shape: "pyramid" | "layers" | "steps" = block.props.shape || "pyramid";
  const direction: "top-to-bottom" | "bottom-to-top" = block.props.direction || "top-to-bottom";
  const levels: Level[] = Array.isArray(block.props.levels) ? block.props.levels : [];

  const update = (patch: Record<string, any>) => onChange({ ...block.props, ...patch });

  const updateLevel = (idx: number, patch: Partial<Level>) => {
    const next = levels.map((lvl, i) => (i === idx ? { ...lvl, ...patch } : lvl));
    update({ levels: next });
  };

  const addLevel = () => {
    if (levels.length >= MAX_LEVELS) return;
    update({
      levels: [...levels, { id: crypto.randomUUID(), label: "Nová úroveň", description: "" }],
    });
  };

  const removeLevel = (idx: number) => {
    if (levels.length <= MIN_LEVELS) return;
    update({ levels: levels.filter((_, i) => i !== idx) });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= levels.length) return;
    const next = [...levels];
    [next[idx], next[j]] = [next[j], next[idx]];
    update({ levels: next });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tvar</Label>
          <Select value={shape} onValueChange={(v) => update({ shape: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pyramid">Pyramida</SelectItem>
              <SelectItem value="layers">Vrstvy</SelectItem>
              <SelectItem value="steps">Schody</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Směr</Label>
          <Select value={direction} onValueChange={(v) => update({ direction: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top-to-bottom">Shora dolů (vrchol nahoře)</SelectItem>
              <SelectItem value="bottom-to-top">Zdola nahoru (základna nahoře)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Úrovně (min {MIN_LEVELS}, max {MAX_LEVELS}). První úroveň = vrchol pyramidy / horní vrstva.
        </Label>
        {levels.map((lvl, i) => (
          <div key={lvl.id ?? i} className="border border-border rounded p-2 space-y-2 relative bg-muted/20">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground w-6">{i + 1}.</span>
              <Input
                value={lvl.label}
                onChange={(e) => updateLevel(i, { label: e.target.value })}
                placeholder="Název úrovně"
                className="flex-1 text-sm h-8"
              />
              <input
                type="color"
                value={lvl.color || "#A065D7"}
                onChange={(e) => updateLevel(i, { color: e.target.value })}
                className="h-8 w-8 rounded border border-border cursor-pointer"
                title="Barva úrovně (volitelné)"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="Posunout nahoru"
              >
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(i, 1)}
                disabled={i === levels.length - 1}
                title="Posunout dolů"
              >
                <ArrowDown className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => removeLevel(i)}
                disabled={levels.length <= MIN_LEVELS}
                title="Odstranit"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <Textarea
              value={lvl.description || ""}
              onChange={(e) => updateLevel(i, { description: e.target.value })}
              placeholder="Popis (volitelné)"
              rows={2}
              className="text-sm"
            />
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={addLevel}
        disabled={levels.length >= MAX_LEVELS}
      >
        <Plus className="w-3 h-3 mr-1" />
        Přidat úroveň
      </Button>
    </div>
  );
};

export default HierarchyBlock;
