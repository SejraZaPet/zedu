import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Plus, Send, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import PublishWorksheetDialog from "@/components/worksheet/PublishWorksheetDialog";
import {
  addIds, filterWorksheetOptions, moveId, removeId, worksheetState, WORKSHEET_STATE_LABEL,
  type PlanWorksheetOption,
} from "@/lib/plan-worksheets";

interface Props {
  teacherId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  subjectId?: string | null;
  subject?: string | null;
}

/** Sekce „Pracovní listy k hodině“ v editoru plánu. Jen mění seznam ID; ukládá editor plánu. */
export default function PlanWorksheetsSection({ teacherId, value, onChange, subjectId, subject }: Props) {
  const [all, setAll] = useState<PlanWorksheetOption[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onlySubject, setOnlySubject] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [publishing, setPublishing] = useState<PlanWorksheetOption | null>(null);

  const load = async () => {
    if (!teacherId) return;
    const { data } = await supabase
      .from("worksheets")
      .select("id, title, status, scheduled_publish_at, subject, subject_id, created_at")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    setAll(((data as any[]) ?? []) as PlanWorksheetOption[]);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [teacherId]);

  const byId = useMemo(() => new Map(all.map((w) => [w.id, w])), [all]);
  const options = useMemo(
    () => filterWorksheetOptions(all.filter((w) => !value.includes(w.id)), { query, subjectId, subject, onlySubject }),
    [all, value, query, subjectId, subject, onlySubject],
  );

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Pracovní listy k hodině</div>
        <Button type="button" size="sm" variant="outline" onClick={() => { setPicked([]); setQuery(""); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Přidat pracovní list
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">Zatím žádný připnutý list.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((id, i) => {
            const w = byId.get(id);
            const state = w ? worksheetState(w) : null;
            return (
              <li key={id} className="rounded-md border border-border bg-background p-2" data-testid="plan-worksheet">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{w?.title || "Pracovní list"}</span>
                  {state && <Badge variant={state === "published" ? "default" : "secondary"}>{WORKSHEET_STATE_LABEL[state]}</Badge>}
                  <Button type="button" size="icon" variant="ghost" aria-label="Posunout nahoru" disabled={i === 0} onClick={() => onChange(moveId(value, id, -1))}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label="Posunout dolů" disabled={i === value.length - 1} onClick={() => onChange(moveId(value, id, 1))}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange(removeId(value, id))}>
                    <Trash2 className="mr-1 h-4 w-4" /> Odebrat
                  </Button>
                </div>
                {w && state === "draft" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span>Žáci ho neuvidí, dokud ho nepublikuješ</span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setPublishing(w)}>
                      <Send className="mr-1 h-3 w-3" /> Publikovat teď
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Přidat pracovní list</DialogTitle>
            <DialogDescription>Vyberte jeden nebo více svých pracovních listů.</DialogDescription>
          </DialogHeader>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat podle názvu…" aria-label="Hledat pracovní list" />
          {(subjectId || subject) && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlySubject} onCheckedChange={(v) => setOnlySubject(v === true)} />
              Jen předmět plánu{subject ? ` (${subject})` : ""}
            </label>
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {options.length === 0 && <p className="p-2 text-sm text-muted-foreground">Žádný list nenalezen.</p>}
            {options.map((w) => (
              <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                <Checkbox
                  checked={picked.includes(w.id)}
                  onCheckedChange={(v) => setPicked((p) => (v === true ? addIds(p, [w.id]) : removeId(p, w.id)))}
                />
                <span className="flex-1 truncate">{w.title || "Pracovní list"}</span>
                <Badge variant="outline">{WORKSHEET_STATE_LABEL[worksheetState(w)]}</Badge>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button disabled={picked.length === 0} onClick={() => { onChange(addIds(value, picked)); setOpen(false); }}>
              Přidat ({picked.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {publishing && (
        <PublishWorksheetDialog
          open
          onOpenChange={(o) => { if (!o) setPublishing(null); }}
          worksheetId={publishing.id}
          worksheetTitle={publishing.title}
          subjectId={publishing.subject_id}
          onPublished={() => { setPublishing(null); void load(); }}
        />
      )}
    </div>
  );
}
