import type { WorksheetItem } from "@/lib/worksheet-spec";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

interface Props {
  item: WorksheetItem;
  onUpdate: (patch: Partial<WorksheetItem>) => void;
  onPickFromLesson?: () => void;
  hasLesson?: boolean;
}

/** Inline editor pro nové aktivitní bloky a lesson_reference. */
export default function ActivityBlockEditor({ item, onUpdate, onPickFromLesson, hasLesson }: Props) {
  switch (item.type) {
    case "lesson_reference":
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
          <Label className="text-xs">Obsah lekce vložený jako kontext</Label>
          <Textarea
            value={item.lessonRefContent ?? ""}
            onChange={(e) => onUpdate({ lessonRefContent: e.target.value })}
            rows={5}
            placeholder="Text vybraný z lekce…"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!hasLesson}
            onClick={() => onPickFromLesson?.()}
          >
            Vybrat z lekce
          </Button>
          {!hasLesson && (
            <p className="text-[11px] text-muted-foreground">Nejdřív přiřaďte lekci v hlavičce editoru.</p>
          )}
        </div>
      );

    case "crossword": {
      const entries = item.crosswordEntries ?? [];
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Sloupců</Label>
              <Input
                type="number" min={5} max={20}
                value={item.crosswordCols ?? 12}
                onChange={(e) => onUpdate({ crosswordCols: Math.max(5, Math.min(20, parseInt(e.target.value) || 12)) })}
              />
            </div>
            <div>
              <Label className="text-xs">Řádků</Label>
              <Input
                type="number" min={5} max={20}
                value={item.crosswordRows ?? 10}
                onChange={(e) => onUpdate({ crosswordRows: Math.max(5, Math.min(20, parseInt(e.target.value) || 10)) })}
              />
            </div>
          </div>
          <Label className="text-xs">Slova (slovo|nápověda|across/down|řádek|sloupec)</Label>
          <Textarea
            value={entries.map((e) => `${e.answer}|${e.clue}|${e.direction}|${e.row}|${e.col}`).join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              const parsed = lines.map((l, i) => {
                const [answer = "", clue = "", direction = "across", row = "0", col = "0"] = l.split("|").map((s) => s.trim());
                return {
                  answer: answer.toUpperCase(),
                  clue,
                  direction: (direction === "down" ? "down" : "across") as "across" | "down",
                  row: parseInt(row) || 0,
                  col: parseInt(col) || 0,
                  number: i + 1,
                };
              });
              onUpdate({ crosswordEntries: parsed });
            }}
            rows={6}
            placeholder={"PRAHA|Hlavní město ČR|across|0|0\nBRNO|Moravská metropole|down|0|0"}
            className="font-mono text-xs"
          />
        </div>
      );
    }

    case "word_search":
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div>
            <Label className="text-xs">Velikost mřížky (čtverec)</Label>
            <Input
              type="number" min={8} max={20}
              value={item.wordSearchSize ?? 12}
              onChange={(e) => onUpdate({ wordSearchSize: Math.max(8, Math.min(20, parseInt(e.target.value) || 12)) })}
            />
          </div>
          <Label className="text-xs">Slova (každé na samostatném řádku)</Label>
          <Textarea
            value={(item.wordSearchWords ?? []).join("\n")}
            onChange={(e) =>
              onUpdate({
                wordSearchWords: e.target.value.split("\n").map((s) => s.trim().toUpperCase()).filter(Boolean),
              })
            }
            rows={5}
            placeholder={"PRAHA\nBRNO\nOSTRAVA"}
          />
        </div>
      );

    case "sorting": {
      const cats = item.sortingCategories ?? [];
      const items = item.sortingItems ?? [];
      return (
        <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div>
            <Label className="text-xs">Kategorie</Label>
            <div className="space-y-1.5">
              {cats.map((c, i) => (
                <div key={c.id} className="flex gap-2">
                  <Input
                    value={c.label}
                    onChange={(e) => {
                      const next = [...cats];
                      next[i] = { ...c, label: e.target.value };
                      onUpdate({ sortingCategories: next });
                    }}
                  />
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => {
                      onUpdate({
                        sortingCategories: cats.filter((_, j) => j !== i),
                        sortingItems: items.filter((it) => it.categoryId !== c.id),
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => onUpdate({
                  sortingCategories: [...cats, { id: `c${Date.now().toString(36)}`, label: `Kategorie ${cats.length + 1}` }],
                })}
              >
                <Plus className="w-3 h-3 mr-1" /> Přidat kategorii
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Položky (text|categoryId)</Label>
            <Textarea
              value={items.map((it) => `${it.text}|${it.categoryId}`).join("\n")}
              onChange={(e) => {
                const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
                const parsed = lines.map((l) => {
                  const [text = "", categoryId = cats[0]?.id ?? "a"] = l.split("|").map((s) => s.trim());
                  return { text, categoryId };
                });
                onUpdate({ sortingItems: parsed });
              }}
              rows={5}
              className="font-mono text-xs"
              placeholder={"Pražec|a\nKolejnice|b"}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Dostupné id: {cats.map((c) => c.id).join(", ") || "—"}
            </p>
          </div>
        </div>
      );
    }

    case "flashcards": {
      const cards = item.flashcards ?? [];
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <Label className="text-xs">Kartičky (front|back, každá na řádku)</Label>
          <Textarea
            value={cards.map((c) => `${c.front}|${c.back}`).join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              const parsed = lines.map((l) => {
                const [front = "", back = ""] = l.split("|").map((s) => s.trim());
                return { front, back };
              });
              onUpdate({ flashcards: parsed });
            }}
            rows={6}
            className="font-mono text-xs"
            placeholder={"Pojem|Vysvětlení"}
          />
        </div>
      );
    }

    case "image_label":
    case "image_hotspot": {
      const isLabel = item.type === "image_label";
      const rows = isLabel ? (item.imageLabels ?? []) : (item.imageHotspots ?? []);
      return (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <Label className="text-xs">URL obrázku</Label>
          <Input
            value={item.imageUrl ?? ""}
            onChange={(e) => onUpdate({ imageUrl: e.target.value || undefined })}
            placeholder="https://…"
          />
          <Label className="text-xs">
            {isLabel
              ? "Popisky (číslo|x%|y%|správná odpověď)"
              : "Body (číslo|x%|y%|otázka)"}
          </Label>
          <Textarea
            value={rows
              .map((r: any) =>
                `${r.number}|${r.xPercent}|${r.yPercent}|${isLabel ? r.answer : r.question}`,
              )
              .join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              const parsed = lines.map((l) => {
                const [n = "1", x = "50", y = "50", text = ""] = l.split("|").map((s) => s.trim());
                const num = parseInt(n) || 1;
                const xPercent = Math.max(0, Math.min(100, parseFloat(x) || 0));
                const yPercent = Math.max(0, Math.min(100, parseFloat(y) || 0));
                return isLabel
                  ? { number: num, xPercent, yPercent, answer: text }
                  : { number: num, xPercent, yPercent, question: text };
              });
              if (isLabel) onUpdate({ imageLabels: parsed as any });
              else onUpdate({ imageHotspots: parsed as any });
            }}
            rows={5}
            className="font-mono text-xs"
            placeholder={isLabel ? "1|25|30|Hlava\n2|70|30|Křídlo" : "1|30|30|Co je v bodě 1?"}
          />
        </div>
      );
    }

    default:
      return null;
  }
}
