import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, getGradesForSubject } from "@/lib/textbook-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export interface Assignment {
  id?: string;
  topic_id: string;
  subject: string;
  grade: number;
  topic_title: string;
  sort_order: number;
}

interface Props {
  lessonId: string | null; // null for new lessons
  assignments: Assignment[];
  onChange: (assignments: Assignment[]) => void;
}

interface TopicOption {
  id: string;
  title: string;
}

const AssignmentRow = ({
  assignment,
  index,
  onRemove,
  onChange,
  allAssignments,
}: {
  assignment: Assignment;
  index: number;
  onRemove: () => void;
  onChange: (a: Assignment) => void;
  allAssignments: Assignment[];
}) => {
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const grades = assignment.subject ? getGradesForSubject(assignment.subject) : [];

  // Check for duplicate
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

  return (
    <div className={`flex items-center gap-2 p-2 rounded-md border ${isDuplicate ? "border-destructive bg-destructive/5" : "border-border"}`}>
      <div className="flex-1 grid grid-cols-3 gap-2">
        <Select
          value={assignment.subject}
          onValueChange={(v) => onChange({ ...assignment, subject: v, grade: getGradesForSubject(v)[0] ?? 1, topic_id: "", topic_title: "" })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Předmět" /></SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(assignment.grade)}
          onValueChange={(v) => onChange({ ...assignment, grade: Number(v), topic_id: "", topic_title: "" })}
          disabled={!assignment.subject}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ročník" /></SelectTrigger>
          <SelectContent>
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
          <SelectContent>
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
  );
};

const LessonAssignments = ({ lessonId, assignments, onChange }: Props) => {
  const addAssignment = () => {
    onChange([
      ...assignments,
      {
        topic_id: "",
        subject: SUBJECTS[0].id,
        grade: getGradesForSubject(SUBJECTS[0].id)[0],
        topic_title: "",
        sort_order: assignments.length,
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
        Lekce se zobrazí ve všech přiřazených předmětech/ročnících/tématech.
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
