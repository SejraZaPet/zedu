import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, ArrowLeft, Users, Activity, BookOpen, Clock } from "lucide-react";

interface ClassOverview {
  id: string;
  name: string;
  school: string;
  field_of_study: string;
  year: number | null;
  student_count: number;
  active_students: number;
  avg_success: number;
  total_lessons: number;
  total_activities: number;
  last_activity: string | null;
}

interface StudentDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  activity_count: number;
  lesson_count: number;
  avg_success: number;
  last_activity: string | null;
}

const ClassResultsManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassOverview | null>(null);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);

    // Get non-archived classes
    const { data: classesData, error } = await supabase
      .from("classes")
      .select("id, name, school, field_of_study, year")
      .eq("archived", false)
      .order("name");

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get all class members
    const { data: members } = await supabase.from("class_members").select("class_id, user_id");

    // Get all activity results
    const { data: activityResults } = await supabase
      .from("student_activity_results")
      .select("user_id, score, max_score, completed_at");

    // Get all lesson completions
    const { data: lessonCompletions } = await supabase
      .from("student_lesson_completions")
      .select("user_id, completed_at");

    // Build maps
    const classMembersMap = new Map<string, Set<string>>();
    members?.forEach((m: any) => {
      if (!classMembersMap.has(m.class_id)) classMembersMap.set(m.class_id, new Set());
      classMembersMap.get(m.class_id)!.add(m.user_id);
    });

    const userActivities = new Map<string, { count: number; totalScore: number; totalMax: number; lastAt: string | null }>();
    activityResults?.forEach((r: any) => {
      const entry = userActivities.get(r.user_id) || { count: 0, totalScore: 0, totalMax: 0, lastAt: null };
      entry.count++;
      entry.totalScore += r.score;
      entry.totalMax += r.max_score;
      if (!entry.lastAt || r.completed_at > entry.lastAt) entry.lastAt = r.completed_at;
      userActivities.set(r.user_id, entry);
    });

    const userLessons = new Map<string, { count: number; lastAt: string | null }>();
    lessonCompletions?.forEach((l: any) => {
      const entry = userLessons.get(l.user_id) || { count: 0, lastAt: null };
      entry.count++;
      if (!entry.lastAt || l.completed_at > entry.lastAt) entry.lastAt = l.completed_at;
      userLessons.set(l.user_id, entry);
    });

    const enriched: ClassOverview[] = (classesData ?? []).map((c: any) => {
      const memberIds = classMembersMap.get(c.id) || new Set<string>();
      let totalScore = 0, totalMax = 0, totalActivities = 0, totalLessons = 0;
      let activeStudents = 0;
      let lastActivity: string | null = null;

      memberIds.forEach((uid) => {
        const act = userActivities.get(uid);
        const les = userLessons.get(uid);
        if (act || les) activeStudents++;
        if (act) {
          totalActivities += act.count;
          totalScore += act.totalScore;
          totalMax += act.totalMax;
          if (!lastActivity || (act.lastAt && act.lastAt > lastActivity)) lastActivity = act.lastAt;
        }
        if (les) {
          totalLessons += les.count;
          if (!lastActivity || (les.lastAt && les.lastAt > lastActivity)) lastActivity = les.lastAt;
        }
      });

      return {
        ...c,
        student_count: memberIds.size,
        active_students: activeStudents,
        avg_success: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
        total_lessons: totalLessons,
        total_activities: totalActivities,
        last_activity: lastActivity,
      };
    });

    setClasses(enriched);
    setLoading(false);
  };

  const fetchClassDetail = async (classId: string) => {
    setDetailLoading(true);

    const { data: memberLinks } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId);

    const memberIds = memberLinks?.map((m: any) => m.user_id) ?? [];
    if (memberIds.length === 0) {
      setStudents([]);
      setDetailLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", memberIds);

    const { data: activityResults } = await supabase
      .from("student_activity_results")
      .select("user_id, score, max_score, completed_at")
      .in("user_id", memberIds);

    const { data: lessonCompletions } = await supabase
      .from("student_lesson_completions")
      .select("user_id, completed_at")
      .in("user_id", memberIds);

    const userActs = new Map<string, { count: number; totalScore: number; totalMax: number; lastAt: string | null }>();
    activityResults?.forEach((r: any) => {
      const e = userActs.get(r.user_id) || { count: 0, totalScore: 0, totalMax: 0, lastAt: null };
      e.count++;
      e.totalScore += r.score;
      e.totalMax += r.max_score;
      if (!e.lastAt || r.completed_at > e.lastAt) e.lastAt = r.completed_at;
      userActs.set(r.user_id, e);
    });

    const userLes = new Map<string, number>();
    lessonCompletions?.forEach((l: any) => {
      userLes.set(l.user_id, (userLes.get(l.user_id) || 0) + 1);
    });

    const studentDetails: StudentDetail[] = (profiles ?? []).map((p: any) => {
      const act = userActs.get(p.id);
      return {
        ...p,
        activity_count: act?.count || 0,
        lesson_count: userLes.get(p.id) || 0,
        avg_success: act && act.totalMax > 0 ? Math.round((act.totalScore / act.totalMax) * 100) : 0,
        last_activity: act?.lastAt || null,
      };
    });

    studentDetails.sort((a, b) => b.avg_success - a.avg_success);
    setStudents(studentDetails);
    setDetailLoading(false);
  };

  useEffect(() => { fetchOverview(); }, []);

  useEffect(() => {
    if (selectedClass) fetchClassDetail(selectedClass.id);
  }, [selectedClass]);

  const filtered = useMemo(() => {
    if (!search) return classes;
    const s = search.toLowerCase();
    return classes.filter((c) => `${c.name} ${c.school} ${c.field_of_study}`.toLowerCase().includes(s));
  }, [classes, search]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

  const successColor = (pct: number) =>
    pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : pct > 0 ? "text-red-400" : "text-muted-foreground";

  if (loading) return <div className="text-muted-foreground p-4">Načítání výsledků...</div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Hledat třídu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Třída</TableHead>
              <TableHead className="text-center">Studenti</TableHead>
              <TableHead className="text-center">Aktivní</TableHead>
              <TableHead className="text-center">Ø Úspěšnost</TableHead>
              <TableHead className="text-center">Lekce</TableHead>
              <TableHead className="text-center">Aktivity</TableHead>
              <TableHead>Poslední aktivita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedClass(c)}>
                <TableCell>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.school, c.field_of_study, c.year ? `${c.year}. ročník` : null].filter(Boolean).join(" · ") || "–"}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />{c.student_count}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-sm">{c.active_students}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${successColor(c.avg_success)}`}>
                    {c.avg_success > 0 ? `${c.avg_success} %` : "–"}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{c.total_lessons || "–"}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{c.total_activities || "–"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.last_activity)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Žádné třídy s výsledky.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => setSelectedClass(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              Výsledky – {selectedClass?.name}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-muted-foreground text-sm py-4">Načítání...</p>
          ) : (
            <div className="flex flex-col gap-3 overflow-hidden">
              {/* Summary badges */}
              {selectedClass && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4" /> {selectedClass.student_count} studentů
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Activity className="w-4 h-4" /> {selectedClass.total_activities} aktivit
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BookOpen className="w-4 h-4" /> {selectedClass.total_lessons} lekcí
                  </div>
                  <div className={`flex items-center gap-1.5 ${successColor(selectedClass.avg_success)}`}>
                    Ø {selectedClass.avg_success > 0 ? `${selectedClass.avg_success} %` : "–"}
                  </div>
                </div>
              )}

              {/* Students table */}
              <div className="overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-center">Úspěšnost</TableHead>
                      <TableHead className="text-center">Aktivity</TableHead>
                      <TableHead className="text-center">Lekce</TableHead>
                      <TableHead>Poslední aktivita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${successColor(s.avg_success)}`}>
                            {s.avg_success > 0 ? `${s.avg_success} %` : "–"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{s.activity_count || "–"}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{s.lesson_count || "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.last_activity)}</TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Žádní studenti v této třídě.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassResultsManager;
