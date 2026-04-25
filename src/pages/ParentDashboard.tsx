import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, BookOpen, ClipboardList, CheckCircle2, Clock, Plus, Settings, Trash2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  year: number | null;
}

interface StudentStats {
  completedLessons: number;
  totalScore: number;
  totalMaxScore: number;
  assignments: { id: string; title: string; status: string; score: number | null; max_score: number | null }[];
}

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [stats, setStats] = useState<Record<string, StudentStats>>({});
  const [loading, setLoading] = useState(true);
  const [childCode, setChildCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [parentEmail, setParentEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

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
      .select("id, first_name, last_name, school, year")
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

    // Load own profile to get parent_email
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("parent_email")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.parent_email) setParentEmail(prof.parent_email);
    })();

    loadAll();
  }, [authLoading, user, navigate]);

  const handleLinkChild = async () => {
    if (!user) return;
    const code = childCode.trim().toUpperCase();
    if (!code) return;
    setLinking(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("student_code", code)
        .maybeSingle();

      if (error) throw error;
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
      await loadAll();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!user) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ parent_email: parentEmail.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
      toast({
        title: "Email uložen",
        description: "Pro obnovu hesla použijte funkci Zapomenuté heslo na přihlašovací stránce.",
        duration: 8000,
      });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSavingEmail(false);
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
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            Rodičovský přehled 👨‍👩‍👧
          </h1>
          <p className="text-muted-foreground">
            Sledujte výsledky a pokrok vašeho dítěte (pouze náhled)
          </p>
        </div>

        {/* Add child */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Přidat dítě</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Zadejte kód žáka (formát ZAK-XXXX), který obdržíte od školy.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={childCode}
              onChange={(e) => setChildCode(e.target.value.toUpperCase())}
              placeholder="ZAK-AB12"
              className="font-mono uppercase max-w-xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleLinkChild(); }}
            />
            <Button onClick={handleLinkChild} disabled={linking || !childCode.trim()}>
              {linking ? "Přidávám…" : "Přidat dítě"}
            </Button>
          </div>
        </div>

        {/* Account settings */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Nastavení účtu</h2>
          </div>
          <Label className="text-sm">Přidat email pro obnovu hesla</Label>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="vas@email.cz"
              className="max-w-xs"
            />
            <Button onClick={handleSaveEmail} disabled={savingEmail} variant="outline">
              {savingEmail ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Pro obnovu hesla použijte funkci „Zapomenuté heslo" na přihlašovací stránce.
          </p>
        </div>

        {students.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Žádné propojené dítě
            </h2>
            <p className="text-muted-foreground">
              Použijte formulář výše a zadejte kód žáka, nebo kontaktujte školu.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {students.map((student) => {
              const s = stats[student.id];
              const successPct = s && s.totalMaxScore > 0
                ? Math.round((s.totalScore / s.totalMaxScore) * 100)
                : null;
              return (
                <div key={student.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading text-xl font-semibold text-foreground">
                        {student.first_name} {student.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {student.school || "—"} · {student.year ? `${student.year}. ročník` : "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlinkChild(student.id)}
                      className="text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-muted/40 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-sm">Dokončené lekce</span>
                      </div>
                      <p className="font-heading text-2xl font-bold text-foreground">
                        {s?.completedLessons ?? 0}
                      </p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Úspěšnost v aktivitách</span>
                      </div>
                      <p className="font-heading text-2xl font-bold text-foreground">
                        {successPct !== null ? `${successPct} %` : "—"}
                      </p>
                      {s && s.totalMaxScore > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.totalScore} / {s.totalMaxScore} bodů
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wide">
                        Zadané úlohy
                      </h4>
                    </div>
                    {!s?.assignments?.length ? (
                      <p className="text-sm text-muted-foreground">Žádné úlohy.</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                        {s.assignments.map((a) => {
                          const isDone = a.status === "submitted" || a.status === "graded";
                          return (
                            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-card">
                              <div className="flex items-center gap-3 min-w-0">
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                ) : (
                                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-sm text-foreground truncate">{a.title}</span>
                              </div>
                              <div className="text-sm text-muted-foreground shrink-0">
                                {isDone
                                  ? (a.max_score ? `${a.score ?? 0} / ${a.max_score}` : "Odevzdáno")
                                  : a.status === "in_progress" ? "Rozpracováno" : "Nezahájeno"}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default ParentDashboard;
