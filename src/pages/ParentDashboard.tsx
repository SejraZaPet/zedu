import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, BookOpen, ClipboardList, CheckCircle2, Clock, Plus, Trash2, KeyRound } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  year: number | null;
  email: string | null;
}

interface StudentStats {
  completedLessons: number;
  totalScore: number;
  totalMaxScore: number;
  assignments: { id: string; title: string; status: string; score: number | null; max_score: number | null }[];
}

const getInitials = (first: string, last: string) =>
  `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "?";

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [stats, setStats] = useState<Record<string, StudentStats>>({});
  const [loading, setLoading] = useState(true);
  const [childCode, setChildCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: links } = await supabase
      .from("parent_student_links" as any)
      .select("student_id")
      .eq("parent_id", user.id);

    const studentIds = ((links as any[]) || []).map((l) => l.student_id);
    if (studentIds.length === 0) {
      setStudents([]);
      setStats({});
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, school, year, email")
      .in("id", studentIds);

    if (profiles) setStudents(profiles as StudentInfo[]);

    const statsMap: Record<string, StudentStats> = {};
    await Promise.all(studentIds.map(async (sid) => {
      const [completionsRes, activityRes, attemptsRes] = await Promise.all([
        supabase.from("student_lesson_completions").select("id").eq("user_id", sid),
        supabase.from("student_activity_results").select("score, max_score").eq("user_id", sid),
        supabase.from("assignment_attempts")
          .select("id, status, score, max_score, assignment_id, assignments(title)")
          .eq("student_id", sid)
          .order("started_at", { ascending: false }),
      ]);

      const totalScore = (activityRes.data ?? []).reduce((s: number, r: any) => s + (r.score ?? 0), 0);
      const totalMaxScore = (activityRes.data ?? []).reduce((s: number, r: any) => s + (r.max_score ?? 0), 0);

      statsMap[sid] = {
        completedLessons: completionsRes.data?.length ?? 0,
        totalScore,
        totalMaxScore,
        assignments: (attemptsRes.data ?? []).map((a: any) => ({
          id: a.id,
          title: a.assignments?.title ?? "Úloha",
          status: a.status,
          score: a.score,
          max_score: a.max_score,
        })),
      };
    }));
    setStats(statsMap);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    loadAll();
  }, [authLoading, user, navigate]);

  const handleLinkChild = async () => {
    if (!user) return;
    const code = childCode.trim().toUpperCase();
    if (!code) return;
    setLinking(true);
    try {
      const { data: matches, error } = await supabase
        .rpc("find_student_by_code" as any, { _code: code });

      if (error) throw error;
      const profile = (matches as any[])?.[0];
      if (!profile) {
        toast({ title: "Žák nenalezen", description: `Kód ${code} neodpovídá žádnému žáku.`, variant: "destructive" });
        return;
      }

      const { error: linkErr } = await supabase
        .from("parent_student_links" as any)
        .insert({ parent_id: user.id, student_id: profile.id });

      if (linkErr) {
        if ((linkErr as any).code === "23505") {
          toast({ title: "Již propojeno", description: "Toto dítě již máte ve svém přehledu." });
        } else {
          throw linkErr;
        }
      } else {
        toast({ title: "Dítě přidáno", description: `${profile.first_name} ${profile.last_name} byl propojen s vaším účtem.` });
      }
      setChildCode("");
      setAddOpen(false);
      await loadAll();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkChild = async (studentId: string) => {
    if (!user) return;
    if (!confirm("Opravdu odebrat dítě z vašeho přehledu?")) return;
    const { error } = await supabase
      .from("parent_student_links" as any)
      .delete()
      .eq("parent_id", user.id)
      .eq("student_id", studentId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Odebráno" });
      await loadAll();
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
          <p className="text-muted-foreground">Načítání...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
              Rodičovský přehled 👨‍👩‍👧
            </h1>
            <p className="text-muted-foreground">
              Sledujte výsledky a pokrok vašeho dítěte (pouze náhled)
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Přidat dítě
          </Button>
        </div>

        {students.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Žádné propojené dítě
            </h2>
            <p className="text-muted-foreground mb-4">
              Klikněte na „Přidat dítě" a zadejte kód žáka (ZAK-XXXX), který obdržíte od školy.
            </p>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Přidat dítě
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {students.map((student) => {
              const s = stats[student.id];
              const successPct = s && s.totalMaxScore > 0
                ? Math.round((s.totalScore / s.totalMaxScore) * 100)
                : null;
              const hasOwnEmail = !!(student.email && !student.email.endsWith("@zedu-student.cz"));
              return (
                <div key={student.id} className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-heading font-semibold text-primary">
                        {getInitials(student.first_name, student.last_name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-lg font-bold text-foreground truncate">
                        {student.first_name} {student.last_name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {student.school || "—"} · {student.year ? `${student.year}. ročník` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span className="text-xs">Lekce</span>
                      </div>
                      <p className="font-heading text-xl font-bold text-foreground">
                        {s?.completedLessons ?? 0}
                      </p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs">Úspěšnost</span>
                      </div>
                      <p className="font-heading text-xl font-bold text-foreground">
                        {successPct !== null ? `${successPct} %` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Zadané úlohy
                      </h4>
                    </div>
                    {!s?.assignments?.length ? (
                      <p className="text-sm text-muted-foreground">Žádné úlohy.</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                        {s.assignments.slice(0, 4).map((a) => {
                          const isDone = a.status === "submitted" || a.status === "graded";
                          return (
                            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-card">
                              <div className="flex items-center gap-2 min-w-0">
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-xs text-foreground truncate">{a.title}</span>
                              </div>
                              <div className="text-xs text-muted-foreground shrink-0">
                                {isDone
                                  ? (a.max_score ? `${a.score ?? 0}/${a.max_score}` : "✓")
                                  : a.status === "in_progress" ? "…" : "—"}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                    {!hasOwnEmail ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          if (!confirm(`Resetovat heslo pro ${student.first_name} ${student.last_name}?`)) return;
                          const { data, error } = await supabase.functions.invoke("parent-reset-child-password", {
                            body: { childId: student.id },
                          });
                          if (error || !data?.newPassword) {
                            toast({
                              title: "Chyba",
                              description: error?.message || data?.error || "Nepodařilo se resetovat heslo.",
                              variant: "destructive",
                            });
                          } else {
                            toast({
                              title: "Heslo resetováno",
                              description: `Nové heslo: ${data.newPassword}`,
                              duration: 15000,
                            });
                          }
                        }}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Resetovat heslo
                      </Button>
                    ) : <span />}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlinkChild(student.id)}
                      className="text-red-500 hover:bg-red-500/10 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Odebrat
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat dítě</DialogTitle>
            <DialogDescription>
              Zadejte kód žáka (formát ZAK-XXXX), který obdržíte od školy.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={childCode}
              onChange={(e) => setChildCode(e.target.value.toUpperCase())}
              placeholder="ZAK-AB12"
              className="font-mono uppercase"
              onKeyDown={(e) => { if (e.key === "Enter") handleLinkChild(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Zrušit</Button>
            <Button onClick={handleLinkChild} disabled={linking || !childCode.trim()}>
              {linking ? "Přidávám…" : "Přidat dítě"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default ParentDashboard;
