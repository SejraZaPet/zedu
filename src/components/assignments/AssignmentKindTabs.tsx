import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, BookOpen, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  filterByKind, sectionFromParam, SECTION_KIND, KIND_SECTION,
  type AssignmentKind, type KindSection,
} from "@/lib/assignment-kind";

const META: Record<AssignmentKind, { label: string; add: string; icon: typeof ClipboardList }> = {
  task: { label: "Úkoly", add: "Přidat úkol", icon: ClipboardList },
  material: { label: "Materiály", add: "Přidat materiál", icon: BookOpen },
  announcement: { label: "Oznámení", add: "Přidat oznámení", icon: Megaphone },
};
const ORDER: AssignmentKind[] = ["task", "material", "announcement"];

interface Props<T> {
  items: T[];
  storageKey: string;
  teacher?: boolean;
  /** Odznak k druhu (např. počet „Ke kontrole“); 0/undefined = bez odznaku. */
  badge?: (kind: AssignmentKind, items: T[]) => number;
  badgeLabel?: string;
  onAdd?: (kind: AssignmentKind) => void;
  empty: Record<AssignmentKind, string>;
  render: (kind: AssignmentKind, items: T[]) => ReactNode;
}

/** Pod-záložky Úkoly | Materiály | Oznámení; sekce v `?sekce=` + localStorage. */
export default function AssignmentKindTabs<T extends { settings?: unknown }>({ items, storageKey, teacher, badge, badgeLabel = "nové", onAdd, empty, render }: Props<T>) {
  const [params, setParams] = useSearchParams();
  const [section, setSection] = useState<KindSection>(() => {
    const fromUrl = sectionFromParam(params.get("sekce"));
    if (fromUrl) return fromUrl;
    try { return sectionFromParam(localStorage.getItem(storageKey)) ?? "ukoly"; } catch { return "ukoly"; }
  });
  useEffect(() => {
    const fromUrl = sectionFromParam(params.get("sekce"));
    if (fromUrl && fromUrl !== section) setSection(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const pick = (s: KindSection) => {
    setSection(s);
    try { localStorage.setItem(storageKey, s); } catch { /* ignore */ }
    const next = new URLSearchParams(params);
    next.set("sekce", s);
    setParams(next, { replace: true });
  };

  const kind = SECTION_KIND[section];
  const list = filterByKind(items, kind, { teacher });
  const m = META[kind];

  return (
    <div className="min-w-0 space-y-3">
      <div role="tablist" aria-label="Druh položek" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {ORDER.map((k) => {
          const Icon = META[k].icon;
          const count = filterByKind(items, k, { teacher }).length;
          const b = badge ? badge(k, filterByKind(items, k, { teacher })) : 0;
          const active = k === kind;
          return (
            <button key={k} type="button" role="tab" aria-selected={active} data-testid={`kind-tab-${k}`}
              onClick={() => pick(KIND_SECTION[k])}
              className={cn("relative flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{META[k].label}</span>
              <span className="tabular-nums text-xs opacity-80">({count})</span>
              {b > 0 && <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground" aria-label={`${b} ${badgeLabel}`}>{b}</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="min-w-0">
        {onAdd && (
          <div className="mb-3 flex justify-end">
            <Button size="sm" className="min-h-11" onClick={() => onAdd(kind)}><Plus className="mr-1 h-4 w-4" aria-hidden />{m.add}</Button>
          </div>
        )}
        {list.length === 0
          ? <Card className="p-6 text-center text-sm text-muted-foreground" data-testid="kind-empty">{empty[kind]}</Card>
          : render(kind, list)}
      </div>
    </div>
  );
}
