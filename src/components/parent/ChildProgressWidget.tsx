import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, Target, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  studentIds: string[];
  studentNames: Record<string, string>;
}

interface ChildProgress {
  totalAssignments: number;
  completedAssignments: number;
  avgScorePct: number | null;
  lastActivity: { date: string; title: string } | null;
  daily: { day: string; count: number }[];
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
};

const ChildProgressWidget = ({ studentIds, studentNames }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(studentIds[0] ?? null);
  const [progress, setProgress] = useState<ChildProgress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeId && studentIds[0]) setActiveId(studentIds[0]);
  }, [studentIds, activeId]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Assignments visible (published) for student via class memberships
      const { data: classMems } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", activeId);
      const classIds = (classMems ?? []).map((c: any) => c.class_id);

      let totalAssignments = 0;
      if (classIds.length > 0) {
        const { count } = await supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .in("class_id", classIds);
        totalAssignments = count ?? 0;
      }

      // Attempts (assignment submissions)
      const { data: attempts } = await supabase
        .from("assignment_attempts")
        .select("assignment_id, status, score, max_score, submitted_at, last_saved_at, assignments(title)")
        .eq("student_id", activeId)
        .order("last_saved_at", { ascending: false });

      const submitted = (attempts ?? []).filter(
        (a: any) => a.status === "submitted" || a.status === "graded",
      );
      const uniqueCompleted = new Set(submitted.map((a: any) => a.assignment_id)).size;

      let scoreSum = 0;
      let maxSum = 0;
      submitted.forEach((a: any) => {
        if (a.max_score && a.max_score > 0) {
          scoreSum += a.score ?? 0;
          maxSum += a.max_score;
        }
      });

      // Activity results (worksheet/activity submissions)
      const { data: activityResults } = await supabase
        .from("student_activity_results")
        .select("score, max_score, completed_at")
        .eq("user_id", activeId);

      (activityResults ?? []).forEach((r: any) => {
        if (r.max_score && r.max_score > 0) {
          scoreSum += r.score ?? 0;
          maxSum += r.max_score;
        }
      });

      const avgScorePct = maxSum > 0 ? Math.round((scoreSum / maxSum) * 100) : null;

      // Last activity = newest of attempt or activity_result
      const candidates: { date: string; title: string }[] = [];
      submitted.forEach((a: any) => {
        const date = a.submitted_at ?? a.last_saved_at;
        if (date) candidates.push({ date, title: a.assignments?.title ?? "Úloha" });
      });
      (activityResults ?? []).forEach((r: any) => {
        if (r.completed_at) candidates.push({ date: r.completed_at, title: "Aktivita v lekci" });
      });
      candidates.sort((a, b) => (a.date < b.date ? 1 : -1));
      const lastActivity = candidates[0] ?? null;

      // Daily counts last 30 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days: { day: string; count: number }[] = [];
      const map: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = dayKey(d);
        map[k] = 0;
        days.push({ day: k, count: 0 });
      }
      const bump = (iso: string | null | undefined) => {
        if (!iso) return;
        const k = iso.slice(0, 10);
        if (k in map) map[k] += 1;
      };
      submitted.forEach((a: any) => bump(a.submitted_at ?? a.last_saved_at));
      (activityResults ?? []).forEach((r: any) => bump(r.completed_at));
      days.forEach((d) => (d.count = map[d.day]));

      if (!cancelled) {
        setProgress({
          totalAssignments,
          completedAssignments: Math.min(uniqueCompleted, totalAssignments || uniqueCompleted),
          avgScorePct,
          lastActivity,
          daily: days,
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  const completedRatioPct = useMemo(() => {
    if (!progress || progress.totalAssignments === 0) return 0;
    return Math.round((progress.completedAssignments / progress.totalAssignments) * 100);
  }, [progress]);

  if (studentIds.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-heading text-lg font-bold text-foreground">Pokrok dítěte</h3>
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

      {loading || !progress ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dokončené úkoly</span>
              </div>
              <span className="text-xs font-medium text-foreground">
                {progress.completedAssignments} / {progress.totalAssignments || progress.completedAssignments}
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${completedRatioPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Target className="w-3.5 h-3.5" />
                <span className="text-xs">Průměrné skóre</span>
              </div>
              <p className="font-heading text-xl font-bold text-foreground">
                {progress.avgScorePct !== null ? `${progress.avgScorePct} %` : "—"}
              </p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span className="text-xs">Poslední aktivita</span>
              </div>
              {progress.lastActivity ? (
                <>
                  <p className="font-heading text-sm font-bold text-foreground truncate">
                    {progress.lastActivity.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDate(progress.lastActivity.date)}</p>
                </>
              ) : (
                <p className="font-heading text-sm font-bold text-foreground">—</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
              Aktivita za posledních 30 dní
            </h4>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progress.daily} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    tickFormatter={shortDay}
                    interval={4}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => fmtDate(String(v))}
                    formatter={(value: any) => [`${value}`, "Aktivit"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChildProgressWidget;
