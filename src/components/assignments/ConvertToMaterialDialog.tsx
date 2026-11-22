import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { assignmentKind } from "@/lib/assignment-kind";
import { canRevertToTask, impactText, toMaterialPatch, toTaskPatch } from "@/lib/assignment-kind-convert";

interface Row {
  id: string; title: string; created_at: string; deadline: string | null; class_id: string | null; group_id: string | null;
  worksheet_id: string | null; settings: unknown; [k: string]: unknown;
}
type Mode = "toMaterial" | "toTask";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("cs-CZ") : "—");

/** Hromadný převod vlastních úkolů s pracovním listem na materiál a zpět. Nikdy nemaže pokusy ani neposílá upozornění. */
export function ConvertToMaterialDialog({ open, onOpenChange, initialIds, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; initialIds?: string[]; onDone?: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("toMaterial");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, { sub: number; graded: number }>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialIds ?? [])); setConfirming(false); setAck(false); setMode("toMaterial");
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("assignments").select("*").eq("teacher_id", user.id).eq("status", "published").order("created_at", { ascending: false });
      const list = ((data ?? []) as any[]).filter((a) => a.worksheet_id || canRevertToTask(a.settings)) as Row[];
      const ids = list.map((a) => a.id);
      const { data: att } = ids.length
        ? await supabase.from("assignment_attempts" as any).select("assignment_id, status, score, teacher_feedback_text").in("assignment_id", ids)
        : { data: [] as any[] };
      const c: Record<string, { sub: number; graded: number }> = {};
      for (const a of (att ?? []) as any[]) {
        const e = (c[a.assignment_id] ??= { sub: 0, graded: 0 });
        if (a.status === "submitted" || a.status === "graded") e.sub++;
        if (a.score != null || a.teacher_feedback_text) e.graded++;
      }
      const classIds = [...new Set(list.map((a) => a.class_id).filter(Boolean))] as string[];
      const groupIds = [...new Set(list.map((a) => a.group_id).filter(Boolean))] as string[];
      const [cl, gr] = await Promise.all([
        classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [] as any[] }),
        groupIds.length ? supabase.from("subject_groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const t: Record<string, string> = {};
      for (const x of [...((cl as any).data ?? []), ...((gr as any).data ?? [])]) t[x.id] = x.name;
      if (!cancelled) { setRows(list); setCounts(c); setTargets(t); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, initialIds]);

  const visible = useMemo(() => rows.filter((r) => mode === "toMaterial"
    ? assignmentKind(r.settings) === "task" && !!r.worksheet_id
    : canRevertToTask(r.settings)), [rows, mode]);
  const chosen = visible.filter((r) => selected.has(r.id));
  const totals = chosen.reduce((s, r) => ({ sub: s.sub + (counts[r.id]?.sub ?? 0), graded: s.graded + (counts[r.id]?.graded ?? 0) }), { sub: 0, graded: 0 });
  const needsAck = mode === "toMaterial" && totals.sub > 0;
  const allOn = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const apply = async () => {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    let ok = 0, fail = 0;
    for (const r of chosen) {
      const patch = mode === "toMaterial" ? toMaterialPatch(r as any) : toTaskPatch(r as any);
      const { error } = await supabase.from("assignments").update(patch as any).eq("id", r.id).eq("teacher_id", user?.id ?? "");
      error ? fail++ : ok++;
    }
    setBusy(false);
    toast({
      title: mode === "toMaterial" ? `Změněno na materiál: ${ok}` : `Vráceno na úkol: ${ok}`,
      description: fail ? `${fail} se nepodařilo uložit, zkuste to prosím znovu.` : "Odevzdání a hodnocení zůstala uložená.",
      variant: fail ? "destructive" : undefined,
    });
    onDone?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Úkoly s pracovním listem</DialogTitle>
          <DialogDescription>Změňte úkoly, které mají být jen k dispozici, na materiál. Žáci je pak neodevzdávají; nic se nesmaže a změnu lze vrátit.</DialogDescription>
        </DialogHeader>
        {!confirming ? (
          <>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setSelected(new Set()); }}>
              <TabsList>
                <TabsTrigger value="toMaterial">Úkoly s listem</TabsTrigger>
                <TabsTrigger value="toTask">Převedené na materiál</TabsTrigger>
              </TabsList>
            </Tabs>
            {loading ? <p className="text-sm text-muted-foreground">Načítám…</p> : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">{mode === "toMaterial" ? "Nemáte žádné zveřejněné úkoly s pracovním listem." : "Žádný materiál nebyl převeden z úkolu."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="convert-table">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="p-2"><Checkbox aria-label="Vybrat vše" checked={allOn} onCheckedChange={(c) => setSelected(c ? new Set(visible.map((r) => r.id)) : new Set())} /></th>
                    <th className="p-2">Název</th><th className="p-2">Třída/skupina</th><th className="p-2">Vytvořeno</th><th className="p-2">Termín</th><th className="p-2">Odevzdání</th><th className="p-2">Hodnoceno</th>
                  </tr></thead>
                  <tbody>{visible.map((r) => {
                    const prevDeadline = (r.settings as any)?.previousTask?.row?.deadline ?? null;
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-2"><Checkbox aria-label={`Vybrat ${r.title}`} checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                        <td className="p-2 font-medium">{r.title}</td>
                        <td className="p-2">{targets[(r.class_id ?? r.group_id) as string] ?? "—"}</td>
                        <td className="p-2">{fmt(r.created_at)}</td>
                        <td className="p-2">{fmt(mode === "toMaterial" ? r.deadline : prevDeadline)}</td>
                        <td className="p-2">{counts[r.id]?.sub ?? 0}</td>
                        <td className="p-2">{counts[r.id]?.graded ?? 0}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
              <Button disabled={chosen.length === 0} onClick={() => { setAck(false); setConfirming(true); }}>
                {mode === "toMaterial" ? `Změnit na materiál (${chosen.length})` : `Vrátit na úkol (${chosen.length})`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4" data-testid="convert-confirm">
            {mode === "toMaterial" ? (
              <>
                <p className="text-sm">Změníte {chosen.length} úkolů na materiál. {impactText(totals.sub, totals.graded)}</p>
                <p className="text-sm text-muted-foreground">Termín a nastavení úkolu se uschovají pro vrácení. Žákům se nic neodešle.</p>
                {needsAck && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={ack} onCheckedChange={(c) => setAck(!!c)} aria-label="Rozumím" />
                    <span>Rozumím, že odevzdání zůstanou uložená, ale přestanou se zobrazovat ve výsledcích.</span>
                  </label>
                )}
              </>
            ) : (
              <p className="text-sm">Vrátíte {chosen.length} materiálů na úkol. Obnoví se termín i nastavení; odevzdání a hodnocení se znovu zobrazí. Žákům se e-mail o novém úkolu neodešle.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>Zpět</Button>
              <Button onClick={apply} disabled={busy || (needsAck && !ack)}>{busy ? "Ukládám…" : "Potvrdit"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
