import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, Clock, Save, Send, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import type { WorksheetSpec } from "@/lib/worksheet-spec";

interface AssignmentData {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  max_attempts: number;
  randomize_choices: boolean;
  randomize_order: boolean;
  activity_data: any[];
  settings: any;
  worksheet_id?: string | null;
}

interface AttemptData {
  id: string;
  attempt_number: number;
  status: string;
  answers: Record<string, any>;
  progress: { currentIndex: number; completed: number[] };
  score: number | null;
  max_score: number | null;
}

// Deterministic shuffle using a seed
const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const StudentAssignmentPlayer = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [items, setItems] = useState<any[]>([]);
  const [worksheetSpec, setWorksheetSpec] = useState<WorksheetSpec | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAnswers = useRef<string>("");

  useEffect(() => {
    if (assignmentId) loadAssignment();
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [assignmentId]);

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      // Load assignment
      const { data: aData, error: aErr } = await supabase
        .from("assignments" as any)
        .select("*")
        .eq("id", assignmentId)
        .single();
      if (aErr || !aData) throw new Error("Úloha nenalezena");
      const assignmentData = aData as any as AssignmentData;
      setAssignment(assignmentData);

      // Pokud má assignment přiřazený worksheet, načti ho (přednost před activity_data).
      if (assignmentData.worksheet_id) {
        const { data: wData } = await supabase
          .from("worksheets" as any)
          .select("spec")
          .eq("id", assignmentData.worksheet_id)
          .maybeSingle();
        const ws = (wData as any)?.spec;
        if (ws && ws.version) {
          setWorksheetSpec(ws as WorksheetSpec);
        }
      }

      // Check deadline
      if (assignmentData.deadline && new Date(assignmentData.deadline) < new Date()) {
        toast({ title: "Termín vypršel", description: "Tato úloha již nelze odevzdat.", variant: "destructive" });
      }

      // Load or create attempt
      const { data: attempts } = await supabase
        .from("assignment_attempts" as any)
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user.id)
        .order("attempt_number", { ascending: false });

      const existingAttempts = (attempts as any[] || []);
      const inProgress = existingAttempts.find((a: any) => a.status === "in_progress");

      if (inProgress) {
        // Resume existing attempt
        const attemptData = inProgress as any as AttemptData;
        setAttempt(attemptData);
        setAnswers(attemptData.answers || {});
        setCurrentIndex(attemptData.progress?.currentIndex || 0);
        lastSavedAnswers.current = JSON.stringify(attemptData.answers || {});
      } else if (existingAttempts.length < assignmentData.max_attempts) {
        // Create new attempt
        const newAttemptNum = existingAttempts.length + 1;
        const { data: newAttempt, error: nErr } = await supabase
          .from("assignment_attempts" as any)
          .insert({
            assignment_id: assignmentId,
            student_id: user.id,
            attempt_number: newAttemptNum,
            status: "in_progress",
            answers: {},
            progress: { currentIndex: 0, completed: [] },
          } as any)
          .select()
          .single();
        if (nErr) throw nErr;
        setAttempt(newAttempt as any as AttemptData);
        setAnswers({});
        setCurrentIndex(0);
        lastSavedAnswers.current = "{}";
      } else {
        // No more attempts
        const lastAttempt = existingAttempts[0] as any as AttemptData;
        setAttempt(lastAttempt);
        setAnswers(lastAttempt.answers || {});
        toast({ title: "Vyčerpány pokusy", description: `Použito ${existingAttempts.length}/${assignmentData.max_attempts} pokusů.` });
      }

      // Prepare items with randomization
      let activityItems = assignmentData.activity_data || [];
      if (assignmentData.randomize_order) {
        const seed = user.id.charCodeAt(0) * 1000 + (inProgress?.attempt_number || existingAttempts.length + 1);
        activityItems = seededShuffle(activityItems, seed);
      }
      setItems(activityItems);
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Autosave with debounce
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      doAutosave();
    }, 3000);
  }, [attempt]);

  const doAutosave = async () => {
    if (!attempt || attempt.status !== "in_progress") return;
    const currentAnswersStr = JSON.stringify(answers);
    if (currentAnswersStr === lastSavedAnswers.current) return;

    setSaving(true);
    try {
      await supabase
        .from("assignment_attempts" as any)
        .update({
          answers,
          progress: { currentIndex, completed: Object.keys(answers).map(Number).filter((k) => answers[k] !== undefined) },
          last_saved_at: new Date().toISOString(),
        } as any)
        .eq("id", attempt.id);
      lastSavedAnswers.current = currentAnswersStr;
    } catch {
      // silent fail for autosave
    } finally {
      setSaving(false);
    }
  };

  const handleAnswer = (index: number, value: any) => {
    const newAnswers = { ...answers, [index]: value };
    setAnswers(newAnswers);
    scheduleAutosave();
  };

  const handleSubmit = async () => {
    if (!attempt || !assignment) return;
    setSubmitting(true);
    try {
      // Calculate score
      let score = 0;
      let maxScore = items.length;
      items.forEach((item: any, idx: number) => {
        const answer = answers[idx];
        if (item.type === "mcq" && answer === item.correctIndex) score++;
        else if (item.type === "true_false" && answer === item.isTrue) score++;
        // Add more scoring logic as needed
      });

      await supabase
        .from("assignment_attempts" as any)
        .update({
          status: "submitted",
          answers,
          score,
          max_score: maxScore,
          submitted_at: new Date().toISOString(),
          progress: { currentIndex: items.length, completed: items.map((_: any, i: number) => i) },
        } as any)
        .eq("id", attempt.id);

      setAttempt({ ...attempt, status: "submitted", score, max_score: maxScore });
      toast({ title: "Odevzdáno!", description: `Skóre: ${score}/${maxScore}` });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isDeadlinePassed = assignment?.deadline ? new Date(assignment.deadline) < new Date() : false;
  const isReadOnly = attempt?.status !== "in_progress" || isDeadlinePassed;
  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== null).length;
  const progressPercent = items.length > 0 ? (answeredCount / items.length) * 100 : 0;
  const currentItem = items[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Úloha nenalezena.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{assignment.title}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {attempt && <span>Pokus {attempt.attempt_number}/{assignment.max_attempts}</span>}
              {assignment.deadline && (
                <span className={`flex items-center gap-1 ${isDeadlinePassed ? "text-destructive" : ""}`}>
                  <Clock className="w-3 h-3" />
                  {isDeadlinePassed ? "Vypršelo" : `Do ${new Date(assignment.deadline).toLocaleDateString("cs")}`}
                </span>
              )}
              {saving && <span className="flex items-center gap-1 text-muted-foreground"><Save className="w-3 h-3 animate-pulse" /> Ukládám…</span>}
            </div>
          </div>
          {attempt?.status === "submitted" && (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {attempt.score}/{attempt.max_score}
            </Badge>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{answeredCount}/{items.length} odpovědí</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Question navigation dots */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1" role="tablist" aria-label="Otázky">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              role="tab"
              aria-selected={i === currentIndex}
              aria-label={`Otázka ${i + 1}`}
              className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                i === currentIndex
                  ? "bg-primary text-primary-foreground"
                  : answers[i] !== undefined
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Current question */}
        {currentItem ? (
          <Card className="mb-4">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{currentItem.type || "otázka"}</Badge>
                  <span className="text-xs text-muted-foreground">{currentIndex + 1}/{items.length}</span>
                </div>

                <p className="text-base font-medium" id={`question-${currentIndex}`}>{currentItem.question || currentItem.prompt || "Otázka"}</p>

                {/* MCQ */}
                {(currentItem.type === "mcq" || currentItem.choices) && (
                  <div className="space-y-2" role="radiogroup" aria-labelledby={`question-${currentIndex}`}>
                    {(currentItem.choices || []).map((choice: string, ci: number) => (
                      <button
                        key={ci}
                        disabled={isReadOnly}
                        onClick={() => handleAnswer(currentIndex, ci)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAnswer(currentIndex, ci); }}
                        role="radio"
                        aria-checked={answers[currentIndex] === ci}
                        className={`w-full text-left p-3 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                          answers[currentIndex] === ci
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted/50"
                        } ${isReadOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + ci)}.</span>
                        {choice}
                      </button>
                    ))}
                  </div>
                )}

                {/* True/False */}
                {currentItem.type === "true_false" && (
                  <div className="flex gap-3" role="radiogroup" aria-labelledby={`question-${currentIndex}`}>
                    {[true, false].map((val) => (
                      <button
                        key={String(val)}
                        disabled={isReadOnly}
                        onClick={() => handleAnswer(currentIndex, val)}
                        role="radio"
                        aria-checked={answers[currentIndex] === val}
                        className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                          answers[currentIndex] === val
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50"
                        } ${isReadOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {val ? "Pravda" : "Nepravda"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Short answer */}
                {currentItem.type === "short_answer" && (
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={answers[currentIndex] || ""}
                    onChange={(e) => handleAnswer(currentIndex, e.target.value)}
                    placeholder="Tvá odpověď…"
                    aria-labelledby={`question-${currentIndex}`}
                    className="w-full p-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Tato úloha zatím nemá žádné otázky.</p>
          </div>
        )}

        {/* Navigation + Submit */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Předchozí
          </Button>

          {currentIndex < items.length - 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIndex((p) => p + 1)}
            >
              Další <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            !isReadOnly && (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                Odevzdat
              </Button>
            )
          )}
        </div>

        {/* Keyboard hint */}
        <p className="text-[10px] text-muted-foreground text-center mt-4">
          Klávesnice: ← → navigace · A–D volba odpovědi · Enter odevzdání
        </p>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentAssignmentPlayer;
