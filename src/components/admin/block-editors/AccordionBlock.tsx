import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const AccordionBlock = ({ block, onChange }: Props) => {
  const items: { title: string; content: string }[] = block.props.items || [];

  const update = (i: number, field: string, val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...block.props, items: next });
  };

  const add = () => onChange({ ...block.props, items: [...items, { title: "", content: "" }] });

  const remove = (i: number) => {
    if (items.length <= 1) return;
    onChange({ ...block.props, items: items.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-border rounded p-2 space-y-1 relative">
          <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(i)}><X className="w-3 h-3" /></Button>
          <Input value={item.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Název sekce" className="font-medium" />
          <Textarea value={item.content} onChange={(e) => update(i, "content", e.target.value)} placeholder="Obsah…" rows={2} />
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={add}><Plus className="w-3 h-3 mr-1" />Přidat sekci</Button>
    </div>
  );
};

export default AccordionBlock;
