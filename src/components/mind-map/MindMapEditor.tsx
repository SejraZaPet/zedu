/**
 * MindMapEditor — úprava stromu myšlenkové mapy (učitel).
 * S `withBlanks` lze uzly označit „žák doplní“; správné odpovědi se pak
 * drží mimo mapu (answerMap → klíč odpovědí pracovního listu).
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  addChild,
  canAddChild,
  countNodes,
  flattenMindMap,
  moveNode,
  removeNode,
  updateNode,
  MIND_MAP_COLORS,
  MIND_MAP_MAX_DEPTH,
  MIND_MAP_MAX_NODES,
  type MindMapColor,
  type MindMapData,
} from "@/lib/mind-map";

interface Props {
  data: MindMapData;
  onChange: (data: MindMapData, answerMap: Record<string, string>) => void;
  withBlanks?: boolean;
  answerMap?: Record<string, string>;
}

export default function MindMapEditor({ data, onChange, withBlanks = false, answerMap = {} }: Props) {
  const flat = flattenMindMap(data);
  const total = countNodes(data);
  const emit = (next: MindMapData, map = answerMap) => {
    const ids = new Set(flattenMindMap(next).filter((f) => f.node.blank).map((f) => f.node.id));
    const clean: Record<string, string> = {};
    for (const id of ids) clean[id] = map[id] ?? "";
    onChange(next, clean);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {total} / {MIND_MAP_MAX_NODES} pojmů · nejvýše {MIND_MAP_MAX_DEPTH} úrovně větví
        {withBlanks && " · zaškrtněte „Žák doplní“ a napište správné odpovědi (více možností oddělte středníkem)"}
      </p>
      <ul className="space-y-2">
        {flat.map(({ node, depth, parentId }) => {
          const siblings = parentId ? flat.filter((f) => f.parentId === parentId) : [];
          const idx = siblings.findIndex((f) => f.node.id === node.id);
          return (
            <li
              key={node.id}
              className="space-y-2 rounded-lg border border-border bg-card p-2"
              style={{ marginLeft: `${Math.min(depth, 4) * 12}px` }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {node.blank ? (
                  <Input
                    value={answerMap[node.id] ?? ""}
                    onChange={(e) => emit(data, { ...answerMap, [node.id]: e.target.value })}
                    placeholder="Správná odpověď; další možnost"
                    aria-label={`Správné odpovědi pro uzel úrovně ${depth}`}
                    className="h-11 min-w-0 flex-1 basis-40 border-dashed"
                  />
                ) : (
                  <Input
                    value={node.text}
                    onChange={(e) => emit(updateNode(data, node.id, { text: e.target.value }))}
                    placeholder={depth === 0 ? "Hlavní téma" : "Pojem"}
                    aria-label={depth === 0 ? "Hlavní téma" : `Pojem úrovně ${depth}`}
                    className="h-11 min-w-0 flex-1 basis-40"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => emit(addChild(data, node.id))}
                  disabled={!canAddChild(data, node.id)}
                  aria-label="Přidat podřízený pojem"
                  title="Přidat podřízený pojem"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {depth > 0 && (
                  <>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={idx <= 0}
                      onClick={() => emit(moveNode(data, node.id, -1))} aria-label="Posunout nahoru">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={idx >= siblings.length - 1}
                      onClick={() => emit(moveNode(data, node.id, 1))} aria-label="Posunout dolů">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-destructive hover:text-destructive"
                      onClick={() => emit(removeNode(data, node.id))} aria-label="Smazat pojem i s větví">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {(depth === 1 || (withBlanks && depth > 0)) && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {depth === 1 && (
                    <label className="flex min-h-11 items-center gap-1.5">
                      <span className="text-muted-foreground">Barva větve</span>
                      <select
                        className="h-11 rounded-md border border-input bg-background px-2 text-sm"
                        value={node.color ?? "primary"}
                        onChange={(e) => emit(updateNode(data, node.id, { color: e.target.value as MindMapColor }))}
                      >
                        {MIND_MAP_COLORS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {withBlanks && depth > 0 && (
                    <div className="flex min-h-11 items-center gap-2">
                      <Checkbox
                        id={`mm-blank-${node.id}`}
                        checked={!!node.blank}
                        onCheckedChange={(v) => {
                          const on = v === true;
                          // Text pojmu se při označení přesune do klíče, aby ho žák neviděl.
                          const map = on
                            ? { ...answerMap, [node.id]: answerMap[node.id] || node.text }
                            : answerMap;
                          const restored = on ? "" : (parseFirst(answerMap[node.id]) || node.text);
                          emit(updateNode(data, node.id, { blank: on, text: restored }), map);
                        }}
                        className="h-5 w-5"
                      />
                      <Label htmlFor={`mm-blank-${node.id}`} className="text-xs">Žák doplní</Label>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parseFirst(s?: string): string {
  return String(s ?? "").split(";")[0]?.trim() ?? "";
}
