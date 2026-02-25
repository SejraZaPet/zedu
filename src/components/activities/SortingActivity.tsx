import { useState, useMemo } from "react";

interface SortingData { groups: string[]; items: { text: string; group: number }[]; }

const SortingActivity = ({ sorting }: { sorting: SortingData }) => {
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  // Shuffle items once
  const shuffled = useMemo(() => {
    const indices = sorting.items.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting.items.map((it) => it.text).join(",")]);

  if (!sorting?.groups?.length) return null;

  const unassigned = shuffled.filter((i) => assignments[i] === undefined);
  const allAssigned = Object.keys(assignments).length === sorting.items.length;
  const allCorrect = checked && sorting.items.every((it, i) => assignments[i] === it.group);

  return (
    <div className="space-y-4">
      {/* Unassigned items */}
      {unassigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unassigned.map((idx) => (
            <span key={idx} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground cursor-default">
              {sorting.items[idx].text}
            </span>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className={`grid gap-4 ${sorting.groups.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {sorting.groups.map((group, gi) => {
          const itemsInGroup = shuffled.filter((i) => assignments[i] === gi);
          return (
            <div key={gi} className="rounded-lg border border-border bg-card/50 p-3 min-h-[100px]">
              <h4 className="font-heading text-sm font-semibold text-primary mb-2 uppercase tracking-wide">{group}</h4>
              <div className="space-y-1">
                {itemsInGroup.map((idx) => {
                  const correct = checked && sorting.items[idx].group === gi;
                  const wrong = checked && sorting.items[idx].group !== gi;
                  return (
                    <div
                      key={idx}
                      className={`rounded border px-2 py-1 text-sm flex items-center justify-between ${
                        correct ? "border-green-500/60 bg-green-500/10 text-foreground"
                          : wrong ? "border-destructive/60 bg-destructive/10 text-foreground"
                          : "border-border bg-card text-foreground"
                      }`}
                    >
                      <span>{sorting.items[idx].text}</span>
                      {!checked && (
                        <button className="text-xs text-muted-foreground hover:text-destructive ml-2" onClick={() => setAssignments((a) => { const n = { ...a }; delete n[idx]; return n; })}>
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Drop zone: click unassigned item, then click group */}
              {unassigned.length > 0 && !checked && (
                <button
                  onClick={() => {
                    if (unassigned.length > 0) {
                      setAssignments((a) => ({ ...a, [unassigned[0]]: gi }));
                    }
                  }}
                  className="mt-2 w-full rounded border border-dashed border-muted-foreground/30 py-2 text-xs text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  + Přidat sem položku
                </button>
              )}
            </div>
          );
        })}
      </div>

      {allAssigned && !checked && (
        <button onClick={() => setChecked(true)} className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Ověřit
        </button>
      )}
      {checked && (
        <div className={`rounded-lg p-3 text-sm ${allCorrect ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
          {allCorrect ? "✓ Vše správně zatříděno!" : "✗ Některé položky jsou ve špatné skupině."}
          {!allCorrect && (
            <button className="ml-3 underline text-xs" onClick={() => { setChecked(false); setAssignments({}); }}>
              Zkusit znovu
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SortingActivity;
