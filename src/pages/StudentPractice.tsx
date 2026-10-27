import { scorePractice, correctAnswerLabel, difficultyLabelCs, hasOpenQuestions, explanationView, sourceOriginLabel, OPEN_QUESTIONS_NOTE, masteryFromPercents, type ExplainData } from "@/lib/student-practice";
import { useEffect, useMemo, useState } from "react";
import { questionCountForDuration } from "@/lib/study-method-info";
import { practiceErrorMessage } from "@/lib/practice-error";
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
  ArrowLeft, RotateCcw, CheckCircle2, XCircle, Sparkles, Trophy, Loader2, Award,
} from "lucide-react";
import Confetti from "@/components/game/Confetti";
import PomodoroTimer from "@/components/practice/PomodoroTimer";
import { checkAcrostic, readPracticeSource, sequenceUnlockedCount, withStops } from "@/lib/practice-method";
import { LOCI_WARNING } from "../../supabase/functions/_shared/practice-phases";
import { Lock } from "lucide-react";
import AiContentBadge from "@/components/ai/AiContentBadge";

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
  explain?: ExplainData;
};

type Phase = {
  phase_name: string;
  phase_intro?: string;
  questions: Question[];
  key?: string;
  kind?: string;
  content?: { text?: string; outline?: string[]; points?: string[]; terms?: { term: string; meaning?: string }[] };
};

