import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X, GripVertical } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface CardData {
  title: string;
  text: string;
  mode?: "text" | "bullets";
  items?: string[];
}

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const CardGridBlock = ({ block, onChange }: Props) => {
  const cards: CardData[] = block.props.cards || [];

  const updateCard = (i: number, field: string, val: any) => {
    const next = [...cards];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...block.props, cards: next });
  };

  const toggleMode = (i: number) => {
    const card = cards[i];
    const newMode = card.mode === "bullets" ? "text" : "bullets";
    const next = [...cards];
    next[i] = {
      ...card,
      mode: newMode,
      items: newMode === "bullets" && (!card.items || card.items.length === 0) ? [""] : card.items,
    };
    onChange({ ...block.props, cards: next });
  };

  const updateItem = (ci: number, ii: number, val: string) => {
    const next = [...cards];
    const items = [...(next[ci].items || [])];
    items[ii] = val;
    next[ci] = { ...next[ci], items };
    onChange({ ...block.props, cards: next });
  };

  const addItem = (ci: number) => {
    const next = [...cards];
    next[ci] = { ...next[ci], items: [...(next[ci].items || []), ""] };
    onChange({ ...block.props, cards: next });
  };

  const removeItem = (ci: number, ii: number) => {
    const next = [...cards];
    const items = (next[ci].items || []).filter((_, idx) => idx !== ii);
    if (items.length === 0) items.push("");
    next[ci] = { ...next[ci], items };
    onChange({ ...block.props, cards: next });
  };

  const addCard = () => onChange({ ...block.props, cards: [...cards, { title: "", text: "", mode: "text" }] });

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
          <div key={i} className="border border-border rounded p-2 space-y-2 relative">
            <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeCard(i)}>
              <X className="w-3 h-3" />
            </Button>
            <Input value={card.title} onChange={(e) => updateCard(i, "title", e.target.value)} placeholder="Název karty" className="text-sm" />

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Odrážky</Label>
              <Switch checked={card.mode === "bullets"} onCheckedChange={() => toggleMode(i)} />
            </div>

            {card.mode === "bullets" ? (
              <div className="space-y-1">
                {(card.items || [""]).map((item, ii) => (
                  <div key={ii} className="flex gap-1 items-center">
                    <span className="text-muted-foreground text-xs w-4">•</span>
                    <Input
                      value={item}
                      onChange={(e) => updateItem(i, ii, e.target.value)}
                      placeholder="Položka…"
                      className="flex-1 text-sm h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addItem(i);
                        }
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(i, ii)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addItem(i)}>
                  <Plus className="w-3 h-3 mr-1" />Přidat bod
                </Button>
              </div>
            ) : (
              <Textarea value={card.text} onChange={(e) => updateCard(i, "text", e.target.value)} placeholder="Text karty" rows={2} className="text-sm" />
            )}
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={addCard}><Plus className="w-3 h-3 mr-1" />Přidat kartu</Button>
    </div>
  );
};

export default CardGridBlock;
