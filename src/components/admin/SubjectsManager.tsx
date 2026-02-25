import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useSubjects, type SubjectRecord, type GradeRecord } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Save, X, ArrowLeft, GripVertical, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ──────────────────── Grade Editor ────────────────────
const GradeEditor = ({
  grades,
  onChange,
}: {
  grades: { grade_number: number; label: string }[];
  onChange: (g: { grade_number: number; label: string }[]) => void;
}) => {
  const addGrade = () => {
    const next = grades.length > 0 ? Math.max(...grades.map((g) => g.grade_number)) + 1 : 1;
    onChange([...grades, { grade_number: next, label: `${next}. ročník` }]);
  };

  return (
    <div>
      <Label className="mb-2 block">Ročníky</Label>
      <div className="space-y-2 mb-2">
        {grades.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={g.grade_number}
              onChange={(e) => {
                const updated = [...grades];
                updated[i] = { ...g, grade_number: Number(e.target.value) };
                onChange(updated);
              }}
              className="w-20 h-8 text-xs"
              placeholder="Číslo"
            />
            <Input
              value={g.label}
              onChange={(e) => {
                const updated = [...grades];
                updated[i] = { ...g, label: e.target.value };
                onChange(updated);
              }}
              className="flex-1 h-8 text-xs"
              placeholder="Název (např. 1. ročník)"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onChange(grades.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={addGrade}>
        <Plus className="w-4 h-4 mr-1" /> Přidat ročník
      </Button>
    </div>
  );
};

// ──────────────────── Subject Form ────────────────────
interface SubjectForm {
  slug: string;
  label: string;
  abbreviation: string;
  description: string;
  color: string;
  active: boolean;
  grades: { grade_number: number; label: string }[];
}

const emptyForm: SubjectForm = {
  slug: "",
  label: "",
  abbreviation: "",
  description: "",
  color: "#c97755",
  active: true,
  grades: [{ grade_number: 1, label: "1. ročník" }],
};

// ──────────────────── Main Component ────────────────────
const SubjectsManager = () => {
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading } = useSubjects(false);
  const [editing, setEditing] = useState<SubjectRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<SubjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Check if subject has lessons (for delete protection)
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      if (subjects.length === 0) return;
      const slugs = subjects.map((s) => s.slug);
      const { data } = await supabase
        .from("textbook_topics")
        .select("subject, id")
        .in("subject", slugs);
      
      if (!data) return;
      const topicIds = data.map((t: any) => t.id);
      if (topicIds.length === 0) { setLessonCounts({}); return; }

      const { data: assignments } = await supabase
        .from("lesson_topic_assignments")
        .select("topic_id")
        .in("topic_id", topicIds);

      const counts: Record<string, number> = {};
      for (const t of data as any[]) {
        const c = (assignments ?? []).filter((a: any) => a.topic_id === t.id).length;
        counts[t.subject] = (counts[t.subject] ?? 0) + c;
      }
      setLessonCounts(counts);
    };
    fetchCounts();
  }, [subjects]);

  const startEdit = (s: SubjectRecord) => {
    setEditing(s);
    setIsNew(false);
    setForm({
      slug: s.slug,
      label: s.label,
      abbreviation: s.abbreviation,
      description: s.description,
      color: s.color,
      active: s.active,
      grades: s.grades.map((g) => ({ grade_number: g.grade_number, label: g.label })),
    });
  };

  const startNew = () => {
    setEditing(null);
    setIsNew(true);
    setForm(emptyForm);
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const generateSlug = (label: string) =>
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const save = async () => {
    if (!form.label.trim()) {
      toast.error("Vyplňte název předmětu.");
      return;
    }
    if (form.grades.length === 0) {
      toast.error("Přidejte alespoň jeden ročník.");
      return;
    }

    setSaving(true);
    const slug = isNew ? generateSlug(form.label) : form.slug;

    try {
      if (isNew) {
        // Check slug uniqueness
        const { data: existing } = await supabase
          .from("textbook_subjects")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (existing) {
          toast.error("Předmět s tímto názvem již existuje.");
          setSaving(false);
          return;
        }

        const { data: newSubject, error } = await supabase
          .from("textbook_subjects")
          .insert({
            slug,
            label: form.label,
            abbreviation: form.abbreviation,
            description: form.description,
            color: form.color,
            active: form.active,
            sort_order: subjects.length,
          })
          .select("id")
          .single();

        if (error) throw error;

        // Insert grades
        if (form.grades.length > 0) {
          await supabase.from("textbook_grades").insert(
            form.grades.map((g, i) => ({
              subject_id: newSubject.id,
              grade_number: g.grade_number,
              label: g.label,
              sort_order: i,
            }))
          );
        }

        toast.success("Předmět vytvořen.");
      } else if (editing) {
        // Update subject
        const { error } = await supabase
          .from("textbook_subjects")
          .update({
            label: form.label,
            abbreviation: form.abbreviation,
            description: form.description,
            color: form.color,
            active: form.active,
          })
          .eq("id", editing.id);

        if (error) throw error;

        // Sync grades: delete all, re-insert
        await supabase.from("textbook_grades").delete().eq("subject_id", editing.id);
        if (form.grades.length > 0) {
          await supabase.from("textbook_grades").insert(
            form.grades.map((g, i) => ({
              subject_id: editing.id,
              grade_number: g.grade_number,
              label: g.label,
              sort_order: i,
            }))
          );
        }

        toast.success("Předmět uložen.");
      }

      queryClient.invalidateQueries({ queryKey: ["textbook-subjects"] });
      cancel();
    } catch (err: any) {
      toast.error(err.message ?? "Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSubject = async (s: SubjectRecord) => {
    const count = lessonCounts[s.slug] ?? 0;
    if (count > 0) {
      const archiveInstead = confirm(
        `Předmět „${s.label}" má ${count} přiřazených lekcí a nelze ho smazat.\n\nChcete ho deaktivovat (archivovat)?`
      );
      if (archiveInstead) {
        await supabase.from("textbook_subjects").update({ active: false }).eq("id", s.id);
        queryClient.invalidateQueries({ queryKey: ["textbook-subjects"] });
        toast.success("Předmět deaktivován.");
      }
      return;
    }

    if (!confirm(`Opravdu smazat předmět „${s.label}"?`)) return;
    await supabase.from("textbook_subjects").delete().eq("id", s.id);
    queryClient.invalidateQueries({ queryKey: ["textbook-subjects"] });
    toast.success("Předmět smazán.");
  };

  // ──────── Edit / New Form ────────
  if (isNew || editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={cancel}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
          </Button>
          <h3 className="font-heading text-lg">{isNew ? "Nový předmět" : `Upravit: ${editing?.label}`}</h3>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Název předmětu *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="mt-1"
                placeholder="Např. Technologie"
              />
            </div>
            <div>
              <Label>Zkratka</Label>
              <Input
                value={form.abbreviation}
                onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                className="mt-1"
                placeholder="Např. TECH"
              />
            </div>
            <div>
              <Label>Barva</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1"
                  placeholder="#c97755"
                />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Popis</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1"
                placeholder="Krátký popis předmětu…"
                rows={2}
              />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Aktivní (zobrazovat na webu)</Label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <GradeEditor
              grades={form.grades}
              onChange={(g) => setForm({ ...form, grades: g })}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {saving ? "Ukládám…" : "Uložit"}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              <X className="w-4 h-4 mr-1" /> Zrušit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ──────── List View ────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl">Předměty a ročníky</h2>
        <Button size="sm" onClick={startNew}>
          <Plus className="w-4 h-4 mr-1" /> Přidat předmět
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Načítání…</p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Zatím žádné předměty.</p>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 border border-border rounded-lg p-4 bg-card"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{s.label}</p>
                  {s.abbreviation && (
                    <Badge variant="outline" className="text-[10px]">{s.abbreviation}</Badge>
                  )}
                  {!s.active && (
                    <Badge variant="secondary" className="text-[10px]">Neaktivní</Badge>
                  )}
                </div>
                <div className="flex gap-1 mt-1">
                  {s.grades.map((g) => (
                    <Badge key={g.id} variant="outline" className="text-[10px] px-1.5 py-0">
                      {g.label}
                    </Badge>
                  ))}
                  {s.grades.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">Žádné ročníky</span>
                  )}
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{s.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => startEdit(s)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteSubject(s)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubjectsManager;
