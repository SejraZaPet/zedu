/**
 * Dialog „Přidat část → Postup podle metody“.
 * Učitel vybere metodu z katalogu (fáze se předvyplní z kroků metody), nebo
 * jedním klikem převezme fáze z posledního „Návrhu podle metody“.
 * Bez AI; obsah lze po vložení v editoru upravit, smazat i přeřadit.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_METHOD_PHASES,
  phasesFromMethodCatalog,
  phasesFromSuggestion,
  readLastMethodSuggestion,
  type LearningMethodCatalogEntry,
  type MethodStepPhase,
  type MethodSuggestionLike,
} from "@/lib/method-steps";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";

export interface MethodStepsPick {
  methodId?: string;
  methodName: string;
  phases: MethodStepPhase[];
}

export default function MethodStepsPickerDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (pick: MethodStepsPick) => void;
}) {
  const [methods, setMethods] = useState<LearningMethodCatalogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [suggestion, setSuggestion] = useState<MethodSuggestionLike | null>(null);

  useEffect(() => {
    if (!open) return;
    setSuggestion(readLastMethodSuggestion());
    (async () => {
      const { data } = await supabase
        .from("learning_methods")
        .select("id, name, description, steps_json, template_phases_json")
        .order("name");
      setMethods((data as any) ?? []);
    })();
  }, [open]);

  const selected = useMemo(() => methods.find((m) => m.id === selectedId) ?? null, [methods, selectedId]);
  const catalogPhases = useMemo(() => phasesFromMethodCatalog(selected), [selected]);
  const suggestionPhases = useMemo(() => phasesFromSuggestion(suggestion), [suggestion]);
  const previewPhases = catalogPhases.length ? catalogPhases : suggestionPhases;

  const insertCatalog = () => {
    if (!selected) return;
    onInsert({
      methodId: selected.id,
      methodName: selected.name,
      phases: catalogPhases.length
        ? catalogPhases
        : [{ id: `phase_${Date.now().toString(36)}`, title: "Fáze 1", task: "", answerMode: "lines", points: 0 }],
    });
    onOpenChange(false);
  };

  const insertSuggestion = () => {
    if (!suggestionPhases.length) return;
    onInsert({ methodName: suggestion?.title?.trim() || "Návrh podle metody", phases: suggestionPhases });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Postup podle metody</DialogTitle>
          <DialogDescription>
            Vyberte metodu z katalogu, nebo vložte fáze z posledního Návrhu podle metody. Obsah po vložení upravíte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Metoda z katalogu</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Vyberte metodu…" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              {catalogPhases.length ? (
                <ol className="list-decimal space-y-1 pl-5">
                  {catalogPhases.map((p) => (
                    <li key={p.id}>
                      <span className="font-medium">{p.title}</span>
                      {p.task ? <span className="text-muted-foreground"> – {p.task}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">Metoda nemá v katalogu kroky – vloží se jedna prázdná fáze.</p>
              )}
            </div>
          ) : null}

          {suggestionPhases.length ? (
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="mb-2 flex items-center gap-1 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-accent" /> Poslední Návrh podle metody
                {suggestion?.title ? `: ${suggestion.title}` : ""}
              </p>
              <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
                {suggestionPhases.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ol>
              <Button type="button" variant="secondary" className="min-h-[44px] w-full" onClick={insertSuggestion}>
                Vložit fáze z návrhu ({suggestionPhases.length})
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={!selected}
            onClick={insertCatalog}
          >
            Vložit postup{selected && catalogPhases.length ? ` (${Math.min(catalogPhases.length, MAX_METHOD_PHASES)} fází)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
