/**
 * Úprava bloku „Příklady z praxe“ v editoru listu (ruční zadávání).
 * Posílá jen patche položky; body položky se odvozují ze součtu bodů příkladů.
 * Místo pro budoucí tlačítko „Navrhnout příklady z praxe“ (AI) je vyhrazené,
 * záměrně se zatím nezobrazuje.
 */
import type { WorksheetItem } from "@/lib/worksheet-spec";
import {
  MAX_PRACTICE_EXAMPLES,
  createPracticeExample,
  normalizePracticeExamples,
  practiceExamplesTotalPoints,
  type PracticeExample,
} from "@/lib/method-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export default function PracticeExamplesFieldsEditor({
  item,
  onUpdateItem,
}: {
  item: WorksheetItem;
  onUpdateItem: (p: Partial<WorksheetItem>) => void;
}) {
  if (item.type !== "practice_examples") return null;
  const examples = normalizePracticeExamples(item.practiceExamples);

  const commit = (next: PracticeExample[]) => {
    onUpdateItem({ practiceExamples: next, points: practiceExamplesTotalPoints(next) });
  };

  const update = (id: string, patch: Partial<PracticeExample>) =>
    commit(examples.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const move = (id: string, dir: -1 | 1) => {
    const i = examples.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= examples.length) return;
    const next = [...examples];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <Label className="text-xs">Příklady (max {MAX_PRACTICE_EXAMPLES})</Label>
      {examples.map((ex, i) => (
        <div key={ex.id} className="space-y-2 rounded-md border border-border bg-background p-2">
          <div className="flex items-center gap-1">
            <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{i + 1}.</span>
            <Input
              value={ex.title}
              onChange={(e) => update(ex.id, { title: e.target.value })}
              placeholder="Nadpis příkladu"
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => move(ex.id, -1)}
              disabled={i === 0}
              aria-label="Posunout příklad nahoru"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => move(ex.id, 1)}
              disabled={i === examples.length - 1}
              aria-label="Posunout příklad dolů"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              onClick={() => commit(examples.filter((e) => e.id !== ex.id))}
              disabled={examples.length <= 1}
              aria-label="Odebrat příklad"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={ex.situation}
            onChange={(e) => update(ex.id, { situation: e.target.value })}
            rows={3}
            placeholder="Popis situace z praxe…"
          />
          <Textarea
            value={ex.question ?? ""}
            onChange={(e) => update(ex.id, { question: e.target.value })}
            rows={2}
            placeholder="Otázka / úkol pro žáka (volitelné)…"
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Body</Label>
            <Input
              type="number"
              min={0}
              className="h-9 w-20"
              value={ex.points}
              onChange={(e) => update(ex.id, { points: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
            {ex.points > 0 ? (
              <span className="text-xs text-muted-foreground">hodnotí učitel ručně</span>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] w-full"
        disabled={examples.length >= MAX_PRACTICE_EXAMPLES}
        onClick={() => commit([...examples, createPracticeExample({ title: `Příklad ${examples.length + 1}` })])}
      >
        <Plus className="mr-1 h-4 w-4" /> Přidat příklad
      </Button>
      {/* Sem později přibude tlačítko „Navrhnout příklady z praxe“ (AI) – etapa 4, zatím skryté. */}
    </div>
  );
}