const LOCI_KEY = "bezli.practice.loci.stops";

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
  const useCustomSource = searchParams.get("source") === "custom";
  const plannedMin = Number(searchParams.get("min")) || null;
  const questionCount = questionCountForDuration(plannedMin);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PracticeData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [savingSession, setSavingSession] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mastery, setMastery] = useState<{ mastery_percent: number; sessions_count: number; mastered_at: string | null } | null>(null);
  const [showMasteryCelebration, setShowMasteryCelebration] = useState(false);
  const [sourceKind, setSourceKind] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [stops, setStops] = useState<string[]>(() => {
    try { const v = JSON.parse(sessionStorage.getItem(LOCI_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  useEffect(() => { try { sessionStorage.setItem(LOCI_KEY, JSON.stringify(stops)); } catch { /* ignore */ } }, [stops]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setAnswers({});
      setRevealed({});
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
      // Use RAG endpoint when a lesson is specified, otherwise fall back to generic.
      let fnData: any = null;
      let fnErr: any = null;
      const customSource = !lessonId && useCustomSource ? readPracticeSource() : null;
      if (!lessonId && useCustomSource && !customSource) {
        setError("Materiál k procvičení se nenašel. Vrať se a vlož ho znovu.");
        setLoading(false);
        return;
      }
      setSourceKind(customSource ? customSource.kind : lessonId ? "lesson" : null);
      setSourceLabel(customSource?.label ?? null);
      if (lessonId || customSource) {
        const ragRes = await supabase.functions.invoke("ai-practice-rag", {
          body: {
            ...(customSource ? { source_text: customSource.text, source_kind: customSource.kind } : { lesson_id: lessonId }),
            method: slug,
            ...(questionCount ? { question_count: questionCount } : {}),
          },
        });
        if (ragRes.error || ragRes.data?.error) {
          fnErr = ragRes.error || { message: ragRes.data?.error };
        } else {
          // Adapt to existing PracticeData shape
          fnData = {
            method: { id: method.id, name: slug, slug },
            lesson: ragRes.data.lesson,
            practice: {
              method_name: slug,
              lesson_title: ragRes.data.lesson?.title,
              phases: Array.isArray(ragRes.data.phases) && ragRes.data.phases.length > 0
                ? ragRes.data.phases.map((ph: any) => ({
                  phase_name: ph.title, phase_intro: ph.instruction, questions: ph.questions ?? [],
                  key: ph.key, kind: ph.kind, content: ph.content,
                }))
                : [{
                phase_name: "Procvičování z lekce",
                phase_intro: `AI připravila otázky přímo z obsahu lekce. Cílová obtížnost: ${difficultyLabelCs(ragRes.data.target_difficulty)}.`,
                questions: ragRes.data.questions ?? [],
              }],
            },
            recommendation: ragRes.data.recommendation,
            target_difficulty: ragRes.data.target_difficulty,
          };
        }
      } else {
        const r = await supabase.functions.invoke("generate-practice", {
          body: { method_id: method.id, lesson_id: lessonId, ...(questionCount ? { question_count: questionCount } : {}) },
        });
        fnData = r.data;
        fnErr = r.error;
      }
      if (cancelled) return;
      if (fnErr) {
        const message = await practiceErrorMessage(fnErr);
        if (cancelled) return;
        setError(message);
        setLoading(false);
        return;
      }
      if (fnData?.error) {
        setError(fnData.error);
        setLoading(false);
        return;
      }
      if (!(fnData?.practice?.phases ?? []).some((phase: Phase) => phase.questions?.length > 0 || phase.kind === "pomodoro")) {
        setError("Z této lekce se nepodařilo vytvořit otázky. Zkus to znovu.");
        setLoading(false);
        return;
      }
      setData(fnData as PracticeData);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, lessonId, reloadKey, questionCount, useCustomSource]);

  // Load mastery for this lesson
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lessonId) {
        setMastery(null);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: row } = await supabase
        .from("student_lesson_mastery")
        .select("mastery_percent, sessions_count, mastered_at")
        .eq("student_id", session.user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (cancelled) return;
      setMastery(row
        ? { mastery_percent: Number(row.mastery_percent) || 0, sessions_count: row.sessions_count ?? 0, mastered_at: row.mastered_at }
        : { mastery_percent: 0, sessions_count: 0, mastered_at: null });
    })();
    return () => { cancelled = true; };
  }, [lessonId, reloadKey]);


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

  const setAns = (idx: number, value: string | number | boolean) =>
    setAnswers((prev) => ({ ...prev, [String(idx)]: value as any }));

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!data) return;
    // Skóre počítat přímo z odpovědí – `score`/`percent` z useMemo jsou ještě z doby před odevzdáním (0).
    const fresh = scorePractice(data.practice.phases.flatMap((p) => p.questions), answers);
    const score = fresh.correct;
    const totalScorable = fresh.total;
    const percent = fresh.percent;
    setSavingSession(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const duration = plannedMin ?? Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const { error: insErr } = await supabase.from("student_practice_sessions").insert({
        student_id: session.user.id,
        method_id: data.method.id,
        lesson_id: data.lesson?.id ?? null,
        duration_min: duration,
        ai_generated: true,
        score: totalScorable > 0 ? score : null,
        answers_json: {
          answers,
          // Bez obsahu fází: kopie žákova textu se neukládá.
          phases: data.practice.phases.map(({ content: _c, ...ph }) => ph),
          ...(sourceKind && sourceKind !== "lesson" ? { source: { kind: sourceKind } } : {}),
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

        // Update mastery for this lesson (weighted avg of last 3 session percents)
        if (data.lesson?.id && totalScorable > 0) {
          const lessonId = data.lesson.id;
          const { data: recent } = await supabase
            .from("student_practice_sessions")
            .select("answers_json, score, created_at")
            .eq("student_id", session.user.id)
            .eq("lesson_id", lessonId)
            .order("created_at", { ascending: false })
            .limit(3);

          const percents: number[] = [];
          for (const r of recent ?? []) {
            const p = (r.answers_json as any)?.percent;
            if (typeof p === "number") percents.push(p);
          }
          // Vážený průměr: nejnovější váha 3, pak 2, 1.
          const newPercent = masteryFromPercents(percents, percent);

          const { data: existing } = await supabase
            .from("student_lesson_mastery")
            .select("id, sessions_count, mastered_at")
            .eq("student_id", session.user.id)
            .eq("lesson_id", lessonId)
            .maybeSingle();

          const newCount = (existing?.sessions_count ?? 0) + 1;
          const wasMastered = !!existing?.mastered_at;
          const shouldMaster = !wasMastered && newPercent >= 85 && newCount >= 2;
          const masteredAt = wasMastered ? existing!.mastered_at : (shouldMaster ? new Date().toISOString() : null);

          const { error: upErr } = await supabase
            .from("student_lesson_mastery")
            .upsert({
              student_id: session.user.id,
              lesson_id: lessonId,
              mastery_percent: newPercent,
              sessions_count: newCount,
              mastered_at: masteredAt,
            }, { onConflict: "student_id,lesson_id" });

          if (!upErr) {
            setMastery({ mastery_percent: newPercent, sessions_count: newCount, mastered_at: masteredAt });
            if (shouldMaster) {
              setShowMasteryCelebration(true);
              setTimeout(() => setShowMasteryCelebration(false), 6000);
            }
          }
        }
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-3xl font-bold">{data.method.name}</h1>
                <AiContentBadge aiGenerated />
              </div>
              {data.lesson?.title && (
                <p className="text-muted-foreground mt-1">Lekce: {data.lesson.title}</p>
              )}
              {!data.lesson && sourceLabel && (
                <p className="text-muted-foreground mt-1">Zdroj: {sourceLabel}</p>
              )}

              {lessonId && mastery && (
                <div className="mt-4">
                  {mastery.mastered_at ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2">
                      <Award className="w-5 h-5 text-emerald-600" />
                      <span className="font-heading text-sm font-bold text-emerald-700">
                        Zvládnuto! 🏆
                      </span>
                      <span className="text-xs text-emerald-700/70">
                        ({Math.round(mastery.mastery_percent)} %)
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Zvládnutí lekce
                        </span>
                        <span className="text-sm font-semibold">
                          {Math.round(mastery.mastery_percent)} %
                        </span>
                      </div>
                      <Progress value={mastery.mastery_percent} className="h-2" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {showMasteryCelebration && (
              <div className="relative">
                <div className="fixed inset-0 pointer-events-none z-50">
                  <Confetti count={90} />
                </div>
                <div className="mb-6 bg-gradient-to-br from-emerald-500/15 to-primary/10 border border-emerald-500/40 rounded-xl p-6 text-center animate-in fade-in zoom-in-95">
                  <Award className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                  <h2 className="font-heading text-2xl font-bold text-emerald-700">
                    Skvělá práce! Lekci jsi právě zvládl/a! 🏆
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dosáhl/a jsi mastery úrovně. Můžeš pokračovat v procvičování nebo se pustit do další lekce.
                  </p>
                </div>
              </div>
            )}

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
                        ? hasOpenQuestions(allQuestions) && OPEN_QUESTIONS_NOTE
                        : OPEN_QUESTIONS_NOTE}
                    </p>
                  </div>
                </div>
                {totalScorable > 0 && <Progress value={percent} className="h-2" />}
                {data.recommendation && (
                  <div className="mt-4 p-3 rounded-lg bg-background/60 border border-border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Doporučení k opakování</p>
                    <p className="text-sm">{data.recommendation}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleRetry} className="gap-2" disabled={savingSession}>
                    <RotateCcw className="w-4 h-4" />
                    {mastery?.mastered_at && mastery.mastery_percent >= 100
                      ? "Zkusit znovu"
                      : "Procvičit dál"}
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
                const isSeq = slug === "sekvencni";
                const unlocked = isSeq ? sequenceUnlockedCount(
                  data.practice.phases.map((ph) => ({ kind: ph.kind ?? "questions", questions: ph.questions })),
                  answers,
                ) : data.practice.phases.length;
                const allTerms = data.practice.phases.find((ph) => ph.content?.terms?.length && ph.kind === "terms")?.content?.terms
                  ?? data.practice.phases.find((ph) => ph.content?.terms?.length)?.content?.terms ?? [];
                return data.practice.phases.map((phase, pi) => {
                  if (pi >= unlocked && !submitted) {
                    idx += phase.questions.length;
                    return (
                      <section key={pi} className="bg-muted/40 border border-dashed border-border rounded-xl p-5 flex items-center gap-3 text-muted-foreground">
                        <Lock className="w-5 h-5" aria-hidden />
                        <p><span className="font-semibold">{phase.phase_name}</span> – odemkne se, až budeš mít v předchozí části aspoň 70 %.</p>
                      </section>
                    );
                  }
                  return (
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
                    <PhaseContent
                      phase={phase} slug={slug ?? ""} submitted={submitted} terms={allTerms}
                      stops={stops} setStops={setStops}
                      acrosticAnswer={(() => {
                        const start = idx;
                        return typeof answers[String(start)] === "string" ? String(answers[String(start)]) : "";
                      })()}
                    />

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
                              <div className="flex-1">
                                <p className="font-medium">
                                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                  {withStops(q.text ?? q.prompt ?? "", stops)}
                                </p>
                                {q.difficulty && (
                                  <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${DIFFICULTY_META[q.difficulty]?.cls ?? ""}`}>
                                    {DIFFICULTY_META[q.difficulty]?.label ?? q.difficulty}
                                  </span>
                                )}
                              </div>
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

                            {q.type === "true_false" && (
                              <div className="flex gap-2">
                                {[true, false].map((v) => {
                                  const selected = userAns === v;
                                  const isCorrect = submitted && Boolean(q.correct_answer) === v;
                                  return (
                                    <button
                                      key={String(v)}
                                      type="button"
                                      disabled={submitted}
                                      onClick={() => setAns(i, v)}
                                      className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                                        isCorrect
                                          ? "border-emerald-500/50 bg-emerald-500/10"
                                          : selected
                                          ? "border-primary bg-primary/5"
                                          : "border-border hover:bg-muted/50"
                                      }`}
                                    >
                                      {v ? "Pravda" : "Nepravda"}
                                    </button>
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

                            {submitted && q.type !== "open" && correctAnswerLabel(q) && result === false && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Správná odpověď: <span className="font-medium">{correctAnswerLabel(q)}</span>
                              </p>
                            )}
                            {submitted && q.hint && result === false && (
                              <p className="text-xs text-muted-foreground mt-1">Tip: {q.hint}</p>
                            )}
                            {q.type === "open" && !submitted && !revealed[key] && !(typeof userAns === "string" && userAns.trim()) && (
                              <Button type="button" variant="ghost" size="sm" className="mt-2 min-h-11"
                                onClick={() => setRevealed((r) => ({ ...r, [key]: true }))}>
                                Ukázat vysvětlení
                              </Button>
                            )}
                            {((q.type === "open" && (submitted || revealed[key])) || (submitted && result === false)) && (
                              <SourceExplanationBlock q={q} origin={sourceOriginLabel(data.lesson?.title)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  );
                });
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

function SourceExplanationBlock({ q, origin }: { q: Question; origin: string }) {
  const v = explanationView(q);
  if (!v) return null;
  return (
    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm" role="note">
      <p className="font-semibold mb-1">
        Vysvětlení ze zdroje <span className="font-normal text-muted-foreground">({origin})</span>
      </p>
      {v.kind === "missing" ? (
        <p className="text-muted-foreground">{v.message}</p>
      ) : (
        <>
          {v.explanation && (
            <p>
              {v.summaryOnly && <span className="text-xs text-muted-foreground mr-1">shrnutí ze zdroje:</span>}
              {v.explanation}
            </p>
          )}
          {v.keyPoints.length > 0 && q.type === "open" && (
            <ul className="list-disc pl-5 mt-2 space-y-1">{v.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
          )}
          {v.quote && (
            <blockquote className="mt-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">„{v.quote}“</blockquote>
          )}
        </>
      )}
    </div>
  );
}

function PhaseContent({ phase, slug, submitted, terms, stops, setStops, acrosticAnswer }: {
  phase: Phase; slug: string; submitted: boolean; terms: { term: string; meaning?: string }[];
  stops: string[]; setStops: (s: string[]) => void; acrosticAnswer: string;
}) {
  const c = phase.content;
  const kind = phase.kind;
  return (
    <div className="space-y-4 mb-5">
      {slug === "loci" && phase.key === "trasa" && (
        <p className="text-sm rounded-md border border-border bg-muted/50 p-3">{LOCI_WARNING}</p>
      )}
      {c?.outline && c.outline.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">Osnova</p>
          <ul className="list-disc pl-5 text-sm space-y-1">{c.outline.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </div>
      )}
      {(kind === "read" || kind === "section") && c?.text && (
        <div className="max-h-96 overflow-y-auto rounded-md border border-border bg-muted/30 p-4 text-base leading-relaxed whitespace-pre-line">
          {c.text}
        </div>
      )}
      {kind === "terms" && terms.length > 0 && (
        <ol className="list-decimal pl-5 space-y-1">
          {terms.map((t, i) => <li key={i}><span className="font-semibold">{t.term}</span>{t.meaning ? ` – ${t.meaning}` : ""}</li>)}
        </ol>
      )}
      {kind === "letters" && terms.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="První písmena pojmů">
          {terms.map((t, i) => (
            <span key={i} className="w-11 h-11 rounded-md border border-primary/40 bg-primary/5 flex items-center justify-center font-heading text-xl font-bold">
              {(t.term.trim()[0] ?? "").toUpperCase()}
            </span>
          ))}
        </div>
      )}
      {kind === "acrostic" && terms.length > 0 && acrosticAnswer.trim() && (() => {
        const r = checkAcrostic(acrosticAnswer, terms.map((t) => t.term));
        return (
          <div role="status" className={`rounded-md border p-3 text-sm ${r.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/40"}`}>
            <p className="font-medium mb-2">{r.ok ? `Sedí to! Tvůj ${r.mode} má správná písmena v pořadí.` : "Zkontroluj písmena:"}</p>
            <div className="flex flex-wrap gap-2">
              {r.items.map((it, i) => (
                <span key={i} className={`px-2 py-1 rounded border ${it.ok ? "border-emerald-500/50" : "border-destructive/50"}`}>
                  {it.expected} → {it.got || "–"} {it.ok ? "✓" : "✗"}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
      {kind === "loci_route" && (
        <div className="space-y-2">
          {Array.from({ length: Math.max(terms.length, 5) }).map((_, i) => (
            <div key={i}>
              <Label htmlFor={`stop-${i}`}>Název zastávky {i + 1}</Label>
              <Input id={`stop-${i}`} value={stops[i] ?? ""} disabled={submitted} className="mt-1 text-base"
                placeholder={i === 0 ? `Zastávka ${i + 1} (třeba: dveře od pokoje)` : `Zastávka ${i + 1}`}
                onChange={(e) => { const n = [...stops]; n[i] = e.target.value; setStops(n); }} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Zastávky zůstávají jen v tomto prohlížeči, nikam se neukládají.</p>
        </div>
      )}
      {kind === "loci_images" && terms.length > 0 && (
        <ul className="text-sm space-y-1">
          {terms.map((t, i) => <li key={i}><span className="font-semibold">{withStops(`{{stop:${i}}}`, stops)}</span> → {t.term}</li>)}
        </ul>
      )}
      {kind === "pomodoro" && <PomodoroTimer />}
      {submitted && c?.points && c.points.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-semibold mb-1">Porovnej s klíčovými body z textu</p>
          <ul className="list-disc pl-5 text-sm space-y-1">{c.points.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default StudentPractice;
