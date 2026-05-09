import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, BookOpen, ListChecks, Sparkles, MapPin, Timer,
  NotebookPen, ArrowRightCircle, GraduationCap, Play, ChevronLeft, ChevronRight, CheckCircle2,
} from "lucide-react";

type Method = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  steps_json: { name: string; description: string }[] | null;
};

type LessonOption = { id: string; title: string; textbook: string };

const ICONS: Record<string, React.ElementType> = {
  Brain, BookOpen, ListChecks, Sparkles, MapPin, Timer, NotebookPen, ArrowRightCircle,
};

const StudentMethods = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [methods, setMethods] = useState<Method[]>([]);
  const [preferredIds, setPreferredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Method | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [practiceFor, setPracticeFor] = useState<Method | null>(null);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string>("none");
  const [duration, setDuration] = useState<string>("15");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("study_methods")
        .select("id, name, slug, description, icon, steps_json")
        .order("name");
      if (error) {
        toast({ title: "Chyba načítání", description: error.message, variant: "destructive" });
      } else {
        setMethods((data ?? []) as any);
      }
      setLoading(false);
    })();
  }, [toast]);

  useEffect(() => {
    if (!practiceFor) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      // Teacher textbooks via enrollment
      const { data: enrollData } = await supabase
        .from("teacher_textbook_enrollments")
        .select("textbook_id, teacher_textbooks(id, title)")
        .eq("student_id", userId);

      // Teacher textbooks via class membership
      const { data: memberships } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", userId);
      const classIds = (memberships ?? []).map((m: any) => m.class_id);
      let classTeacherBooks: any[] = [];
      if (classIds.length > 0) {
        const { data } = await supabase
          .from("class_textbooks")
          .select("textbook_id, textbook_type")
          .in("class_id", classIds)
          .eq("textbook_type", "teacher");
        classTeacherBooks = data ?? [];
      }

      const tbIds = new Set<string>([
        ...(enrollData ?? []).map((e: any) => e.textbook_id),
        ...classTeacherBooks.map((c: any) => c.textbook_id),
      ]);
      const tbTitleById = new Map<string, string>();
      for (const e of (enrollData ?? []) as any[]) {
        if (e.teacher_textbooks?.title) tbTitleById.set(e.textbook_id, e.teacher_textbooks.title);
      }
      const missingTitles = [...tbIds].filter((id) => !tbTitleById.has(id));
      if (missingTitles.length > 0) {
        const { data: tbs } = await supabase
          .from("teacher_textbooks")
          .select("id, title")
          .in("id", missingTitles);
        for (const t of (tbs ?? []) as any[]) tbTitleById.set(t.id, t.title);
      }

      if (tbIds.size === 0) {
        setLessons([]);
        return;
      }
      const { data: lessonsData } = await supabase
        .from("teacher_textbook_lessons")
        .select("id, title, textbook_id")
        .in("textbook_id", [...tbIds])
        .order("title");
      setLessons(
        ((lessonsData ?? []) as any[]).map((l) => ({
          id: l.id,
          title: l.title,
          textbook: tbTitleById.get(l.textbook_id) ?? "",
        })),
      );
    })();
  }, [practiceFor]);

  const openDetail = (m: Method) => {
    setDetail(m);
    setStepIdx(0);
  };

  const startPractice = () => {
    if (!practiceFor) return;
    const lessonParam = selectedLesson !== "none" ? `?lesson=${selectedLesson}` : "";
    navigate(`/student/metody/${practiceFor.slug}/procviceni${lessonParam}`);
    setPracticeFor(null);
    setSelectedLesson("none");
    setDuration("15");
  };

  const detailSteps = useMemo(() => detail?.steps_json ?? [], [detail]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <GraduationCap className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Studijní metody</span>
          </div>
          <h1 className="font-heading text-3xl font-bold">Jak se učit chytře</h1>
          <p className="text-muted-foreground mt-1">
            Vyber si metodu, podívej se na návod a hned ji vyzkoušej na lekci z učebnice.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {methods.map((m) => {
              const Icon = (m.icon && ICONS[m.icon]) || Brain;
              return (
                <button
                  key={m.id}
                  onClick={() => openDetail(m)}
                  className="text-left bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/40 transition-all flex flex-col"
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg mb-1">{m.name}</h3>
                  {m.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{m.description}</p>
                  )}
                  <span className="mt-3 text-sm font-medium text-primary">Zobrazit návod →</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />

      {/* Step-by-step detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          {detail && (() => {
            const Icon = (detail.icon && ICONS[detail.icon]) || Brain;
            const total = detailSteps.length;
            const step = detailSteps[stepIdx];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle>{detail.name}</DialogTitle>
                      {detail.description && (
                        <DialogDescription className="mt-1">{detail.description}</DialogDescription>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                {total > 0 && step && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Krok {stepIdx + 1} z {total}
                      </span>
                      <div className="flex gap-1">
                        {detailSteps.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-6 rounded-full transition-colors ${
                              i <= stepIdx ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                          {stepIdx + 1}
                        </div>
                        <div>
                          <h4 className="font-heading font-semibold text-lg mb-1">{step.name}</h4>
                          <p className="text-sm text-foreground/80">{step.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                        disabled={stepIdx === 0}
                        className="gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" /> Zpět
                      </Button>
                      {stepIdx < total - 1 ? (
                        <Button onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))} className="gap-2">
                          Další <ChevronRight className="w-4 h-4" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-primary font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Hotovo
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <DialogFooter className="mt-4">
                  <Button variant="ghost" onClick={() => setDetail(null)}>Zavřít</Button>
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setPracticeFor(detail);
                      setDetail(null);
                    }}
                  >
                    <Play className="w-4 h-4" /> Procvičit
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Practice setup */}
      <Dialog open={!!practiceFor} onOpenChange={(o) => !o && setPracticeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Procvičit metodou {practiceFor?.name}</DialogTitle>
            <DialogDescription>
              Vyber lekci, na které si metodu vyzkoušíš, a kolik minut chceš věnovat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>Lekce z učebnice (volitelné)</Label>
              <Select value={selectedLesson} onValueChange={setSelectedLesson}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Vyber lekci" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez konkrétní lekce</SelectItem>
                  {lessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                      {l.textbook ? ` — ${l.textbook}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lessons.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Zatím nemáš žádné dostupné lekce z učebnic.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="duration">Délka (minuty)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={240}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPracticeFor(null)}>Zrušit</Button>
            <Button onClick={startPractice} disabled={submitting} className="gap-2">
              <Play className="w-4 h-4" /> Spustit procvičování
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentMethods;
