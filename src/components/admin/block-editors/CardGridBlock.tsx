import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const CardGridBlock = ({ block, onChange }: Props) => {
  const cards: { title: string; text: string }[] = block.props.cards || [];

  const updateCard = (i: number, field: string, val: string) => {
    const next = [...cards];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...block.props, cards: next });
  };

  const addCard = () => onChange({ ...block.props, cards: [...cards, { title: "", text: "" }] });

  const removeCard = (i: number) => {
    if (cards.length <= 1) return;
    onChange({ ...block.props, cards: cards.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <div className="w-32">
        <Label className="text-xs">Sloupce</Label>
        <Select value={String(block.props.columns)} onValueChange={(v) => onChange({ ...block.props, columns: Number(v) })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 sloupce</SelectItem>
            <SelectItem value="3">3 sloupce</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card, i) => (
          <div key={i} className="border border-border rounded p-2 space-y-1 relative">
            <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeCard(i)}><X className="w-3 h-3" /></Button>
            <Input value={card.title} onChange={(e) => updateCard(i, "title", e.target.value)} placeholder="Název karty" className="text-sm" />
            <Textarea value={card.text} onChange={(e) => updateCard(i, "text", e.target.value)} placeholder="Text karty" rows={2} className="text-sm" />
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={addCard}><Plus className="w-3 h-3 mr-1" />Přidat kartu</Button>
    </div>
  );
};

export default CardGridBlock;
