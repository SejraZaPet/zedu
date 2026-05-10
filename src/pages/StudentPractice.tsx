import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, RotateCcw, CheckCircle2, XCircle, Sparkles, Trophy, Loader2,
} from "lucide-react";

type Question = {
  type: "open" | "short_answer" | "multiple_choice" | "true_false";
  prompt?: string;
  text?: string;
  options?: string[];
  correct_index?: number;
  correct_answer?: string | boolean;
  hint?: string;
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
};

type Phase = {
  phase_name: string;
  phase_intro?: string;
  questions: Question[];
};

type PracticeData = {
  method: { id: string; name: string; slug: string };
  lesson: { id: string; title: string } | null;
  practice: {
    method_name: string;
    lesson_title?: string;
    phases: Phase[];
  };
  recommendation?: string;
  target_difficulty?: "easy" | "medium" | "hard";
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function evaluate(q: Question, answer: string | number | boolean | undefined): boolean | null {
  if (q.type === "open") return null;
  if (q.type === "multiple_choice") {
    if (typeof answer !== "number" || typeof q.correct_index !== "number") return false;
    return answer === q.correct_index;
  }
  if (q.type === "true_false") {
    if (typeof answer !== "boolean") return false;
    return answer === Boolean(q.correct_answer);
  }
  if (q.type === "short_answer") {
    if (typeof answer !== "string" || typeof q.correct_answer !== "string") return false;
    const a = norm(answer);
    const c = norm(q.correct_answer);
    return a.length > 0 && (a === c || a.includes(c) || c.includes(a));
  }
  return false;
}

const DIFFICULTY_META: Record<string, { label: string; cls: string }> = {
  easy:   { label: "Snadná",  cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  medium: { label: "Střední", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  hard:   { label: "Těžká",   cls: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
};

const StudentPractice = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const lessonId = searchParams.get("lesson") || null;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PracticeData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [savingSession, setSavingSession] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setAnswers({});
      setSubmitted(false);
      setStartedAt(Date.now());

      if (!slug) {
        setError("Chybí identifikátor metody.");
        setLoading(false);
        return;
      }
      const { data: method, error: mErr } = await supabase
        .from("study_methods")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (mErr || !method) {
        setError("Metoda nebyla nalezena.");
        setLoading(false);
        return;
      }
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        "generate-practice",
        { body: { method_id: method.id, lesson_id: lessonId } },
      );
      if (cancelled) return;
      if (fnErr) {
        setError(fnErr.message || "Nepodařilo se vygenerovat cvičení.");
        setLoading(false);
        return;
      }
      if (fnData?.error) {
        setError(fnData.error);
        setLoading(false);
        return;
      }
      setData(fnData as PracticeData);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, lessonId, reloadKey]);

  const allQuestions = useMemo(
    () => (data?.practice?.phases ?? []).flatMap((p) => p.questions),
    [data],
  );
  const scorable = allQuestions.filter((q) => q.type !== "open");

  const score = useMemo(() => {
    if (!submitted) return 0;
    let correct = 0;
    let idx = 0;
    for (const phase of data?.practice?.phases ?? []) {
      for (const q of phase.questions) {
        const key = String(idx);
        const res = evaluate(q, answers[key]);
        if (res) correct++;
        idx++;
      }
    }
    return correct;
  }, [submitted, data, answers]);

  const totalScorable = scorable.length;
  const percent = totalScorable > 0 ? Math.round((score / totalScorable) * 100) : 0;

  const setAns = (idx: number, value: string | number) =>
    setAnswers((prev) => ({ ...prev, [String(idx)]: value }));

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!data) return;
    setSavingSession(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const duration = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const { error: insErr } = await supabase.from("student_practice_sessions").insert({
        student_id: session.user.id,
        method_id: data.method.id,
        lesson_id: data.lesson?.id ?? null,
        duration_min: duration,
        score: totalScorable > 0 ? score : null,
        answers_json: {
          answers,
          phases: data.practice.phases,
          score,
          total_scorable: totalScorable,
          percent,
        },
      });
      if (insErr) {
        toast({
          title: "Výsledek se nepodařilo uložit",
          description: insErr.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Hotovo!",
          description: `Tvůj výsledek byl uložen.`,
        });
      }
    }
    setSavingSession(false);
  };

  const handleRetry = () => {
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-3xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate("/student/metody")}>
          <ArrowLeft className="w-4 h-4" /> Zpět na metody
        </Button>

        {loading && (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">AI připravuje cvičení na míru...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
            <p className="text-destructive font-medium mb-3">{error}</p>
            <Button onClick={handleRetry} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" /> Zkusit znovu
            </Button>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Procvičování</span>
              </div>
              <h1 className="font-heading text-3xl font-bold">{data.method.name}</h1>
              {data.lesson?.title && (
                <p className="text-muted-foreground mt-1">Lekce: {data.lesson.title}</p>
              )}
            </div>

            {submitted && (
              <div className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-heading text-2xl font-bold">
                      {totalScorable > 0
                        ? `${score} / ${totalScorable} (${percent} %)`
                        : "Procvičení dokončeno"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {totalScorable > 0
                        ? "Otevřené odpovědi se nehodnotí automaticky — projdi si je sám/sama."
                        : "Cvičení obsahovalo jen otevřené otázky bez automatického vyhodnocení."}
                    </p>
                  </div>
                </div>
                {totalScorable > 0 && <Progress value={percent} className="h-2" />}
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleRetry} className="gap-2" disabled={savingSession}>
                    <RotateCcw className="w-4 h-4" /> Zkusit znovu
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/student/metody")}>
                    Zpět na metody
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-8">
              {(() => {
                let idx = 0;
                return data.practice.phases.map((phase, pi) => (
                  <section key={pi} className="bg-card border border-border rounded-xl p-5">
                    <div className="mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-primary">
                        Fáze {pi + 1}
                      </span>
                      <h2 className="font-heading text-xl font-semibold">{phase.phase_name}</h2>
                      {phase.phase_intro && (
                        <p className="text-sm text-muted-foreground mt-1">{phase.phase_intro}</p>
                      )}
                    </div>

                    <div className="space-y-5">
                      {phase.questions.map((q) => {
                        const i = idx++;
                        const key = String(i);
                        const userAns = answers[key];
                        const result = submitted ? evaluate(q, userAns) : null;
                        return (
                          <div
                            key={i}
                            className={`rounded-lg border p-4 ${
                              submitted && result === true
                                ? "border-emerald-500/40 bg-emerald-500/5"
                                : submitted && result === false
                                ? "border-destructive/40 bg-destructive/5"
                                : "border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <p className="font-medium">
                                <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                {q.prompt}
                              </p>
                              {submitted && result === true && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                              )}
                              {submitted && result === false && (
                                <XCircle className="w-5 h-5 text-destructive shrink-0" />
                              )}
                            </div>

                            {q.type === "multiple_choice" && q.options && (
                              <div className="space-y-2">
                                {q.options.map((opt, oi) => {
                                  const selected = userAns === oi;
                                  const isCorrect = submitted && oi === q.correct_index;
                                  return (
                                    <label
                                      key={oi}
                                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                                        isCorrect
                                          ? "border-emerald-500/50 bg-emerald-500/10"
                                          : selected
                                          ? "border-primary bg-primary/5"
                                          : "border-border hover:bg-muted/50"
                                      } ${submitted ? "cursor-default" : ""}`}
                                    >
                                      <input
                                        type="radio"
                                        name={`q-${i}`}
                                        checked={selected}
                                        disabled={submitted}
                                        onChange={() => setAns(i, oi)}
                                        className="accent-primary"
                                      />
                                      <span className="text-sm">{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {q.type === "short_answer" && (
                              <Input
                                value={typeof userAns === "string" ? userAns : ""}
                                onChange={(e) => setAns(i, e.target.value)}
                                placeholder="Tvoje odpověď..."
                                disabled={submitted}
                              />
                            )}

                            {q.type === "open" && (
                              <Textarea
                                value={typeof userAns === "string" ? userAns : ""}
                                onChange={(e) => setAns(i, e.target.value)}
                                placeholder="Napiš svoji úvahu..."
                                rows={3}
                                disabled={submitted}
                              />
                            )}

                            {submitted && q.type !== "open" && q.correct_answer && result === false && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Správná odpověď: <span className="font-medium">{q.correct_answer}</span>
                              </p>
                            )}
                            {submitted && q.hint && result === false && (
                              <p className="text-xs text-muted-foreground mt-1">Tip: {q.hint}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ));
              })()}
            </div>

            {!submitted && (
              <div className="sticky bottom-4 mt-8">
                <div className="bg-card border border-border rounded-xl p-4 shadow-lg flex items-center justify-between gap-3">
                  <Label className="text-sm text-muted-foreground">
                    Odpovězeno: {Object.keys(answers).length} / {allQuestions.length}
                  </Label>
                  <Button onClick={handleSubmit} disabled={savingSession} className="gap-2">
                    {savingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Vyhodnotit
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentPractice;
