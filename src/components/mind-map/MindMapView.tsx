/**
 * MindMapView — sdílené zobrazení myšlenkové mapy (strom).
 * Režim "view": rozbalování větví; režim "fill": žák doplňuje prázdné uzly.
 * Vždy nabízí přepnutí na odrážkový seznam (textová alternativa).
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, List, Network, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  branchColor,
  flattenMindMap,
  type MindMapColor,
  type MindMapData,
  type MindMapNode,
} from "@/lib/mind-map";

const COLOR_CLASSES: Record<MindMapColor, { card: string; dot: string; line: string }> = {
  primary: { card: "border-primary/50 bg-primary/10", dot: "bg-primary", line: "border-primary/40" },
  secondary: { card: "border-secondary/50 bg-secondary/10", dot: "bg-secondary", line: "border-secondary/40" },
  accent: { card: "border-accent/60 bg-accent/15", dot: "bg-accent", line: "border-accent/50" },
  muted: { card: "border-border bg-muted", dot: "bg-muted-foreground", line: "border-border" },
};

export interface MindMapViewProps {
  data: MindMapData;
  mode?: "view" | "fill";
  /** Odpovědi žáka v pořadí prázdných uzlů. */
  answers?: string[];
  onAnswerChange?: (answers: string[]) => void;
  disabled?: boolean;
  /** Výsledek po prázdných uzlech (true/false), jen po odevzdání. */
  results?: boolean[];
  title?: string;
}

export default function MindMapView({
  data,
  mode = "view",
  answers = [],
  onAnswerChange,
  disabled,
  results,
  title,
}: MindMapViewProps) {
  const [asList, setAsList] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const flat = useMemo(() => flattenMindMap(data), [data]);
  const blankIndex = useMemo(
    () => new Map(flat.filter((f) => f.node.blank).map((f) => [f.node.id, f.blankIndex ?? 0])),
    [flat],
  );
  const blankCount = blankIndex.size;

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setAnswer = (i: number, v: string) => {
    const next = Array.from({ length: blankCount }, (_, k) => answers[k] ?? "");
    next[i] = v;
    onAnswerChange?.(next);
  };

  const label = (n: MindMapNode, compact = false) => {
    if (!n.blank) return <span className="break-words">{n.text || "—"}</span>;
    const i = blankIndex.get(n.id) ?? 0;
    const r = results?.[i];
    if (mode !== "fill") {
      return <span className="text-muted-foreground" aria-label={`Prázdné pole ${i + 1}`}>………</span>;
    }
    return (
      <span className="flex w-full items-center gap-1.5">
        <Input
          value={answers[i] ?? ""}
          onChange={(e) => setAnswer(i, e.target.value)}
          disabled={disabled}
          aria-label={`Doplň pojem ${i + 1}`}
          placeholder="Doplň…"
          className={cn(
            "h-11 min-w-0 flex-1 bg-background",
            compact && "h-10",
            r === true && "border-primary ring-1 ring-primary",
            r === false && "border-destructive ring-1 ring-destructive",
          )}
        />
        {r === true && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Správně" />}
        {r === false && <X className="h-4 w-4 shrink-0 text-destructive" aria-label="Špatně" />}
      </span>
    );
  };

  const renderChildren = (n: MindMapNode): JSX.Element | null => {
    if (n.children.length === 0 || collapsed.has(n.id)) return null;
    return (
      <ul className={cn("ml-3 mt-1 space-y-1 border-l-2 pl-3", COLOR_CLASSES[branchColor(data, n.id)].line)}>
        {n.children.map((c) => (
          <li key={c.id}>
            <div className="flex min-h-11 items-center gap-1">
              <ToggleButton node={c} collapsed={collapsed.has(c.id)} onToggle={toggle} />
              <div className="min-w-0 flex-1 text-sm">{label(c, true)}</div>
            </div>
            {renderChildren(c)}
          </li>
        ))}
      </ul>
    );
  };

  const renderOutline = (n: MindMapNode): JSX.Element => (
    <li key={n.id}>
      <div className="py-1">{label(n, true)}</div>
      {n.children.length > 0 && <ul className="ml-5 list-disc space-y-0.5">{n.children.map(renderOutline)}</ul>}
    </li>
  );

  return (
    <figure className="w-full min-w-0 max-w-full space-y-3" aria-label={title || `Myšlenková mapa: ${data.root.text}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <figcaption className="font-semibold">{title}</figcaption> : <span />}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setAsList((v) => !v)}
          aria-pressed={asList}
        >
          {asList ? <Network className="mr-1.5 h-4 w-4" aria-hidden /> : <List className="mr-1.5 h-4 w-4" aria-hidden />}
          {asList ? "Zobrazit jako mapu" : "Zobrazit jako seznam"}
        </Button>
      </div>

      {asList ? (
        <ul className="list-none space-y-1 rounded-lg border border-border bg-card p-3 text-sm">{renderOutline(data.root)}</ul>
      ) : (
        <div className="space-y-3">
          <div className="mx-auto w-fit max-w-full rounded-2xl bg-gradient-to-r from-primary to-secondary px-5 py-3 text-center font-semibold text-primary-foreground shadow-sm">
            {data.root.blank ? label(data.root) : <span className="break-words">{data.root.text || "Hlavní téma"}</span>}
          </div>
          {data.root.children.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.root.children.map((b) => {
                const c = COLOR_CLASSES[branchColor(data, b.id)];
                return (
                  <li key={b.id} className={cn("min-w-0 rounded-xl border-2 p-2", c.card)}>
                    <div className="flex min-h-11 items-center gap-1">
                      <ToggleButton node={b} collapsed={collapsed.has(b.id)} onToggle={toggle} />
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", c.dot)} aria-hidden />
                      <div className="min-w-0 flex-1 font-medium">{label(b)}</div>
                    </div>
                    {renderChildren(b)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </figure>
  );
}

function ToggleButton({
  node,
  collapsed,
  onToggle,
}: {
  node: MindMapNode;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  if (node.children.length === 0) return <span className="inline-block w-2" aria-hidden />;
  return (
    <button
      type="button"
      onClick={() => onToggle(node.id)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Rozbalit větev ${node.text || ""}` : `Sbalit větev ${node.text || ""}`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );
}
