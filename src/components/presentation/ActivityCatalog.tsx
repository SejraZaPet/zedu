import * as LucideIcons from "lucide-react";
import { Puzzle } from "lucide-react";
import { ACTIVITY_CATALOG_GROUPS } from "@/lib/activity-catalog";
import type { ActivityPreset } from "@/lib/activity-slide-presets";

export default function ActivityCatalog({ onPick, compact = false }: { onPick: (preset: ActivityPreset) => void; compact?: boolean }) {
  return (
    <div className="space-y-4" aria-label="Všechny typy aktivit">
      {ACTIVITY_CATALOG_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`activity-group-${group.id}`}>
          <h3 id={`activity-group-${group.id}`} className="mb-2 font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">{group.label}</h3>
          <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
            {group.presets.map((preset) => {
              const Icon = (LucideIcons as any)[preset.icon] ?? Puzzle;
              return (
                <button key={preset.id} type="button" onClick={() => onPick(preset)} title={preset.hint} className="flex min-h-[76px] flex-col items-start gap-1 rounded-xl border border-deck-line bg-deck-panel p-2.5 text-left hover:border-deck-violet hover:bg-deck-soft">
                  <Icon className="h-4 w-4 text-deck-violet" />
                  <span className="text-[11px] font-semibold leading-tight text-deck-ink">{preset.label}</span>
                  {!compact && <span className="text-[10px] leading-tight text-deck-muted">{preset.hint}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
