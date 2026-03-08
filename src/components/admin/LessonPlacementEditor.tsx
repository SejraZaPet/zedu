import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, MapPin } from "lucide-react";

export interface Placement {
  id?: string;
  subject_slug: string;
  grade_number: number;
  topic_id: string | null;
  class_id: string | null;
}

interface TopicOption {
  id: string;
  title: string;
  grade: number;
  subject: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface Props {
  lessonId: string | null; // null for new lessons
  placements: Placement[];
  onChange: (placements: Placement[]) => void;
}

const LessonPlacementEditor = ({ lessonId, placements, onChange }: Props) => {
  const { data: subjects = [] } = useSubjects(true);
  const [allTopics, setAllTopics] = useState<TopicOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    const fetchTopicsAndClasses = async () => {
      const [topicsRes, classesRes] = await Promise.all([
        supabase.from("textbook_topics").select("id, title, grade, subject").order("sort_order"),
        supabase.from("classes").select("id, name").eq("archived", false).order("name"),
      ]);
      if (topicsRes.data) setAllTopics(topicsRes.data as TopicOption[]);
      if (classesRes.data) setClasses(classesRes.data as ClassOption[]);
    };
    fetchTopicsAndClasses();
  }, []);

  // Load existing placements when editing
  useEffect(() => {
    if (!lessonId) return;
    const loadPlacements = async () => {
      const { data } = await supabase
        .from("lesson_placements")
        .select("*")
        .eq("lesson_id", lessonId);
      if (data && data.length > 0) {
        onChange(data.map((p: any) => ({
          id: p.id,
          subject_slug: p.subject_slug,
          grade_number: p.grade_number,
          topic_id: p.topic_id,
          class_id: p.class_id,
        })));
      }
    };
    loadPlacements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const addPlacement = () => {
    const firstSubject = subjects[0];
    const firstGrade = firstSubject?.grades[0];
    onChange([...placements, {
      subject_slug: firstSubject?.slug ?? "",
      grade_number: firstGrade?.grade_number ?? 1,
      topic_id: null,
      class_id: null,
    }]);
  };

  const removePlacement = (index: number) => {
    onChange(placements.filter((_, i) => i !== index));
  };

  const updatePlacement = (index: number, updates: Partial<Placement>) => {
    const updated = [...placements];
    updated[index] = { ...updated[index], ...updates };
    // Reset topic if subject or grade changed
    if (updates.subject_slug !== undefined || updates.grade_number !== undefined) {
      updated[index].topic_id = null;
    }
    onChange(updated);
  };

  const getGradesForSubject = (slug: string) => {
    return subjects.find(s => s.slug === slug)?.grades ?? [];
  };

  const getTopicsForSubjectGrade = (slug: string, grade: number) => {
    return allTopics.filter(t => t.subject === slug && t.grade === grade);
  };

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="w-4 h-4 text-primary" />
          Umístění lekce
        </Label>
        <Button size="sm" variant="outline" onClick={addPlacement}>
          <Plus className="w-4 h-4 mr-1" />Přidat umístění
        </Button>
      </div>

      {placements.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-md">
          Zatím žádné umístění. Přidejte, kam tato lekce patří.
        </p>
      ) : (
        <div className="space-y-3">
          {placements.map((p, i) => {
            const availableGrades = getGradesForSubject(p.subject_slug);
            const availableTopics = getTopicsForSubjectGrade(p.subject_slug, p.grade_number);
            const subjectLabel = subjects.find(s => s.slug === p.subject_slug)?.label ?? p.subject_slug;
            const gradeLabel = availableGrades.find(g => g.grade_number === p.grade_number)?.label ?? `${p.grade_number}. ročník`;
            const topicLabel = allTopics.find(t => t.id === p.topic_id)?.title;

            return (
              <div key={i} className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{subjectLabel}</Badge>
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <Badge variant="outline" className="text-[10px]">{gradeLabel}</Badge>
                    {topicLabel && (
                      <>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <Badge variant="secondary" className="text-[10px]">{topicLabel}</Badge>
                      </>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removePlacement(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Předmět</Label>
                    <Select value={p.subject_slug} onValueChange={(v) => updatePlacement(i, { subject_slug: v, grade_number: getGradesForSubject(v)[0]?.grade_number ?? 1 })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => (
                          <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Ročník</Label>
                    <Select value={String(p.grade_number)} onValueChange={(v) => updatePlacement(i, { grade_number: Number(v) })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableGrades.map(g => (
                          <SelectItem key={g.grade_number} value={String(g.grade_number)}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Téma</Label>
                    <Select value={p.topic_id ?? "__none__"} onValueChange={(v) => updatePlacement(i, { topic_id: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Volitelné" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Bez tématu —</SelectItem>
                        {availableTopics.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {classes.length > 0 && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Třída (volitelné)</Label>
                    <Select value={p.class_id ?? "__none__"} onValueChange={(v) => updatePlacement(i, { class_id: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Všechny třídy" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Všechny třídy —</SelectItem>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LessonPlacementEditor;

// Helper to save placements after lesson save
export const savePlacements = async (lessonId: string, placements: Placement[]) => {
  // Delete existing placements
  await supabase.from("lesson_placements").delete().eq("lesson_id", lessonId);
  
  if (placements.length === 0) return;

  // Insert new placements
  const rows = placements.map(p => ({
    lesson_id: lessonId,
    subject_slug: p.subject_slug,
    grade_number: p.grade_number,
    topic_id: p.topic_id,
    class_id: p.class_id,
  }));

  const { error } = await supabase.from("lesson_placements").insert(rows);
  if (error) {
    console.error("[savePlacements] Error:", error);
    throw error;
  }
};
