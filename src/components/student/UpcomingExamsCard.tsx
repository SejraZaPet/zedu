import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { loadStudentAssignmentAttempts } from "@/lib/student-assignment-attempts";
import { getExamTypeMeta } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { CalendarClock, Sparkles } from "lucide-react";

interface UpcomingExam {
  id: string;
  title: string;
  exam_type: string | null;
  deadline: string | null;
  lesson_id: string | null;
  subjectName: string | null;
}

const EXAM_TYPES = ["ustni", "pisemne", "digitalni"];
const HORIZON_DAYS = 14;

function daysUntil(deadline: string): number {
  const now = new Date();
  const end = new Date(deadline);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86400000);
}

function daysLabel(days: number): string {
  if (days <= 0) return "dnes";
  if (days === 1) return "zítra";
  if (days >= 2 && days <= 4) return `za ${days} dny`;
  return `za ${days} dnů`;
}

/** Karta „Co mě čeká“ – nejbližší testy, zkoušení a písemky v příštích 14 dnech. */
const UpcomingExamsCard = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<UpcomingExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000);

      const { data: assignmentsData } = await supabase
        .from("assignments" as any)
        .select("id, title, exam_type, deadline, lesson_id, subject_id")
        .eq("status", "published")
        .in("exam_type", EXAM_TYPES)
        .gte("deadline", now.toISOString())
        .lte("deadline", horizon.toISOString())
        .order("deadline", { ascending: true });

      const rows = (assignmentsData as any[]) ?? [];
      if (rows.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Vynechat splněné (existuje odevzdaný pokus)
      const attempts = await loadStudentAssignmentAttempts(userId, rows.map((a) => a.id));
      const doneIds = new Set(
        ((attempts as any[]) ?? [])
          .filter((a) => a.status === "submitted" || a.score != null)
          .map((a) => a.assignment_id),
      );
      const open = rows.filter((a) => !doneIds.has(a.id));

      // Názvy předmětů
      const subjectIds = [...new Set(open.map((a) => a.subject_id).filter(Boolean))] as string[];
      const subjectNames = new Map<string, string>();
      if (subjectIds.length > 0) {
        const { data: subjects } = await supabase
          .from("subjects")
          .select("id, name")
          .in("id", subjectIds);
        (subjects ?? []).forEach((s: any) => subjectNames.set(s.id, s.name));
      }

      setItems(
        open.map((a) => ({
          id: a.id,
          title: a.title,
          exam_type: a.exam_type,
          deadline: a.deadline,
          lesson_id: a.lesson_id ?? null,
          subjectName: a.subject_id ? subjectNames.get(a.subject_id) ?? null : null,
        })),
      );
      setLoading(false);
    })();
  }, [userId]);

  const handlePrepare = (item: UpcomingExam) => {
    if (item.lesson_id) {
      navigate(`/student/lekce/${item.lesson_id}`);
    } else {
      navigate("/student/ulohy");
    }
  };

  return (
    <section className="mb-6 bg-card border border-border rounded-xl p-6" aria-label="Co mě čeká">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-white" />
        </div>
        <h2 className="font-heading text-lg font-semibold">Co mě čeká</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 shrink-0" />
          <p>V příštích 14 dnech tě nečeká žádný test ani zkoušení. Klidná voda. 🌊</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const meta = getExamTypeMeta(item.exam_type);
            const days = item.deadline ? daysUntil(item.deadline) : null;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                >
                  <meta.icon className="w-3.5 h-3.5" />
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.subjectName ? `${item.subjectName} · ` : ""}
                    {days !== null ? daysLabel(days) : "bez termínu"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handlePrepare(item)}>
                  Připravit se
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default UpcomingExamsCard;
