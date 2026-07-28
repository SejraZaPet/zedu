import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";

interface Props {
  portfolioItemId: string;
  /** Refetch trigger after save */
  onSaved?: () => void;
}

interface Rubric { id: string; title: string }
interface Criterion { id: string; title: string; sort_order: number }
interface Level { id: string; criterion_id: string; label: string; points: number; sort_order: number }

export default function RubricEvaluator({ portfolioItemId, onSaved }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<string>("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("grading_rubrics")
        .select("id, title")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      setRubrics((data as Rubric[]) || []);
    })();
  }, [open, user]);

  useEffect(() => {
    if (!rubricId) { setCriteria([]); setLevels([]); setChoice({}); return; }
    setLoadingDetail(true);
    (async () => {
      const { data: c } = await supabase
        .from("rubric_criteria")
        .select("id, title, sort_order")
        .eq("rubric_id", rubricId)
        .order("sort_order", { ascending: true });
      const crits = (c as Criterion[]) || [];
      setCriteria(crits);
      if (crits.length > 0) {
        const { data: l } = await supabase
          .from("rubric_levels")
          .select("id, criterion_id, label, points, sort_order")
          .in("criterion_id", crits.map((x) => x.id))
          .order("sort_order", { ascending: true });
        setLevels((l as Level[]) || []);
      } else {
        setLevels([]);
      }
      setChoice({});
      setLoadingDetail(false);
    })();
  }, [rubricId]);

  const levelsByCriterion = useMemo(() => {
    const m: Record<string, Level[]> = {};
    levels.forEach((l) => { (m[l.criterion_id] ||= []).push(l); });
    return m;
  }, [levels]);

  const total = useMemo(() => {
    return criteria.reduce((sum, c) => {
      const lid = choice[c.id];
      if (!lid) return sum;
      const lv = levels.find((x) => x.id === lid);
      return sum + (lv ? Number(lv.points) : 0);
    }, 0);
  }, [choice, criteria, levels]);

  const allChosen = criteria.length > 0 && criteria.every((c) => choice[c.id]);

  const submit = async () => {
    if (!user || !rubricId || !allChosen) return;
    setSaving(true);
    const { data: evalRow, error: evalErr } = await supabase
      .from("rubric_evaluations")
      .insert({
        portfolio_item_id: portfolioItemId,
        rubric_id: rubricId,
        teacher_id: user.id,
        total_points: total,
      })
      .select()
      .single();
    if (evalErr || !evalRow) {
      setSaving(false);
      toast.error(evalErr?.message || "Nepodařilo se uložit hodnocení");
      return;
    }
    const scoreRows = criteria.map((c) => ({
      evaluation_id: (evalRow as { id: string }).id,
      criterion_id: c.id,
      level_id: choice[c.id],
    }));
    const { error: scErr } = await supabase.from("rubric_evaluation_scores").insert(scoreRows);
    setSaving(false);
    if (scErr) {
      toast.error(scErr.message);
      // rollback attempt
      await supabase.from("rubric_evaluations").delete().eq("id", (evalRow as { id: string }).id);
      return;
    }
    toast.success("Rubrika uložena");
    setOpen(false);
    setRubricId("");
    onSaved?.();
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Ohodnotit rubrikou
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/40">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-primary" /> Hodnocení rubrikou
          </Label>
          <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setRubricId(""); }}>Zavřít</Button>
        </div>
        {rubrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím nemáte žádnou rubriku.{" "}
            <a href="/ucitel/rubriky" className="underline text-primary hover:opacity-80">
              Vytvořit rubriku
            </a>
          </p>
        ) : (
          <>
            <Select value={rubricId} onValueChange={setRubricId}>
              <SelectTrigger><SelectValue placeholder="Vyberte rubriku…" /></SelectTrigger>
              <SelectContent>
                {rubrics.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
              </SelectContent>
            </Select>

            {loadingDetail && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Načítání…
              </p>
            )}

            {rubricId && !loadingDetail && criteria.length === 0 && (
              <p className="text-sm text-muted-foreground">Rubrika nemá žádná kritéria.</p>
            )}

            {criteria.map((c) => {
              const options = levelsByCriterion[c.id] || [];
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="text-sm font-medium">{c.title}</div>
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Kritérium nemá úrovně.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {options.map((l) => {
                        const selected = choice[c.id] === l.id;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setChoice((p) => ({ ...p, [c.id]: l.id }))}
                            className={`text-xs rounded-md border px-2 py-1 transition-colors ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            {l.label} <span className="opacity-70">({Number(l.points)} b)</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {criteria.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-sm">
                  Součet: <span className="font-semibold">{total}</span> b
                </div>
                <Button size="sm" onClick={submit} disabled={!allChosen || saving}>
                  {saving ? "Ukládám…" : "Uložit hodnocení"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Display for existing evaluations on a portfolio item (visible to student/parent/teacher)
// -----------------------------------------------------------------------------

interface EvaluationView {
  id: string;
  total_points: number;
  created_at: string;
  rubric: { id: string; title: string } | null;
  rows: {
    criterion: { id: string; title: string; sort_order: number } | null;
    level: { id: string; label: string; points: number } | null;
  }[];
}

export function RubricEvaluationList({
  portfolioItemId,
  refreshKey,
}: {
  portfolioItemId: string;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<EvaluationView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: evals } = await supabase
        .from("rubric_evaluations")
        .select("id, total_points, created_at, rubric:grading_rubrics(id, title)")
        .eq("portfolio_item_id", portfolioItemId)
        .order("created_at", { ascending: false });
      const list = (evals as unknown as Array<{
        id: string; total_points: number; created_at: string;
        rubric: { id: string; title: string } | null;
      }>) || [];
      if (list.length === 0) {
        if (!cancelled) { setItems([]); setLoading(false); }
        return;
      }
      const { data: scores } = await supabase
        .from("rubric_evaluation_scores")
        .select("evaluation_id, criterion:rubric_criteria(id, title, sort_order), level:rubric_levels(id, label, points)")
        .in("evaluation_id", list.map((e) => e.id));
      const byEval: Record<string, EvaluationView["rows"]> = {};
      ((scores as unknown as Array<{
        evaluation_id: string;
        criterion: { id: string; title: string; sort_order: number } | null;
        level: { id: string; label: string; points: number } | null;
      }>) || []).forEach((s) => {
        (byEval[s.evaluation_id] ||= []).push({ criterion: s.criterion, level: s.level });
      });
      const merged: EvaluationView[] = list.map((e) => ({
        ...e,
        rows: (byEval[e.id] || []).sort(
          (a, b) => (a.criterion?.sort_order ?? 0) - (b.criterion?.sort_order ?? 0),
        ),
      }));
      if (!cancelled) { setItems(merged); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [portfolioItemId, refreshKey]);

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((ev) => (
        <div key={ev.id} className="rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-medium">
                {ev.rubric?.title || "Rubrika"}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              Celkem: {Number(ev.total_points)} b
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal py-1 pr-2">Kritérium</th>
                  <th className="text-left font-normal py-1 pr-2">Úroveň</th>
                  <th className="text-right font-normal py-1">Body</th>
                </tr>
              </thead>
              <tbody>
                {ev.rows.map((r, idx) => (
                  <tr key={idx} className="border-t border-border/60">
                    <td className="py-1 pr-2">{r.criterion?.title || "—"}</td>
                    <td className="py-1 pr-2">{r.level?.label || "—"}</td>
                    <td className="py-1 text-right">{r.level ? Number(r.level.points) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
