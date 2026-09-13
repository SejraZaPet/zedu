import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects, getGradeNumbers } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";
import { Check, ChevronsUpDown, Plus, Trash2, AlertTriangle } from "lucide-react";

type Audience = "grade" | "class" | "group";

export interface Assignment {
  id?: string;
  topic_id: string;
  subject: string;
  grade: number;
  topic_title: string;
  sort_order: number;
  status?: string;
  scheduled_publish_at?: string | null;
  class_id?: string | null;
  subject_group_id?: string | null;
  school_term?: "full_year" | "first_half" | "second_half";
  scope_all_grades?: boolean;
  target_type?: Audience;
}

interface Props {
  lessonId: string | null;
  assignments: Assignment[];
  onChange: (assignments: Assignment[]) => void;
}

interface TopicOption {
  id: string;
  title: string;
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

const AssignmentRow = ({
  assignment,
  index,
  onRemove,
  onChange,
  allAssignments,
  targetPickerOpen,
  onTargetPickerOpenChange,
}: {
  assignment: Assignment;
  index: number;
  onRemove: () => void;
  onChange: (a: Assignment) => void;
  allAssignments: Assignment[];
  targetPickerOpen: boolean;
  onTargetPickerOpenChange: (open: boolean) => void;
}) => {
  const { data: subjects = [] } = useSubjects(false);
  const { myClasses } = useTeacherClasses();
  const { groups } = useSubjectGroups();
  const [topics, setTopics] = useState<TopicOption[]>([]);

  const currentSubject = subjects.find((s) => s.slug === assignment.subject);
  const grades = currentSubject ? getGradeNumbers(currentSubject) : [];

  const isDuplicate = allAssignments.some(
    (a, i) => i !== index && a.topic_id === assignment.topic_id && a.topic_id !== ""
  );

  useEffect(() => {
    const fetchTopics = async () => {
      if (!assignment.subject || !assignment.grade) {
        setTopics([]);
        return;
      }
      const { data } = await supabase
        .from("textbook_topics")
        .select("id, title")
        .eq("subject", assignment.subject)
        .eq("grade", assignment.grade)
        .order("sort_order");
      setTopics(data ?? []);
    };
    fetchTopics();
  }, [assignment.subject, assignment.grade]);

  const status = assignment.status ?? "published";
  const audience: Audience = assignment.target_type
    ?? (assignment.class_id ? "class" : assignment.subject_group_id ? "group" : "grade");
  const targetOptions = audience === "class" ? myClasses : groups;
  const targetId = audience === "class" ? assignment.class_id : assignment.subject_group_id;
  const selectedTarget = targetOptions.find((option) => option.id === targetId);
  const menuClass = "min-w-[18rem] max-w-[calc(100vw-2rem)]";

  return (
    <div className={`p-2 rounded-md border space-y-2 ${isDuplicate ? "border-destructive bg-destructive/5" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-1 gap-2 md:grid-cols-[minmax(12rem,1.1fr)_minmax(9rem,0.75fr)_minmax(16rem,1.4fr)]">
          <Select
            value={assignment.subject}
            onValueChange={(v) => {
              const s = subjects.find((s) => s.slug === v);
              const g = s ? getGradeNumbers(s) : [];
              onChange({ ...assignment, subject: v, grade: g[0] ?? 1, topic_id: "", topic_title: "" });
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Předmět" /></SelectTrigger>
            <SelectContent className={menuClass}>
              {subjects.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(assignment.grade)}
            onValueChange={(v) => onChange({ ...assignment, grade: Number(v), topic_id: "", topic_title: "" })}
            disabled={!assignment.subject}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ročník" /></SelectTrigger>
            <SelectContent className={menuClass}>
              {grades.map((g) => (
                <SelectItem key={g} value={String(g)}>{g}. ročník</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={assignment.topic_id || "none"}
            onValueChange={(v) => {
              const t = topics.find((t) => t.id === v);
              onChange({ ...assignment, topic_id: v, topic_title: t?.title ?? "" });
            }}
            disabled={topics.length === 0}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Téma" /></SelectTrigger>
            <SelectContent className={menuClass}>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isDuplicate && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}

        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Komu zobrazit</Label>
          <Select
            value={audience}
            onValueChange={(value: Audience) => onChange({
              ...assignment,
              target_type: value,
              class_id: value === "class" ? assignment.class_id ?? null : null,
              subject_group_id: value === "group" ? assignment.subject_group_id ?? null : null,
            })}
          >
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
            <Label className="text-[10px] text-muted-foreground">{audience === "class" ? "Třída" : "Skupina"}</Label>
            <Popover open={targetPickerOpen} onOpenChange={onTargetPickerOpenChange}>
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
                      {targetOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.name}
                          onSelect={() => {
                            onChange({
                              ...assignment,
                              class_id: audience === "class" ? option.id : null,
                              subject_group_id: audience === "group" ? option.id : null,
                            });
                            onTargetPickerOpenChange(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${targetId === option.id ? "opacity-100" : "opacity-0"}`} />
                          <span>{option.name}</span>
                          {"field_of_study" in option && option.field_of_study && (
                            <span className="ml-auto text-xs text-muted-foreground">{option.field_of_study}</span>
                          )}
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
          <Select
            value={assignment.school_term ?? "full_year"}
            onValueChange={(value: Assignment["school_term"]) => onChange({ ...assignment, school_term: value })}
          >
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
          <Select
            value={assignment.scope_all_grades ? "all" : "single"}
            onValueChange={(value) => onChange({ ...assignment, scope_all_grades: value === "all" })}
          >
            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
            <SelectContent className={menuClass}>
              <SelectItem value="single">Jeden ročník</SelectItem>
              <SelectItem value="all">Celé studium oboru</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-2 items-center pl-1">
        <Select
          value={status}
          onValueChange={(v) =>
            onChange({
              ...assignment,
              status: v,
              scheduled_publish_at: v === "scheduled" ? assignment.scheduled_publish_at ?? null : null,
            })
          }
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className={menuClass}>
            <SelectItem value="draft">Koncept</SelectItem>
            <SelectItem value="scheduled">Naplánováno</SelectItem>
            <SelectItem value="published">Publikováno</SelectItem>
          </SelectContent>
        </Select>
        {status === "scheduled" ? (
          <Input
            type="datetime-local"
            value={toLocalInput(assignment.scheduled_publish_at)}
            onChange={(e) =>
              onChange({ ...assignment, scheduled_publish_at: fromLocalInput(e.target.value) })
            }
            className="h-7 text-xs"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">
            {status === "published" ? "Viditelné studentům v tomto umístění" : "Skryto v tomto umístění"}
          </span>
        )}
      </div>
    </div>
  );
};

const LessonAssignments = ({ lessonId, assignments, onChange }: Props) => {
  const { data: subjects = [] } = useSubjects(false);
  const [targetPicker, setTargetPicker] = useState<number | null>(null);

  const addAssignment = async () => {
    let initial: Pick<Assignment, "topic_id" | "subject" | "grade" | "topic_title"> | null = null;
    if (assignments.length === 0 && lessonId) {
      const { data } = await supabase
        .from("textbook_lessons")
        .select("topic_id, textbook_topics(id, title, subject, grade)")
        .eq("id", lessonId)
        .maybeSingle();
      const topic = (data as any)?.textbook_topics;
      if (topic) {
        initial = { topic_id: topic.id, subject: topic.subject, grade: topic.grade, topic_title: topic.title };
      }
    }
    const firstSubject = subjects[0];
    const firstGrade = firstSubject ? getGradeNumbers(firstSubject)[0] ?? 1 : 1;
    onChange([
      ...assignments,
      {
        topic_id: initial?.topic_id ?? "",
        subject: initial?.subject ?? firstSubject?.slug ?? "",
        grade: initial?.grade ?? firstGrade,
        topic_title: initial?.topic_title ?? "",
        sort_order: assignments.length,
        status: "published",
        scheduled_publish_at: null,
        class_id: null,
        subject_group_id: null,
        school_term: "full_year",
        scope_all_grades: false,
        target_type: "grade",
      },
    ]);
  };

  const removeAssignment = (index: number) => {
    onChange(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = (index: number, a: Assignment) => {
    onChange(assignments.map((cur, i) => (i === index ? a : cur)));
  };

  return (
    <div>
      <Label className="mb-2 block">Umístění v učebnicích</Label>
      <p className="text-xs text-muted-foreground mb-3">
        Lekce se zobrazí ve všech přiřazených předmětech/ročnících/tématech. Publikování lze nastavit pro každé umístění zvlášť.
      </p>
      <div className="space-y-2 mb-3">
        {assignments.map((a, i) => (
          <AssignmentRow
            key={i}
            assignment={a}
            index={i}
            onRemove={() => removeAssignment(i)}
            onChange={(updated) => updateAssignment(i, updated)}
            allAssignments={assignments}
            targetPickerOpen={targetPicker === i}
            onTargetPickerOpenChange={(open) => setTargetPicker(open ? i : null)}
          />
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={addAssignment}>
        <Plus className="w-4 h-4 mr-1" /> Přidat umístění
      </Button>
      {assignments.length === 0 && (
        <p className="text-xs text-destructive mt-2">Lekce musí mít alespoň jedno umístění.</p>
      )}
    </div>
  );
};

export default LessonAssignments;
export type { Assignment as LessonAssignment };
