/**
 * Úprava bloku „Postup podle metody“ v editoru listu.
 * Posílá jen patche položky (nikdy nic neukládá); body položky se odvozují
 * ze součtu bodů fází (0 = nehodnocená část, nepočítá se do maxima).
 */
import type { WorksheetItem } from "@/lib/worksheet-spec";
import {
  MAX_METHOD_PHASES,
  createMethodPhase,
  methodStepsTotalPoints,
  normalizeMethodPhases,
  type MethodStepPhase,
} from "@/lib/method-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export default function MethodStepsFieldsEditor({
  item,
  onUpdateItem,
}: {
  item: WorksheetItem;
  onUpdateItem: (p: Partial<WorksheetItem>) => void;
}) {
  if (item.type !== "method_steps") return null;
  const phases = normalizeMethodPhases(item.methodPhases);

  const commit = (next: MethodStepPhase[]) => {
    onUpdateItem({ methodPhases: next, points: methodStepsTotalPoints(next) });
  };

  const update = (id: string, patch: Partial<MethodStepPhase>) =>
    commit(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const move = (id: string, dir: -1 | 1) => {
    const i = phases.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <div>
        <Label className="text-xs">Název metody (zobrazí se žákovi, volitelné)</Label>
        <Input
          value={item.methodName ?? ""}
          onChange={(e) => onUpdateItem({ methodName: e.target.value })}
          placeholder="Např. Školní pokus"
        />
      </div>
      <div>
        <Label className="text-xs">Úvodní instrukce pro žáka (volitelné)</Label>
        <Textarea
          value={item.methodIntro ?? ""}
          onChange={(e) => onUpdateItem({ methodIntro: e.target.value })}
          rows={2}
          placeholder="Co mají žáci s postupem dělat…"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Fáze (max {MAX_METHOD_PHASES})</Label>
        {phases.map((phase, i) => (
          <div key={phase.id} className="space-y-2 rounded-md border border-border bg-background p-2">
            <div className="flex items-center gap-1">
              <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{i + 1}.</span>
              <Input
                value={phase.title}
                onChange={(e) => update(phase.id, { title: e.target.value })}
                placeholder="Název fáze"
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => move(phase.id, -1)}
                disabled={i === 0}
                aria-label="Posunout fázi nahoru"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => move(phase.id, 1)}
                disabled={i === phases.length - 1}
                aria-label="Posunout fázi dolů"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => commit(phases.filter((p) => p.id !== phase.id))}
                disabled={phases.length <= 1}
                aria-label="Odebrat fázi"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={phase.task}
              onChange={(e) => update(phase.id, { task: e.target.value })}
              rows={2}
              placeholder="Zadání / úkol pro žáka v této fázi…"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={phase.answerMode}
                onValueChange={(v) => update(phase.id, { answerMode: v as MethodStepPhase["answerMode"] })}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez odpovědi</SelectItem>
                  <SelectItem value="lines">Řádky pro zápis</SelectItem>
                  <SelectItem value="field">Textové pole</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Label className="text-xs">Body</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 w-20"
                  value={phase.points}
                  onChange={(e) => update(phase.id, { points: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                />
              </div>
              {phase.points > 0 ? (
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
          disabled={phases.length >= MAX_METHOD_PHASES}
          onClick={() => commit([...phases, createMethodPhase({ title: `Fáze ${phases.length + 1}` })])}
        >
          <Plus className="mr-1 h-4 w-4" /> Přidat fázi
        </Button>
      </div>
    </div>
  );
}
