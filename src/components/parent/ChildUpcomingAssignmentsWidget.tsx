import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorForSubject } from "@/lib/teacher-schedule-store";
import { ExamTypeBadge } from "@/components/assignments/ExamTypeBadge";

interface Props {
  studentIds: string[];
  studentNames: Record<string, string>;
}

interface UpcomingAssignment {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  submitted: boolean;
  exam_type: string | null;
}

const fmtDeadline = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const daysUntil = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return diff / (1000 * 60 * 60 * 24);
};

const ChildUpcomingAssignmentsWidget = ({ studentIds, studentNames }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(studentIds[0] ?? null);
  const [items, setItems] = useState<UpcomingAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeId && studentIds[0]) setActiveId(studentIds[0]);
  }, [studentIds, activeId]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      const { data: classMems } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", activeId);
      const classIds = (classMems ?? []).map((c: any) => c.class_id);

      if (classIds.length === 0) {
        if (!cancelled) { setItems([]); setLoading(false); }
        return;
      }

      const nowIso = new Date().toISOString();
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, deadline, exam_type, lesson_plans(subject)")
        .eq("status", "published")
        .in("class_id", classIds)
        .gt("deadline", nowIso)
        .order("deadline", { ascending: true });

      const list = (assignments ?? []) as any[];
      const ids = list.map((a) => a.id);

      let submittedSet = new Set<string>();
      if (ids.length > 0) {
        const { data: attempts } = await supabase
          .from("assignment_attempts")
          .select("assignment_id, status")
          .eq("student_id", activeId)
          .in("assignment_id", ids);
        submittedSet = new Set(
          (attempts ?? [])
            .filter((a: any) => a.status === "submitted" || a.status === "graded")
            .map((a: any) => a.assignment_id),
        );
      }

      const result: UpcomingAssignment[] = list.map((a) => ({
        id: a.id,
        title: a.title || "Úloha",
        subject: a.lesson_plans?.subject || "Obecné",
        deadline: a.deadline,
        submitted: submittedSet.has(a.id),
        exam_type: a.exam_type ?? null,
      }));

      if (!cancelled) {
        setItems(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  if (studentIds.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h3 className="font-heading text-lg font-bold text-foreground">Blížící se úkoly</h3>
        </div>
        {studentIds.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {studentIds.map((id) => (
              <Button
                key={id}
                size="sm"
                variant={activeId === id ? "default" : "outline"}
                onClick={() => setActiveId(id)}
              >
                {studentNames[id] ?? "Dítě"}
              </Button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Žádné nadcházející úkoly.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {items.map((a) => {
            const days = daysUntil(a.deadline);
            const urgent = days < 2;
            const subjectColor = colorForSubject(a.subject);
            return (
              <li
                key={a.id}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                  urgent && !a.submitted ? "bg-red-500/5" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: subjectColor }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">{a.title}</span>
                      {urgent && !a.submitted && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="px-1.5 py-0.5 rounded font-medium"
                        style={{ color: subjectColor, backgroundColor: `${subjectColor}1A` }}
                      >
                        {a.subject}
                      </span>
                      <span className={urgent && !a.submitted ? "text-red-500 font-medium" : ""}>
                        {fmtDeadline(a.deadline)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  {a.submitted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Odevzdáno
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-medium ${
                        urgent ? "text-red-500" : "text-muted-foreground"
                      }`}
                    >
                      Neodevzdáno
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ChildUpcomingAssignmentsWidget;
