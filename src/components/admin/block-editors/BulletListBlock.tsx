import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const BulletListBlock = ({ block, onChange }: Props) => {
  const items: string[] = block.props.items || [""];

  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange({ ...block.props, items: next });
  };

  const add = () => onChange({ ...block.props, items: [...items, ""] });

  const remove = (i: number) => {
    if (items.length <= 1) return;
    onChange({ ...block.props, items: items.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1 items-center">
          <span className="text-muted-foreground text-xs w-4">•</span>
          <Input value={item} onChange={(e) => update(i, e.target.value)} placeholder="Položka…" className="flex-1" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(i)}><X className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={add}><Plus className="w-3 h-3 mr-1" />Přidat</Button>
    </div>
  );
};

export default BulletListBlock;
