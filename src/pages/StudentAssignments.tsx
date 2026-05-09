import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, CheckCircle2, Play, RotateCcw, Lock, Monitor } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { ExamTypeBadge } from "@/components/assignments/ExamTypeBadge";

interface AssignmentWithAttempt {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  max_attempts: number;
  status: string;
  attempts: {
    id: string;
    attempt_number: number;
    status: string;
    score: number | null;
    max_score: number | null;
    progress: { currentIndex: number; completed: number[] };
  }[];
}

const StudentAssignments = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      // Get published assignments the student can see
      const { data: assignmentsData } = await supabase
        .from("assignments" as any)
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (!assignmentsData) { setAssignments([]); setLoading(false); return; }

      // Get student's attempts
      const { data: attemptsData } = await supabase
        .from("assignment_attempts" as any)
        .select("*")
        .eq("student_id", user.id);

      const attemptsByAssignment: Record<string, any[]> = {};
      (attemptsData as any[] || []).forEach((a: any) => {
        if (!attemptsByAssignment[a.assignment_id]) attemptsByAssignment[a.assignment_id] = [];
        attemptsByAssignment[a.assignment_id].push(a);
      });

      setAssignments((assignmentsData as any[]).map((a: any) => ({
        ...a,
        attempts: (attemptsByAssignment[a.id] || []).sort((x: any, y: any) => x.attempt_number - y.attempt_number),
      })));
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentStatus = (a: AssignmentWithAttempt) => {
    const inProgress = a.attempts.find((att) => att.status === "in_progress");
    if (inProgress) return "in_progress";
    const submitted = a.attempts.filter((att) => att.status === "submitted");
    if (submitted.length >= a.max_attempts) return "completed";
    if (submitted.length > 0 && submitted.length < a.max_attempts) return "can_retry";
    return "not_started";
  };

  const isDeadlinePassed = (deadline: string | null) => deadline ? new Date(deadline) < new Date() : false;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <h1 className="text-2xl font-bold mb-1">Moje úlohy</h1>
        <p className="text-sm text-muted-foreground mb-6">Zadané úlohy a testy</p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Zatím nemáš žádné zadané úlohy.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const status = getAssignmentStatus(a);
              const deadlinePassed = isDeadlinePassed(a.deadline);
              const bestScore = Math.max(...a.attempts.filter((att) => att.score !== null).map((att) => att.score!), 0);
              const bestMaxScore = a.attempts.find((att) => att.max_score !== null)?.max_score || 0;
              const inProgress = a.attempts.find((att) => att.status === "in_progress");

              return (
                <Card key={a.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{a.title}</h3>
                          {status === "completed" && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Hotovo
                            </Badge>
                          )}
                          {status === "in_progress" && (
                            <Badge variant="secondary" className="text-xs">Rozpracováno</Badge>
                          )}
                          {deadlinePassed && (
                            <Badge variant="destructive" className="text-xs">Vypršelo</Badge>
                          )}
                        </div>
                        {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {a.deadline && (
                            <span className={`flex items-center gap-1 ${deadlinePassed ? "text-destructive" : ""}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(a.deadline).toLocaleDateString("cs")}
                            </span>
                          )}
                          <span>
                            {a.attempts.filter((att) => att.status === "submitted").length}/{a.max_attempts} pokusů
                          </span>
                          {bestMaxScore > 0 && (
                            <span className="font-medium">Nejlepší: {bestScore}/{bestMaxScore}</span>
                          )}
                        </div>
                        {inProgress && (
                          <Progress
                            value={inProgress.progress?.completed?.length ? (inProgress.progress.completed.length / (a.max_attempts || 1)) * 100 : 0}
                            className="h-1.5"
                          />
                        )}
                      </div>
                      <div>
                        {status === "in_progress" && !deadlinePassed && (
                          <Button size="sm" onClick={() => navigate(`/student/ulohy/${a.id}`)}>
                            <Play className="w-3.5 h-3.5 mr-1" /> Pokračovat
                          </Button>
                        )}
                        {status === "can_retry" && !deadlinePassed && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/student/ulohy/${a.id}`)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Nový pokus
                          </Button>
                        )}
                        {status === "not_started" && !deadlinePassed && (
                          <Button size="sm" onClick={() => navigate(`/student/ulohy/${a.id}`)}>
                            <Play className="w-3.5 h-3.5 mr-1" /> Začít
                          </Button>
                        )}
                        {(status === "completed" || deadlinePassed) && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/student/ulohy/${a.id}`)}>
                            Zobrazit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentAssignments;
