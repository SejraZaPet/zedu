import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SelectGroup, SelectLabel } from "@/components/ui/select";
import { fetchStudentPracticeLessons, type PracticeLessonGroup } from "@/lib/student-practice-lessons";
import { methodPurpose, PRACTICE_DURATIONS, questionCountForDuration } from "@/lib/study-method-info";
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
  const [lessonGroups, setLessonGroups] = useState<PracticeLessonGroup[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<string>("none");
  const [duration, setDuration] = useState<string>("15");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("study_methods")
        .select("id, name, slug, description, icon, steps_json")
        .order("name");
      if (error) {
        toast({ title: "Chyba načítání", description: error.message, variant: "destructive" });
      } else {
        setMethods((data ?? []) as any);
      }
      if (session) {
        const { data: prefs } = await supabase
          .from("student_preferred_methods")
          .select("method_id")
          .eq("student_id", session.user.id);
        setPreferredIds(((prefs ?? []) as any[]).map((p) => p.method_id));
      }
      setLoading(false);
    })();
  }, [toast]);

  useEffect(() => {
    if (!practiceFor) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setLessonsLoading(true);
      try {
        const groups = await fetchStudentPracticeLessons(session.user.id);
        if (!cancelled) setLessonGroups(groups);
      } catch {
        if (!cancelled) setLessonGroups([]);
      } finally {
        if (!cancelled) setLessonsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [practiceFor]);

  const openDetail = (m: Method) => {
    setDetail(m);
    setStepIdx(0);
  };

  const startPractice = () => {
    if (!practiceFor) return;
    const params = new URLSearchParams();
    if (selectedLesson !== "none") params.set("lesson", selectedLesson);
    params.set("min", duration);
    navigate(`/student/metody/${practiceFor.slug}/procviceni?${params.toString()}`);
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
            <span className="text-sm font-medium uppercase tracking-wider">Učím se</span>
          </div>
          <h1 className="font-heading text-3xl font-bold">Jak se učit chytře</h1>
          <p className="text-muted-foreground mt-1">
            Vyber si techniku, vyber učivo a nech si z něj udělat procvičení. Každá technika má krátký návod.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : (() => {
          const preferred = methods.filter((m) => preferredIds.includes(m.id));
          const others = methods.filter((m) => !preferredIds.includes(m.id));

          const renderCard = (m: Method, big: boolean) => {
            const Icon = (m.icon && ICONS[m.icon]) || Brain;
            return (
              <button
                key={m.id}
                onClick={() => openDetail(m)}
                className={`relative text-left bg-card border rounded-xl hover:shadow-md transition-all flex flex-col ${
                  big
                    ? "p-7 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent shadow-sm hover:border-primary"
                    : "p-5 border-border hover:border-primary/40"
                }`}
              >
                {big && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Oblíbená
                  </span>
                )}
                <div
                  className={`rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 ${
                    big ? "w-16 h-16" : "w-12 h-12"
                  }`}
                >
                  <Icon className={`text-primary ${big ? "w-8 h-8" : "w-6 h-6"}`} />
                </div>
                <h3 className={`font-heading font-semibold mb-1 ${big ? "text-2xl" : "text-lg"}`}>{m.name}</h3>
                {methodPurpose(m.slug) && (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-foreground/80">{methodPurpose(m.slug)!.purpose}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      <Timer className="w-3 h-3" aria-hidden /> {methodPurpose(m.slug)!.duration}
                    </span>
                  </div>
                )}
                {m.description && (
                  <p className={`text-muted-foreground ${big ? "text-base line-clamp-4" : "text-sm line-clamp-3"}`}>
                    {m.description}
                  </p>
                )}
                <span className="mt-3 text-sm font-medium text-primary">Zobrazit návod →</span>
              </button>
            );
          };

          return (
            <div className="space-y-10">
              {preferred.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h2 className="font-heading text-xl font-semibold">Tvoje oblíbené</h2>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {preferred.map((m) => renderCard(m, true))}
                  </div>
                </section>
              )}
              <section>
                {preferred.length > 0 && (
                  <h2 className="font-heading text-xl font-semibold mb-3">Další metody</h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map((m) => renderCard(m, false))}
                </div>
                {preferred.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Tip: V profilu si můžeš vybrat až 3 oblíbené metody — budou se ti zobrazovat nahoře.
                  </p>
                )}
              </section>
            </div>
          );
        })()}
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
                  {lessonGroups.map((g) => (
                    <SelectGroup key={g.subject}>
                      <SelectLabel>{g.subject}</SelectLabel>
                      {g.lessons.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.title}
                          {l.textbook && l.textbook !== g.subject ? ` — ${l.textbook}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {lessonsLoading ? (
                <p className="text-xs text-muted-foreground mt-1">Načítám tvoje lekce…</p>
              ) : lessonGroups.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Zatím nemáš žádné lekce z učebnic. Jakmile ti učitel zveřejní lekci, objeví se tady. Můžeš procvičovat i bez lekce.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="duration">Délka (minuty)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} min · {questionCountForDuration(d)} otázek
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
