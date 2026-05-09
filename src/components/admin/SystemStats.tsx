import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Users, GraduationCap, BookOpen, ClipboardList, TrendingUp, Trophy } from "lucide-react";

type TeacherRow = {
  id: string;
  name: string;
  lessonPlans: number;
  assignments: number;
  total: number;
};

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const SystemStats = () => {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ users: 0, activeTeachers: 0, textbooks: 0, assignments: 0 });
  const [registrations, setRegistrations] = useState<{ label: string; count: number }[]>([]);
  const [topTeachers, setTopTeachers] = useState<TeacherRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
          usersRes,
          textbooksRes,
          assignmentsRes,
          regsRes,
          recentLessonPlansRes,
          recentAssignmentsRes,
          teacherRolesRes,
          allLessonPlansRes,
          allAssignmentsRes,
        ] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("teacher_textbooks").select("id", { count: "exact", head: true }),
          supabase.from("assignments").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("created_at").gte("created_at", since30),
          supabase.from("lesson_plans").select("teacher_id").gte("updated_at", since7),
          supabase.from("assignments").select("teacher_id").gte("updated_at", since7),
          supabase.from("user_roles").select("user_id").eq("role", "teacher"),
          supabase.from("lesson_plans").select("teacher_id"),
          supabase.from("assignments").select("teacher_id"),
        ]);

        // Active teachers in 7d (distinct teacher_id in plans/assignments, intersected with role=teacher)
        const teacherIds = new Set((teacherRolesRes.data ?? []).map((r: any) => r.user_id));
        const activeIds = new Set<string>();
        for (const r of (recentLessonPlansRes.data ?? []) as any[]) {
          if (r.teacher_id && teacherIds.has(r.teacher_id)) activeIds.add(r.teacher_id);
        }
        for (const r of (recentAssignmentsRes.data ?? []) as any[]) {
          if (r.teacher_id && teacherIds.has(r.teacher_id)) activeIds.add(r.teacher_id);
        }

        setTotals({
          users: usersRes.count ?? 0,
          activeTeachers: activeIds.size,
          textbooks: textbooksRes.count ?? 0,
          assignments: assignmentsRes.count ?? 0,
        });

        // Registrations over last 30 days
        const days: Record<string, number> = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          days[fmtDate(d)] = 0;
        }
        for (const r of (regsRes.data ?? []) as any[]) {
          const key = fmtDate(new Date(r.created_at));
          if (key in days) days[key] += 1;
        }
        setRegistrations(
          Object.entries(days).map(([date, count]) => ({
            label: new Date(date).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" }),
            count,
          })),
        );

        // Top 10 teachers by lesson_plans + assignments count
        const counts = new Map<string, { lessonPlans: number; assignments: number }>();
        for (const r of (allLessonPlansRes.data ?? []) as any[]) {
          if (!r.teacher_id) continue;
          const c = counts.get(r.teacher_id) ?? { lessonPlans: 0, assignments: 0 };
          c.lessonPlans += 1;
          counts.set(r.teacher_id, c);
        }
        for (const r of (allAssignmentsRes.data ?? []) as any[]) {
          if (!r.teacher_id) continue;
          const c = counts.get(r.teacher_id) ?? { lessonPlans: 0, assignments: 0 };
          c.assignments += 1;
          counts.set(r.teacher_id, c);
        }
        const ranked = [...counts.entries()]
          .map(([id, c]) => ({ id, ...c, total: c.lessonPlans + c.assignments }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        let nameMap: Record<string, string> = {};
        if (ranked.length > 0) {
          const { data: pf } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email")
            .in("id", ranked.map((r) => r.id));
          for (const p of (pf ?? []) as any[]) {
            const full = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            nameMap[p.id] = full || p.email || p.id.slice(0, 8);
          }
        }
        setTopTeachers(ranked.map((r) => ({ ...r, name: nameMap[r.id] ?? r.id.slice(0, 8) })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = useMemo(() => ([
    { label: "Celkem uživatelů", value: totals.users, icon: Users },
    { label: "Aktivní učitelé (7 dní)", value: totals.activeTeachers, icon: GraduationCap },
    { label: "Vytvořených učebnic", value: totals.textbooks, icon: BookOpen },
    { label: "Zadaných úkolů", value: totals.assignments, icon: ClipboardList },
  ]), [totals]);

  if (loading) return <p className="text-muted-foreground">Načítání statistik…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Statistiky systému</h2>
        <p className="text-sm text-muted-foreground mt-1">Přehled aktivity a růstu platformy.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <c.icon className="w-4 h-4" /> {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value.toLocaleString("cs-CZ")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Registrace za posledních 30 dní
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={registrations} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval={Math.max(0, Math.floor(registrations.length / 10) - 1)}
                />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: any) => [`${v} registrací`, "Počet"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Top 10 nejaktivnějších učitelů
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topTeachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím nejsou k dispozici data.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Učitel</TableHead>
                  <TableHead className="text-right">Plány lekcí</TableHead>
                  <TableHead className="text-right">Úkoly</TableHead>
                  <TableHead className="text-right">Celkem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topTeachers.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">{t.lessonPlans}</TableCell>
                    <TableCell className="text-right">{t.assignments}</TableCell>
                    <TableCell className="text-right font-bold">{t.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemStats;
