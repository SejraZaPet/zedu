import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Trophy, Flame, Sparkles, BookOpenCheck, BarChart3, Award } from "lucide-react";

type WeekBucket = { label: string; avg: number; count: number };

const StudentProgressWidgets = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(true);

  const [completedLessons, setCompletedLessons] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);

  const [weeklyAvg, setWeeklyAvg] = useState<WeekBucket[]>([]);
  const [monthAvgPct, setMonthAvgPct] = useState<number | null>(null);
  const [bestSubject, setBestSubject] = useState<{ name: string; pct: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      // ---- Lessons progress ----
      const [{ data: completions }, { data: enrollments }, { data: memberships }] = await Promise.all([
        supabase.from("student_lesson_completions").select("lesson_id, completed_at").eq("user_id", userId),
        supabase.from("teacher_textbook_enrollments").select("textbook_id").eq("student_id", userId),
        supabase.from("class_members").select("class_id").eq("user_id", userId),
      ]);

      const tbIds = new Set<string>(((enrollments ?? []) as any[]).map((e) => e.textbook_id));
      const classIds = ((memberships ?? []) as any[]).map((m) => m.class_id);
      if (classIds.length > 0) {
        const { data: ct } = await supabase
          .from("class_textbooks")
          .select("textbook_id, textbook_type")
          .in("class_id", classIds)
          .eq("textbook_type", "teacher");
        for (const r of (ct ?? []) as any[]) tbIds.add(r.textbook_id);
      }
      let total = 0;
      if (tbIds.size > 0) {
        const { count } = await supabase
          .from("teacher_textbook_lessons")
          .select("id", { count: "exact", head: true })
          .in("textbook_id", [...tbIds]);
        total = count ?? 0;
      }
      setCompletedLessons((completions ?? []).length);
      setTotalLessons(total);

      // ---- Streak from practice sessions ----
      const { data: sessions } = await supabase
        .from("student_practice_sessions")
        .select("created_at")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(365);
      const dayKeys = new Set(
        ((sessions ?? []) as any[]).map((s) =>
          new Date(s.created_at).toISOString().slice(0, 10),
        ),
      );
      let s = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // allow streak to start either today or yesterday
      let cursor = new Date(today);
      if (!dayKeys.has(cursor.toISOString().slice(0, 10))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
        s += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      setStreak(s);

      // ---- XP placeholder: 10 XP per completion + 5 per practice session ----
      setXp((completions ?? []).length * 10 + ((sessions ?? []) as any[]).length * 5);

      // ---- Results: assignment attempts ----
      const sinceMonth = new Date();
      sinceMonth.setDate(sinceMonth.getDate() - 30);

      const { data: attempts } = await supabase
        .from("assignment_attempts")
        .select("assignment_id, score, max_score, submitted_at, status")
        .eq("student_id", userId)
        .eq("status", "submitted")
        .gte("submitted_at", sinceMonth.toISOString());

      const valid = ((attempts ?? []) as any[]).filter(
        (a) => a.score != null && a.max_score && a.max_score > 0 && a.submitted_at,
      );
      if (valid.length > 0) {
        const pcts = valid.map((a) => (a.score / a.max_score) * 100);
        setMonthAvgPct(Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length));
      } else {
        setMonthAvgPct(null);
      }

      // Weekly buckets (4 weeks)
      const buckets: WeekBucket[] = [];
      for (let w = 3; w >= 0; w--) {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        end.setDate(end.getDate() - w * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const inWeek = valid.filter((a) => {
          const t = new Date(a.submitted_at).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
        const avg = inWeek.length
          ? Math.round(inWeek.reduce((s, a) => s + (a.score / a.max_score) * 100, 0) / inWeek.length)
          : 0;
        buckets.push({
          label: `${start.getDate()}.${start.getMonth() + 1}.`,
          avg,
          count: inWeek.length,
        });
      }
      setWeeklyAvg(buckets);

      // Best subject (via lesson_plans.subject)
      const asgIds = [...new Set(valid.map((a) => a.assignment_id))];
      if (asgIds.length > 0) {
        const { data: asg } = await supabase
          .from("assignments")
          .select("id, lesson_plan_id")
          .in("id", asgIds);
        const planIds = [...new Set(((asg ?? []) as any[]).map((a) => a.lesson_plan_id).filter(Boolean))];
        let subjectByPlan: Record<string, string> = {};
        if (planIds.length > 0) {
          const { data: lp } = await supabase.from("lesson_plans").select("id, subject").in("id", planIds);
          for (const p of (lp ?? []) as any[]) subjectByPlan[p.id] = p.subject || "";
        }
        const subjectByAsg: Record<string, string> = {};
        for (const a of (asg ?? []) as any[]) {
          const sub = a.lesson_plan_id ? subjectByPlan[a.lesson_plan_id] : "";
          if (sub) subjectByAsg[a.id] = sub;
        }
        const bySubject: Record<string, { sum: number; n: number }> = {};
        for (const a of valid) {
          const sub = subjectByAsg[a.assignment_id];
          if (!sub) continue;
          const pct = (a.score / a.max_score) * 100;
          bySubject[sub] = bySubject[sub] || { sum: 0, n: 0 };
          bySubject[sub].sum += pct;
          bySubject[sub].n += 1;
        }
        const ranked = Object.entries(bySubject)
          .map(([name, v]) => ({ name, pct: Math.round(v.sum / v.n) }))
          .sort((a, b) => b.pct - a.pct);
        setBestSubject(ranked[0] ?? null);
      } else {
        setBestSubject(null);
      }

      setLoading(false);
    })();
  }, [userId]);

  const lessonPct = useMemo(
    () => (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0),
    [completedLessons, totalLessons],
  );

  if (loading) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6">
      {/* Můj pokrok */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Můj pokrok
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpenCheck className="w-4 h-4" /> Dokončené lekce
              </span>
              <span className="font-medium">
                {completedLessons}{totalLessons > 0 ? ` / ${totalLessons}` : ""}
              </span>
            </div>
            <Progress value={lessonPct} />
            {totalLessons === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Připoj se k učebnici, ať můžeme měřit pokrok.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Trophy className="w-3.5 h-3.5 text-primary" /> Celkové XP
              </div>
              <div className="text-2xl font-bold">{xp}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Plná gamifikace už brzy
              </div>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-orange-500/15 to-transparent border border-orange-500/20 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" /> Série
              </div>
              <div className="text-2xl font-bold">
                {streak} <span className="text-sm font-normal text-muted-foreground">{streak === 1 ? "den" : streak >= 2 && streak <= 4 ? "dny" : "dní"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {streak > 0 ? "Skvělá práce, pokračuj!" : "Zkus se učit dnes ✨"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Moje výsledky */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Moje výsledky
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground mb-1">Průměr (30 dní)</div>
              <div className="text-2xl font-bold">
                {monthAvgPct == null ? "—" : `${monthAvgPct}%`}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Award className="w-3.5 h-3.5 text-primary" /> Nejlepší předmět
              </div>
              {bestSubject ? (
                <>
                  <div className="text-base font-semibold truncate">{bestSubject.name}</div>
                  <div className="text-xs text-muted-foreground">{bestSubject.pct}% průměr</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>

          <div className="h-32 w-full">
            <ResponsiveContainer>
              <BarChart data={weeklyAvg} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={(v: any, _n, p: any) => [`${v}% (${p?.payload?.count} úkolů)`, "Průměr"]}
                />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground text-center -mt-1">Průměrné skóre za poslední 4 týdny</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProgressWidgets;
