import { ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Jeden cíl nového úkolu: `class:<id>` nebo `group:<id>` s vlastními termíny (prázdné = společné z formuláře). */
export interface AssignmentTarget {
  key: string;
  publishAt: string;
  deadlineAt: string;
}

interface Option {
  key: string;
  label: string;
}

interface Props {
  targets: AssignmentTarget[];
  onChange: (targets: AssignmentTarget[]) => void;
  sections: { title: string; options: Option[] }[];
  onSelectKey?: (key: string) => void;
}

export default function AssignmentTargetsPicker({ targets, onChange, sections, onSelectKey }: Props) {
  const labels = new Map(sections.flatMap((s) => s.options.map((o) => [o.key, o.label] as const)));
  const selected = new Set(targets.map((t) => t.key));

  const toggle = (key: string) => {
    if (selected.has(key)) onChange(targets.filter((t) => t.key !== key));
    else {
      onChange([...targets, { key, publishAt: "", deadlineAt: "" }]);
      onSelectKey?.(key);
    }
  };
  const update = (key: string, patch: Partial<AssignmentTarget>) =>
    onChange(targets.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2">
      <Label>Třídy a skupiny</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="mt-1 w-full justify-between font-normal">
            <span className="truncate">
              {targets.length === 0 ? "Vyberte třídy nebo skupiny…" : `Vybráno: ${targets.length}`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-h-80 overflow-y-auto p-2">
          {sections.filter((s) => s.options.length > 0).map((s) => (
            <div key={s.title} className="mb-2">
              <div className="px-2 py-1 text-xs text-muted-foreground">{s.title}</div>
              {s.options.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                  <Checkbox checked={selected.has(o.key)} onCheckedChange={() => toggle(o.key)} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          ))}
        </PopoverContent>
      </Popover>

      {targets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Pro každý cíl se vytvoří samostatný úkol. Prázdné termíny převezmou společné nastavení formuláře.
          </p>
          {targets.map((t) => (
            <div key={t.key} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <div className="text-sm font-medium truncate">{labels.get(t.key) ?? "Cíl"}</div>
              <div>
                <Label className="text-xs text-muted-foreground">Zveřejnit</Label>
                <Input type="datetime-local" className="h-8 text-xs" value={t.publishAt}
                  onChange={(e) => update(t.key, { publishAt: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Termín odevzdání</Label>
                <Input type="datetime-local" className="h-8 text-xs" value={t.deadlineAt}
                  onChange={(e) => update(t.key, { deadlineAt: e.target.value })} />
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Odebrat cíl"
                onClick={() => toggle(t.key)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
