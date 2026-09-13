import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";
import { Check, ChevronsUpDown, Plus, Trash2, MapPin } from "lucide-react";

export interface Placement {
  id?: string;
  subject_slug: string;
  grade_number: number;
  topic_id: string | null;
  class_id: string | null;
  subject_group_id: string | null;
  school_term: "full_year" | "first_half" | "second_half";
  scope_all_grades: boolean;
  target_type?: Audience;
  status?: string;
  scheduled_publish_at?: string | null;
}

const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
};

interface TopicOption {
  id: string;
  title: string;
  grade: number;
  subject: string;
}

type Audience = "grade" | "class" | "group";

interface Props {
  lessonId: string | null; // null for new lessons
  placements: Placement[];
  onChange: (placements: Placement[]) => void;
}

const LessonPlacementEditor = ({ lessonId, placements, onChange }: Props) => {
  const { data: subjects = [] } = useSubjects(true);
  const { myClasses } = useTeacherClasses();
  const { groups } = useSubjectGroups();
  const [allTopics, setAllTopics] = useState<TopicOption[]>([]);
  const [targetPicker, setTargetPicker] = useState<number | null>(null);
  const menuClass = "min-w-[18rem] max-w-[calc(100vw-2rem)]";

  useEffect(() => {
    const fetchTopics = async () => {
      const topicsRes = await supabase.from("textbook_topics").select("id, title, grade, subject").order("sort_order");
      if (topicsRes.data) setAllTopics(topicsRes.data as TopicOption[]);
    };
    fetchTopics();
  }, []);

  // Load existing placements when editing. An empty result must clear stale
  // editor state when the sheet switches between lessons.
  useEffect(() => {
    if (!lessonId) return;
    const loadPlacements = async () => {
      const { data } = await supabase
        .from("lesson_placements")
        .select("*")
        .eq("lesson_id", lessonId);
      if (data) {
        onChange(data.map((p: any) => ({
          id: p.id,
          subject_slug: p.subject_slug,
          grade_number: p.grade_number,
          topic_id: p.topic_id,
          class_id: p.class_id,
          subject_group_id: p.subject_group_id ?? null,
          school_term: p.school_term ?? "full_year",
          scope_all_grades: p.scope_all_grades ?? false,
          target_type: p.class_id ? "class" : p.subject_group_id ? "group" : "grade",
          status: p.status ?? "published",
          scheduled_publish_at: p.scheduled_publish_at ?? null,
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
      subject_group_id: null,
      school_term: "full_year",
      scope_all_grades: false,
      target_type: "grade",
      status: "published",
      scheduled_publish_at: null,
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

  const getAudience = (placement: Placement): Audience => {
    if (placement.target_type) return placement.target_type;
    if (placement.class_id) return "class";
    if (placement.subject_group_id) return "group";
    return "grade";
  };

  const setAudience = (index: number, audience: Audience) => {
    updatePlacement(index, {
      target_type: audience,
      class_id: audience === "class" ? placements[index].class_id : null,
      subject_group_id: audience === "group" ? placements[index].subject_group_id : null,
    });
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
            const audience = getAudience(p);
            const targetOptions = audience === "class" ? myClasses : groups;
            const targetId = audience === "class" ? p.class_id : p.subject_group_id;
            const selectedTarget = targetOptions.find(option => option.id === targetId);

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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1.25fr)_minmax(9rem,0.8fr)_minmax(14rem,1.5fr)]">
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground">Předmět</Label>
                    <Select value={p.subject_slug} onValueChange={(v) => updatePlacement(i, { subject_slug: v, grade_number: getGradesForSubject(v)[0]?.grade_number ?? 1 })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        {subjects.map(s => (
                          <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground">Ročník</Label>
                    <Select value={String(p.grade_number)} onValueChange={(v) => updatePlacement(i, { grade_number: Number(v) })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        {availableGrades.map(g => (
                          <SelectItem key={g.grade_number} value={String(g.grade_number)}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground">Téma</Label>
                    <Select value={p.topic_id ?? "__none__"} onValueChange={(v) => updatePlacement(i, { topic_id: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Volitelné" /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        <SelectItem value="__none__">— Bez tématu —</SelectItem>
                        {availableTopics.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Komu zobrazit</Label>
                    <Select value={audience} onValueChange={(v: Audience) => setAudience(i, v)}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        <SelectItem value="grade">Celému ročníku</SelectItem>
                        <SelectItem value="class">Konkrétní třídě</SelectItem>
                        <SelectItem value="group">Skupině</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {audience !== "grade" && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        {audience === "class" ? "Třída" : "Skupina"}
                      </Label>
                      <Popover open={targetPicker === i} onOpenChange={(open) => setTargetPicker(open ? i : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="mt-0.5 h-8 w-full justify-between px-3 text-xs font-normal">
                            <span className="truncate">{selectedTarget?.name ?? `Vybrat ${audience === "class" ? "třídu" : "skupinu"}…`}</span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0" align="start">
                          <Command>
                            <CommandInput placeholder={audience === "class" ? "Hledat třídu…" : "Hledat skupinu…"} />
                            <CommandList>
                              <CommandEmpty>{audience === "class" ? "Žádná vlastní třída nenalezena." : "Žádná vlastní skupina nenalezena."}</CommandEmpty>
                              <CommandGroup>
                                {targetOptions.map(option => (
                                  <CommandItem
                                    key={option.id}
                                    value={option.name}
                                    onSelect={() => {
                                      updatePlacement(i, audience === "class"
                                        ? { class_id: option.id, subject_group_id: null }
                                        : { subject_group_id: option.id, class_id: null });
                                      setTargetPicker(null);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${targetId === option.id ? "opacity-100" : "opacity-0"}`} />
                                    {option.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div>
                    <Label className="text-[10px] text-muted-foreground">Období</Label>
                    <Select value={p.school_term} onValueChange={(v: Placement["school_term"]) => updatePlacement(i, { school_term: v })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        <SelectItem value="full_year">Celý školní rok</SelectItem>
                        <SelectItem value="first_half">1. pololetí</SelectItem>
                        <SelectItem value="second_half">2. pololetí</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">Rozsah platnosti</Label>
                    <Select value={p.scope_all_grades ? "all" : "single"} onValueChange={(v) => updatePlacement(i, { scope_all_grades: v === "all" })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        <SelectItem value="single">Jeden ročník</SelectItem>
                        <SelectItem value="all">Celé studium oboru</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Stav publikování</Label>
                    <Select
                      value={p.status ?? "published"}
                      onValueChange={(v) => updatePlacement(i, {
                        status: v,
                        scheduled_publish_at: v === "scheduled" ? p.scheduled_publish_at ?? null : null,
                      })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent className={menuClass}>
                        <SelectItem value="draft">Koncept</SelectItem>
                        <SelectItem value="scheduled">Naplánováno</SelectItem>
                        <SelectItem value="published">Publikováno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(p.status ?? "published") === "scheduled" && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Publikovat v</Label>
                      <Input
                        type="datetime-local"
                        value={toLocalInput(p.scheduled_publish_at)}
                        onChange={(e) => updatePlacement(i, { scheduled_publish_at: fromLocalInput(e.target.value) })}
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                  )}
                </div>
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
  const incompleteTarget = placements.find((p) =>
    (p.target_type === "class" && !p.class_id)
    || (p.target_type === "group" && !p.subject_group_id)
  );
  if (incompleteTarget) throw new Error("Vyberte konkrétní třídu nebo skupinu.");

  // Delete existing placements only after client-side validation succeeds.
  const { error: deleteError } = await supabase.from("lesson_placements").delete().eq("lesson_id", lessonId);
  if (deleteError) throw deleteError;

  if (placements.length === 0) return;

  // Insert new placements
  const rows = placements.map(p => ({
    lesson_id: lessonId,
    subject_slug: p.subject_slug,
    grade_number: p.grade_number,
    topic_id: p.topic_id,
    class_id: p.class_id,
    subject_group_id: p.subject_group_id,
    school_term: p.school_term,
    scope_all_grades: p.scope_all_grades,
    status: p.status ?? "published",
    scheduled_publish_at: p.status === "scheduled" ? p.scheduled_publish_at ?? null : null,
  }));

  const { error } = await supabase.from("lesson_placements").insert(rows);
  if (error) {
    console.error("[savePlacements] Error:", error);
    throw error;
  }
};
