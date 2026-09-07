import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Loader2, ArrowRight, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import SubjectPicker from "@/components/subjects/SubjectPicker";

/** Školní rok ve formátu "2026/2027" (přelom v srpnu). */
const currentSchoolYear = (d: Date = new Date()) => {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${y + 1}`;
};

interface ClassSubjectRow {
  id: string;
  subject_id: string;
  school_year: string;
  archived: boolean;
  subjectName: string;
  abbreviation: string;
  color: string;
}

const fallbackColor = (s: string) => {
  const palette = ["#6EC6D9", "#9B6CFF", "#F472B6", "#F87171", "#FB923C", "#FBBF24", "#34D399", "#60A5FA"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

/**
 * Předměty vyučované v této třídě — vazby z `class_subjects` lze přidávat
 * i odebírat přímo tady, nezávisle na rozvrhu. Kombinace, které existují
 * jen díky rozvrhu, se zobrazují jako doplněk (bez možnosti odebrání).
 */
export default function ClassSubjectsCard({ classId }: { classId: string }) {
  const navigate = useNavigate();
  const { units, loading: loadingUnits, refetch: refetchUnits } = useTeachingUnits();

  const [rows, setRows] = useState<ClassSubjectRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [pickedSubjectId, setPickedSubjectId] = useState<string | null>(null);
  const [pickedSubjectName, setPickedSubjectName] = useState("");
  const [year, setYear] = useState(currentSchoolYear());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("class_subjects")
      .select("id, subject_id, school_year, archived, subjects(name, abbreviation, color)")
      .eq("class_id", classId)
      .eq("archived", false);
    if (error) {
      toast.error("Předměty třídy se nepodařilo načíst.");
      setLoadingRows(false);
      return;
    }
    const mapped = (((data as any[]) ?? []).map((r) => {
      const name = (r.subjects?.name ?? "").trim();
      return {
        id: r.id,
        subject_id: r.subject_id,
        school_year: r.school_year,
        archived: !!r.archived,
        subjectName: name,
        abbreviation: (r.subjects?.abbreviation || name.slice(0, 3)).toUpperCase(),
        color: r.subjects?.color || fallbackColor(name),
      } as ClassSubjectRow;
    })).filter((r) => r.subjectName);
    mapped.sort((a, b) => a.subjectName.localeCompare(b.subjectName, "cs"));
    setRows(mapped);
    setLoadingRows(false);
  }, [classId]);

  useEffect(() => {
    setLoadingRows(true);
    void loadRows();
  }, [loadRows]);

  /** Kombinace pocházející výhradně z rozvrhu (ještě nejsou ukotvené ke třídě). */
  const scheduleOnly = useMemo(() => {
    const linked = new Set(rows.map((r) => r.subject_id));
    return units.filter(
      (u) => u.kind === "class" && u.targetId === classId && u.fromScheduleOnly && !linked.has(u.subjectId),
    );
  }, [units, rows, classId]);

  const openAdd = () => {
    setPickedSubjectId(null);
    setPickedSubjectName("");
    setYear(currentSchoolYear());
    setAddOpen(true);
  };

  /** Přidá vazbu předmět × třída. Duplicitu jen oznámí, archivovanou obnoví. */
  const addSubject = async (subjectId: string, schoolYear: string) => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("class_subjects")
        .select("id, archived, school_year")
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .eq("school_year", schoolYear)
        .maybeSingle();

      if (existing) {
        if ((existing as any).archived) {
          const { error } = await supabase
            .from("class_subjects")
            .update({ archived: false } as any)
            .eq("id", (existing as any).id);
          if (error) throw error;
          toast.success("Předmět byl ve třídě obnoven.");
        } else {
          toast.info("Tento předmět už třída pro zvolený školní rok má.");
        }
      } else {
        const { error } = await supabase
          .from("class_subjects")
          .insert({ class_id: classId, subject_id: subjectId, school_year: schoolYear } as any);
        if (error) throw error;
        toast.success("Předmět byl přidán ke třídě.");
      }
      setAddOpen(false);
      await loadRows();
      void refetchUnits();
    } catch (e: any) {
      toast.error(e?.message ?? "Předmět se nepodařilo přidat.");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: ClassSubjectRow) => {
    if (!confirm(`Odebrat předmět „${row.subjectName}" z této třídy?`)) return;
    setBusyId(row.id);
    const { error } = await supabase.from("class_subjects").delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Předmět byl z třídy odebrán.");
    await loadRows();
    void refetchUnits();
  };

  const loading = loadingRows || loadingUnits;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" /> Předměty
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Přidat předmět
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/skupiny")}>
            Spravovat <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
          </div>
        ) : rows.length === 0 && scheduleOnly.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Této třídě zatím není přiřazen žádný předmět. Přidejte ho tlačítkem „Přidat předmět“.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rows.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card pl-3 pr-1.5 py-1.5 text-sm hover:border-primary/50 transition-colors"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2"
                  onClick={() => navigate(`/ucitel/vyuka/${r.subject_id}/trida/${classId}`)}
                  title={`Otevřít Výuku: ${r.subjectName}`}
                >
                  <span
                    className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.abbreviation}
                  </span>
                  {r.subjectName}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                  disabled={busyId === r.id}
                  onClick={() => void removeRow(r)}
                  aria-label={`Odebrat předmět ${r.subjectName}`}
                  title="Odebrat předmět z třídy"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            {scheduleOnly.map((u) => (
              <span
                key={u.key}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-1.5 text-sm"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2"
                  onClick={() => navigate(u.path)}
                  title={`Výuka z rozvrhu: ${u.subjectName}`}
                >
                  <span
                    className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.abbreviation}
                  </span>
                  {u.subjectName}
                </button>
                <Badge variant="outline" className="text-[10px] font-normal">
                  z rozvrhu
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  disabled={saving}
                  onClick={() => void addSubject(u.subjectId, currentSchoolYear())}
                  title="Ukotvit ke třídě, aby vazba přežila změnu rozvrhu"
                >
                  Ukotvit
                </Button>
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Přidat předmět ke třídě</DialogTitle>
            <DialogDescription>
              Vazba vznikne nezávisle na rozvrhu — hodinu doplňovat nemusíte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Předmět</Label>
              <SubjectPicker
                value={pickedSubjectId}
                placeholder="Vybrat nebo založit předmět…"
                onChange={({ subjectId, name }) => {
                  setPickedSubjectId(subjectId);
                  setPickedSubjectName(name);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-subject-year">Školní rok</Label>
              <Input
                id="class-subject-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={currentSchoolYear()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Zrušit
            </Button>
            <Button
              disabled={!pickedSubjectId || saving}
              onClick={() => {
                if (!pickedSubjectId) return;
                void addSubject(pickedSubjectId, year.trim() || currentSchoolYear());
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Přidat {pickedSubjectName || "předmět"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
