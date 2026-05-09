import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Users, Clock, CheckCircle2, AlertCircle, Minus, BarChart3, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

type StudentStatus = "not_started" | "in_progress" | "submitted";

interface StudentResult {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: StudentStatus;
  attemptCount: number;
  bestScore: number | null;
  maxScore: number | null;
  lastActivity: string | null;
  violationCount: number;
  leftTest: boolean;
}

interface AssignmentSummary {
  id: string;
  title: string;
  deadline: string | null;
  classId: string | null;
  className: string | null;
  maxAttempts: number;
  totalStudents: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  avgScore: number | null;
}

interface Props {
  teacherId: string;
}

const STATUS_CONFIG: Record<StudentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  not_started: { label: "Nezahájeno", icon: Minus, className: "bg-muted text-muted-foreground" },
  in_progress: { label: "Rozpracováno", icon: AlertCircle, className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  submitted: { label: "Dokončeno", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

const AssignmentResultsDashboard = ({ teacherId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterDeadline, setFilterDeadline] = useState<string>("all"); // all | upcoming | past
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedAssignmentId) loadStudentResults(selectedAssignmentId);
  }, [selectedAssignmentId]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, classesRes] = await Promise.all([
        supabase.from("assignments" as any).select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false }),
        supabase.from("classes").select("id, name").eq("archived", false),
      ]);

      if (classesRes.data) setClasses(classesRes.data);

      const assignmentList = (assignmentsRes.data as any[] || []);
      if (assignmentList.length === 0) { setAssignments([]); setLoading(false); return; }

      // Fetch all attempts for these assignments
      const ids = assignmentList.map((a: any) => a.id);
      const { data: attemptsData } = await supabase
        .from("assignment_attempts" as any)
        .select("*")
        .in("assignment_id", ids);

      const attemptsByAssignment: Record<string, any[]> = {};
      (attemptsData as any[] || []).forEach((att: any) => {
        if (!attemptsByAssignment[att.assignment_id]) attemptsByAssignment[att.assignment_id] = [];
        attemptsByAssignment[att.assignment_id].push(att);
      });

      // Get class members for student counts
      const classIds = [...new Set(assignmentList.filter((a: any) => a.class_id).map((a: any) => a.class_id))];
      let membersByClass: Record<string, number> = {};
      if (classIds.length > 0) {
        const { data: members } = await supabase
          .from("class_members")
          .select("class_id")
          .in("class_id", classIds);
        (members || []).forEach((m: any) => {
          membersByClass[m.class_id] = (membersByClass[m.class_id] || 0) + 1;
        });
      }

      const classNameMap: Record<string, string> = {};
      (classesRes.data || []).forEach((c: any) => { classNameMap[c.id] = c.name; });

      const summaries: AssignmentSummary[] = assignmentList.map((a: any) => {
        const attempts = attemptsByAssignment[a.id] || [];
        const uniqueStudents = new Set(attempts.map((att: any) => att.student_id));
        const totalStudents = a.class_id ? (membersByClass[a.class_id] || 0) : uniqueStudents.size;
        const submittedStudents = new Set(attempts.filter((att: any) => att.status === "submitted").map((att: any) => att.student_id));
        const inProgressStudents = new Set(
          attempts.filter((att: any) => att.status === "in_progress").map((att: any) => att.student_id)
        );
        // Remove from inProgress those who also submitted
        submittedStudents.forEach((s) => inProgressStudents.delete(s));

        const scores = attempts.filter((att: any) => att.score !== null).map((att: any) => att.score as number);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;

        return {
          id: a.id,
          title: a.title,
          deadline: a.deadline,
          classId: a.class_id,
          className: a.class_id ? (classNameMap[a.class_id] || "–") : null,
          maxAttempts: a.max_attempts,
          totalStudents,
          notStarted: Math.max(0, totalStudents - submittedStudents.size - inProgressStudents.size),
          inProgress: inProgressStudents.size,
          submitted: submittedStudents.size,
          avgScore,
        };
      });

      setAssignments(summaries);
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadStudentResults = async (assignmentId: string) => {
    setDetailLoading(true);
    try {
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) return;

      // Get students: either class members or all who attempted
      let studentIds: string[] = [];

      if (assignment.classId) {
        const { data: members } = await supabase
          .from("class_members")
          .select("user_id")
          .eq("class_id", assignment.classId);
        studentIds = (members || []).map((m: any) => m.user_id);
      }

      // Get attempts
      const { data: attempts } = await supabase
        .from("assignment_attempts" as any)
        .select("*")
        .eq("assignment_id", assignmentId);

      // Get test sessions (lockdown violations)
      const { data: tsData } = await supabase
        .from("test_sessions" as any)
        .select("student_id, violation_count, left_test")
        .eq("assignment_id", assignmentId);
      const tsByStudent: Record<string, { count: number; left: boolean }> = {};
      (tsData as any[] || []).forEach((t: any) => {
        const cur = tsByStudent[t.student_id] || { count: 0, left: false };
        tsByStudent[t.student_id] = {
          count: cur.count + (t.violation_count || 0),
          left: cur.left || !!t.left_test,
        };
      });

      const attemptsByStudent: Record<string, any[]> = {};
      (attempts as any[] || []).forEach((att: any) => {
        if (!attemptsByStudent[att.student_id]) attemptsByStudent[att.student_id] = [];
        attemptsByStudent[att.student_id].push(att);
        if (!studentIds.includes(att.student_id)) studentIds.push(att.student_id);
      });

      if (studentIds.length === 0) { setStudents([]); setDetailLoading(false); return; }

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", studentIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      const results: StudentResult[] = studentIds.map((sid) => {
        const profile = profileMap[sid] || {};
        const atts = attemptsByStudent[sid] || [];
        const submitted = atts.filter((a: any) => a.status === "submitted");
        const inProg = atts.find((a: any) => a.status === "in_progress");

        let status: StudentStatus = "not_started";
        if (submitted.length > 0) status = "submitted";
        else if (inProg) status = "in_progress";

        const scores = submitted.filter((a: any) => a.score !== null).map((a: any) => a.score as number);
        const bestScore = scores.length > 0 ? Math.max(...scores) : null;
        const maxScore = submitted.find((a: any) => a.max_score !== null)?.max_score ?? null;

        const allDates = atts.map((a: any) => a.submitted_at || a.last_saved_at).filter(Boolean);
        const lastActivity = allDates.length > 0 ? allDates.sort().reverse()[0] : null;

        const ts = tsByStudent[sid] || { count: 0, left: false };

        return {
          studentId: sid,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: profile.email || "",
          status,
          attemptCount: atts.length,
          bestScore,
          maxScore,
          lastActivity,
          violationCount: ts.count,
          leftTest: ts.left,
        };
      });

      setStudents(results.sort((a, b) => a.lastName.localeCompare(b.lastName, "cs")));
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterClassId !== "all" && a.classId !== filterClassId) return false;
      if (filterDeadline === "upcoming" && (!a.deadline || new Date(a.deadline) < new Date())) return false;
      if (filterDeadline === "past" && (!a.deadline || new Date(a.deadline) >= new Date())) return false;
      return true;
    });
  }, [assignments, filterClassId, filterDeadline]);

  // Filter students
  const filteredStudents = useMemo(() => {
    if (filterStatus === "all") return students;
    return students.filter((s) => s.status === filterStatus);
  }, [students, filterStatus]);

  // CSV export
  const exportCSV = () => {
    const selected = assignments.find((a) => a.id === selectedAssignmentId);
    if (!selected || filteredStudents.length === 0) return;

    const headers = ["Příjmení", "Jméno", "E-mail", "Stav", "Pokusů", "Nejlepší skóre", "Max skóre", "Poslední aktivita"];
    const rows = filteredStudents.map((s) => [
      s.lastName,
      s.firstName,
      s.email,
      STATUS_CONFIG[s.status].label,
      String(s.attemptCount),
      s.bestScore !== null ? String(s.bestScore) : "–",
      s.maxScore !== null ? String(s.maxScore) : "–",
      s.lastActivity ? format(new Date(s.lastActivity), "d.M.yyyy HH:mm", { locale: cs }) : "–",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vysledky-${selected.title.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportováno", description: `${filteredStudents.length} řádků` });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          Filtry:
        </div>
        <Select value={filterClassId} onValueChange={setFilterClassId}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Třída" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny třídy</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDeadline} onValueChange={setFilterDeadline}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Termín" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny termíny</SelectItem>
            <SelectItem value="upcoming">Nadcházející</SelectItem>
            <SelectItem value="past">Uplynulé</SelectItem>
          </SelectContent>
        </Select>

        {selectedAssignmentId && (
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Stav žáka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="not_started">Nezahájeno</SelectItem>
              <SelectItem value="in_progress">Rozpracováno</SelectItem>
              <SelectItem value="submitted">Dokončeno</SelectItem>
            </SelectContent>
          </Select>
        )}

        {selectedAssignmentId && filteredStudents.length > 0 && (
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Assignment overview cards */}
      {!selectedAssignmentId && (
        <>
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Žádné úlohy odpovídající filtru.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredAssignments.map((a) => {
                const total = a.totalStudents || 1;
                const completionPct = Math.round((a.submitted / total) * 100);
                const deadlinePassed = a.deadline ? new Date(a.deadline) < new Date() : false;

                return (
                  <Card
                    key={a.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedAssignmentId(a.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-sm">{a.title}</h3>
                        {a.className && <Badge variant="outline" className="text-[10px]">{a.className}</Badge>}
                      </div>

                      {a.deadline && (
                        <div className={`flex items-center gap-1 text-xs ${deadlinePassed ? "text-destructive" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />
                          {deadlinePassed ? "Vypršelo " : ""}
                          {format(new Date(a.deadline), "d. M. yyyy", { locale: cs })}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{a.submitted}/{a.totalStudents} dokončeno</span>
                          <span>{completionPct}%</span>
                        </div>
                        <Progress value={completionPct} className="h-1.5" />
                      </div>

                      <div className="flex gap-2">
                        <Badge className={STATUS_CONFIG.not_started.className + " text-[10px]"}>
                          {a.notStarted} nezahájilo
                        </Badge>
                        <Badge className={STATUS_CONFIG.in_progress.className + " text-[10px]"}>
                          {a.inProgress} rozpracováno
                        </Badge>
                        <Badge className={STATUS_CONFIG.submitted.className + " text-[10px]"}>
                          {a.submitted} hotovo
                        </Badge>
                      </div>

                      {a.avgScore !== null && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BarChart3 className="w-3 h-3" />
                          Ø skóre: {a.avgScore}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Student detail table */}
      {selectedAssignmentId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" onClick={() => { setSelectedAssignmentId(""); setFilterStatus("all"); }}>
              ← Zpět na přehled
            </Button>
            <h3 className="font-semibold text-sm">
              {assignments.find((a) => a.id === selectedAssignmentId)?.title}
            </h3>
          </div>

          {/* Summary stats */}
          {(() => {
            const a = assignments.find((x) => x.id === selectedAssignmentId);
            if (!a) return null;
            return (
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{a.notStarted}</div>
                    <div className="text-xs text-muted-foreground">Nezahájilo</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">{a.inProgress}</div>
                    <div className="text-xs text-muted-foreground">Rozpracováno</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{a.submitted}</div>
                    <div className="text-xs text-muted-foreground">Dokončeno</div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Žádní žáci pro tento filtr.</div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Žák</TableHead>
                    <TableHead className="text-xs">Stav</TableHead>
                    <TableHead className="text-xs text-center">Pokusů</TableHead>
                    <TableHead className="text-xs text-center">Skóre</TableHead>
                    <TableHead className="text-xs">Poslední aktivita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => {
                    const cfg = STATUS_CONFIG[s.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow key={s.studentId}>
                        <TableCell className="text-sm">
                          <div>
                            <span className="font-medium">{s.lastName} {s.firstName}</span>
                            <span className="block text-xs text-muted-foreground">{s.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cfg.className + " text-[10px]"}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{s.attemptCount}</TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {s.bestScore !== null ? `${s.bestScore}/${s.maxScore || "?"}` : "–"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.lastActivity ? format(new Date(s.lastActivity), "d.M. HH:mm", { locale: cs }) : "–"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignmentResultsDashboard;
