import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ClassResultsManager from "@/components/admin/ClassResultsManager";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Activity, BarChart3, Clock, AlertTriangle, Users, CheckCircle2, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

type ClassOpt = { id: string; name: string };
type Attempt = {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  started_at: string;
  submitted_at: string | null;
  answers: Record<string, any>;
};
type Assignment = {
  id: string;
  title: string;
  class_id: string | null;
  activity_data: any[];
  lesson_plan_id: string | null;
  subject?: string | null;
};

const ALL = "__all__";

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const TeacherResults = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [subjectFilter, setSubjectFilter] = useState<string>(ALL);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [classMembers, setClassMembers] = useState<{ class_id: string; user_id: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { first_name: string; last_name: string }>>({});

  // Initial load
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Teacher's classes
      const { data: ct } = await supabase
        .from("class_teachers")
        .select("class_id, classes:class_id(id, name)")
        .eq("user_id", uid);
      const classOpts: ClassOpt[] = ((ct ?? []) as any[])
        .map((r) => r.classes)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, name: c.name }));
      setClasses(classOpts);

      // Teacher's assignments + lesson plan subject
      const { data: asg } = await supabase
        .from("assignments")
        .select("id, title, class_id, activity_data, lesson_plan_id")
        .eq("teacher_id", uid);
      let plans: Record<string, string> = {};
      const planIds = [...new Set(((asg ?? []) as any[]).map((a) => a.lesson_plan_id).filter(Boolean))];
      if (planIds.length > 0) {
        const { data: lp } = await supabase.from("lesson_plans").select("id, subject").in("id", planIds);
        for (const p of (lp ?? []) as any[]) plans[p.id] = p.subject || "";
      }
      const enriched: Assignment[] = ((asg ?? []) as any[]).map((a) => ({
        ...a,
        subject: a.lesson_plan_id ? (plans[a.lesson_plan_id] || null) : null,
      }));
      setAssignments(enriched);
      setSubjects([...new Set(enriched.map((a) => a.subject).filter((s): s is string => !!s))].sort());

      // Class members for those classes
      const classIds = classOpts.map((c) => c.id);
      let cmRows: any[] = [];
      if (classIds.length > 0) {
        const { data: cm } = await supabase
          .from("class_members")
          .select("class_id, user_id")
          .in("class_id", classIds);
        cmRows = (cm ?? []) as any[];
        setClassMembers(cmRows as any);
      }

      // Attempts for those assignments
      const asgIds = enriched.map((a) => a.id);
      if (asgIds.length > 0) {
        const { data: at } = await supabase
          .from("assignment_attempts")
          .select("id, assignment_id, student_id, status, score, max_score, started_at, submitted_at, answers")
          .in("assignment_id", asgIds);
        setAttempts((at ?? []) as any);
      }

      // Profiles for student names
      const studentIds = [...new Set(cmRows.map((m: any) => m.user_id))];
      if (studentIds.length > 0) {
        const { data: pf } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", studentIds);
        const map: Record<string, { first_name: string; last_name: string }> = {};
        for (const p of (pf ?? []) as any[]) map[p.id] = { first_name: p.first_name || "", last_name: p.last_name || "" };
        setProfiles(map);
      }
      setLoading(false);
    })().catch((e) => {
      toast({ title: "Chyba načítání", description: e.message, variant: "destructive" });
      setLoading(false);
    });
  }, [toast]);

  // Filtered datasets
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (classFilter !== ALL && a.class_id !== classFilter) return false;
      if (subjectFilter !== ALL && a.subject !== subjectFilter) return false;
      return true;
    });
  }, [assignments, classFilter, subjectFilter]);

  const filteredAsgIds = useMemo(() => new Set(filteredAssignments.map((a) => a.id)), [filteredAssignments]);
  const filteredAttempts = useMemo(
    () => attempts.filter((a) => filteredAsgIds.has(a.assignment_id)),
    [attempts, filteredAsgIds],
  );

  // KPIs
  const kpis = useMemo(() => {
    const submitted = filteredAttempts.filter((a) => a.status === "submitted");

    // Avg time spent (minutes) on submitted attempts
    const durations = submitted
      .filter((a) => a.submitted_at)
      .map((a) => (new Date(a.submitted_at!).getTime() - new Date(a.started_at).getTime()) / 60000)
      .filter((m) => m > 0 && m < 24 * 60);
    const avgMinutes = durations.length
      ? Math.round(durations.reduce((s, x) => s + x, 0) / durations.length)
      : 0;

    // Completion %: submitted distinct (student, assignment) / expected (class members × assignments)
    const expected = filteredAssignments.reduce((sum, a) => {
      if (!a.class_id) return sum;
      const members = classMembers.filter((m) => m.class_id === a.class_id).length;
      return sum + members;
    }, 0);
    const doneSet = new Set(submitted.map((a) => `${a.assignment_id}:${a.student_id}`));
    const completionPct = expected > 0 ? Math.round((doneSet.size / expected) * 100) : 0;

    // Engagement: distinct active students in last 7 days / total students in scope
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeStudents = new Set(
      filteredAttempts
        .filter((a) => new Date(a.started_at).getTime() >= since)
        .map((a) => a.student_id),
    );
    const scopedClassIds = classFilter === ALL
      ? new Set(classes.map((c) => c.id))
      : new Set([classFilter]);
    const totalStudents = new Set(
      classMembers.filter((m) => scopedClassIds.has(m.class_id)).map((m) => m.user_id),
    ).size;
    const engagementPct = totalStudents > 0 ? Math.round((activeStudents.size / totalStudents) * 100) : 0;

    return {
      avgMinutes,
      completionPct,
      engagementPct,
      activeStudents: activeStudents.size,
      totalStudents,
      submittedCount: submitted.length,
    };
  }, [filteredAttempts, filteredAssignments, classMembers, classes, classFilter]);

  // 30-day chart
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days[fmtDate(d)] = 0;
    }
    for (const a of filteredAttempts) {
      if (a.status !== "submitted" || !a.submitted_at) continue;
      const key = fmtDate(new Date(a.submitted_at));
      if (key in days) days[key] += 1;
    }
    return Object.entries(days).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" }),
      count,
    }));
  }, [filteredAttempts]);

  // Top problems: per-question incorrect rate
  const problems = useMemo(() => {
    type Row = { key: string; assignmentTitle: string; question: string; correct: number; total: number };
    const map = new Map<string, Row>();
    for (const a of filteredAssignments) {
      const items = Array.isArray(a.activity_data) ? a.activity_data : [];
      const submitted = filteredAttempts.filter(
        (at) => at.assignment_id === a.id && at.status === "submitted",
      );
      items.forEach((item: any, idx: number) => {
        const qText = String(item?.question || item?.title || item?.prompt || `Otázka ${idx + 1}`).slice(0, 140);
        const key = `${a.id}:${idx}`;
        const row = map.get(key) ?? {
          key,
          assignmentTitle: a.title || "Úkol",
          question: qText,
          correct: 0,
          total: 0,
        };
        for (const at of submitted) {
          const ans = (at.answers as any)?.[idx];
          if (ans === undefined || ans === null || ans === "") continue;
          row.total += 1;
          if (item.type === "mcq" && ans === item.correctIndex) row.correct += 1;
          else if (item.type === "true_false" && ans === item.isTrue) row.correct += 1;
          else if (item.type === "short_answer" && typeof ans === "string" && typeof item.correctAnswer === "string") {
            if (ans.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase()) row.correct += 1;
          }
        }
        if (row.total > 0) map.set(key, row);
      });
    }
    return [...map.values()]
      .map((r) => ({ ...r, successPct: Math.round((r.correct / r.total) * 100) }))
      .sort((a, b) => a.successPct - b.successPct)
      .slice(0, 5);
  }, [filteredAssignments, filteredAttempts]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold">Výsledky a analytika</h1>
          <p className="text-muted-foreground mt-1">
            Přehled aktivity vašich tříd, zapojení žáků a problematické otázky.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Třída</Label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Všechny třídy</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Předmět</Label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Všechny předměty</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-muted-foreground">Načítání…</p>
        ) : (
          <>
            {/* Overview KPIs */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" /> Průměrný čas v lekci
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.avgMinutes} <span className="text-base font-normal text-muted-foreground">min</span></div>
                  <p className="text-xs text-muted-foreground mt-1">{kpis.submittedCount} odevzdaných pokusů</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4" /> Dokončenost úkolů
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.completionPct}%</div>
                  <p className="text-xs text-muted-foreground mt-1">napříč třídami v rozsahu filtru</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" /> Engagement (7 dní)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.engagementPct}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpis.activeStudents} z {kpis.totalStudents} žáků aktivních
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 30-day chart */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Aktivita za posledních 30 dní
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(v: any) => [`${v} odevzdání`, "Počet"]}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top problems */}
            <Card className="mb-10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" /> Největší problémy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {problems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Zatím nejsou k dispozici data o úspěšnosti otázek.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {problems.map((p) => (
                      <li key={p.key} className="border border-border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.assignmentTitle}</p>
                            <p className="font-medium text-sm mt-0.5 truncate">{p.question}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-lg font-bold ${p.successPct < 40 ? "text-destructive" : p.successPct < 70 ? "text-yellow-500" : "text-foreground"}`}>
                              {p.successPct}%
                            </div>
                            <div className="text-xs text-muted-foreground">{p.correct}/{p.total} správně</div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={p.successPct < 40 ? "h-full bg-destructive" : p.successPct < 70 ? "h-full bg-yellow-500" : "h-full bg-primary"}
                            style={{ width: `${p.successPct}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Existing class detail manager */}
        <ClassResultsManager />
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherResults;
