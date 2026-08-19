import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookMarked, Link2, X } from "lucide-react";

interface PlanRow {
  id: string;
  title: string;
  subject: string;
  subject_id: string | null;
  class_id: string | null;
  group_id: string | null;
}

interface Props {
  subjectId: string | null;
  classId?: string | null;
  groupId?: string | null;
}

/**
 * Výběr ŠVP, které platí pro konkrétní Výuku (předmět + třída/skupina).
 * ŠVP bez vazby na třídu/skupinu se nabízí k přiřazení, přiřazené lze odebrat.
 */
const UnitCurriculumPlansCard = ({ subjectId, classId, groupId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_curriculum_plans")
      .select("id, title, subject, subject_id, class_id, group_id")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    }
    setPlans(((data ?? []) as any[]) as PlanRow[]);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const isThisUnit = (p: PlanRow) =>
    groupId ? p.group_id === groupId : !!classId && p.class_id === classId;

  const assigned = plans.filter(isThisUnit);
  const available = plans.filter(
    (p) =>
      !p.class_id &&
      !p.group_id &&
      (!subjectId || !p.subject_id || p.subject_id === subjectId),
  );

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    const patch: Record<string, unknown> = groupId
      ? { group_id: groupId, class_id: null }
      : { class_id: classId, group_id: null };
    if (subjectId) patch.subject_id = subjectId;
    const { error } = await supabase
      .from("teacher_curriculum_plans")
      .update(patch as any)
      .eq("id", selected);
    setBusy(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Přiřazeno", description: "ŠVP nyní platí pro tuto Výuku." });
    setSelected("");
    load();
  };

  const unassign = async (id: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("teacher_curriculum_plans")
      .update({ class_id: null, group_id: null } as any)
      .eq("id", id);
    setBusy(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Odebráno", description: "Vazba ŠVP na tuto Výuku byla zrušena." });
    load();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookMarked className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">ŠVP pro tuhle třídu/skupinu</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Vyberte, které ŠVP platí pro tuto Výuku. Spoluučitelé dané Výuky ho pak uvidí (jen ke čtení).
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítám…</p>
      ) : (
        <>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím není přiřazené žádné ŠVP.</p>
          ) : (
            <ul className="space-y-2">
              {assigned.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <Badge variant="secondary" className="mt-1">{p.subject}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => unassign(p.id)}
                    aria-label={`Odebrat vazbu ŠVP ${p.title}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger aria-label="Vyberte ŠVP k přiřazení">
                  <SelectValue placeholder={available.length ? "Vyberte ŠVP…" : "Žádné volné ŠVP"} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} · {p.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={!selected || busy} onClick={assign}>
              <Link2 className="h-4 w-4 mr-1" />
              Přiřadit
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default UnitCurriculumPlansCard;
