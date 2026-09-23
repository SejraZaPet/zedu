import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, Clock, Save, Send, ArrowLeft, Lock, AlertTriangle, Maximize, Users, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import AttachmentsUploader from "@/components/assignments/AttachmentsUploader";
import { Textarea } from "@/components/ui/textarea";
import AssignmentMaterialsList from "@/components/assignments/AssignmentMaterialsList";
import { parseMaterials } from "@/lib/assignment-materials";
import type { WorksheetSpec } from "@/lib/worksheet-spec";
import { useLockdownMode } from "@/hooks/useLockdownMode";
import ReadAloudButton from "@/components/a11y/ReadAloudButton";
import BezlaiTutorChat from "@/components/BezlaiTutorChat";
import { resolveLinkedLesson, type LinkedLessonInfo } from "@/lib/linked-lesson";
import { BookOpen } from "lucide-react";

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
  lockdown_mode?: boolean;
  is_portfolio_task?: boolean;
  materials?: unknown;
  group_mode?: string | null;
  group_size?: number | null;
  lesson_id?: string | null;
  lesson_source?: string | null;
}


interface AttemptData {
  id: string;
  attempt_number: number;
  status: string;
  answers: Record<string, any>;
  progress: { currentIndex: number; completed: number[] };
  score: number | null;
  max_score: number | null;
  submission_note?: string | null;
  teacher_feedback_text?: string | null;
  teacher_feedback_emoji?: string | null;
  teacher_feedback_at?: string | null;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [items, setItems] = useState<any[]>([]);
  // Nepovinná poznámka žáka k odevzdání (uvidí ji učitel).
  const [note, setNote] = useState("");
  const [worksheetSpec, setWorksheetSpec] = useState<WorksheetSpec | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAnswers = useRef<string>("");
  // ---- Skupinové / párové úkoly ----
  /** Skupina žáka pro tento úkol (jen u skupinových/párových zadání). */
  const [myGroup, setMyGroup] = useState<{ id: string; name: string } | null>(null);
  const [groupMemberNames, setGroupMemberNames] = useState<string[]>([]);
  const [noGroup, setNoGroup] = useState(false);
  const [lastEdited, setLastEdited] = useState<{ name: string; at: string } | null>(null);
  /** Lekce z učebnice propojená s úlohou (nepovinná). */
  const [linkedLesson, setLinkedLesson] = useState<LinkedLessonInfo | null>(null);

  /** Všechny pokusy žáka (nejnovější první) – pro přepínač pokusů po termínu. */
  const [allAttempts, setAllAttempts] = useState<AttemptData[]>([]);

  useEffect(() => {
    if (assignmentId) loadAssignment();
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [assignmentId]);

  /** Přepne zobrazení na konkrétní pokus (prohlížení bez úprav). */
  const selectAttempt = (a: AttemptData) => {
    setAttempt(a);
    setAnswers((a.answers as any) || {});
    setNote(a.submission_note || "");
    setCurrentIndex(0);
    lastSavedAnswers.current = JSON.stringify(a.answers || {});
  };


  const loadAssignment = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);

      // Load assignment
      const { data: aData, error: aErr } = await supabase
        .from("assignments" as any)
        .select("*")
        .eq("id", assignmentId)
        .single();
      if (aErr || !aData) throw new Error("Úloha nenalezena");
      const assignmentData = aData as any as AssignmentData;
      setAssignment(assignmentData);

      // Propojená lekce z učebnice – zobrazí se nad zadáním jako tlačítko.
      if (assignmentData.lesson_id) {
        resolveLinkedLesson(assignmentData.lesson_id, assignmentData.lesson_source ?? null)
          .then((info) => setLinkedLesson(info))
          .catch(() => setLinkedLesson(null));
      } else {
        setLinkedLesson(null);
      }

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

      // Skupinový / párový úkol: pokus je sdílený celou skupinou
      let groupId: string | null = null;
      const isGroupAssignment = (assignmentData.group_mode ?? "individual") !== "individual";
      if (isGroupAssignment) {
        // RLS vrátí žákovi jen skupinu, ve které je členem.
        const { data: gData } = await supabase
          .from("assignment_groups" as any)
          .select("id, name")
          .eq("assignment_id", assignmentId);
        const myG = ((gData as any[]) || [])[0];
        if (!myG) {
          setNoGroup(true);
          setLoading(false);
          return;
        }
        groupId = myG.id as string;
        setMyGroup({ id: myG.id, name: myG.name });

        const { data: mData } = await supabase
          .from("assignment_group_members" as any)
          .select("student_id")
          .eq("group_id", groupId);
        const memberIds = ((mData as any[]) || []).map((m: any) => m.student_id as string);
        if (memberIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", memberIds);
          setGroupMemberNames(
            ((profs as any[]) || []).map(
              (p: any) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Spolužák",
            ),
          );
        }
      }

      // Load or create attempt
      let attemptQuery = supabase
        .from("assignment_attempts" as any)
        .select("*")
        .eq("assignment_id", assignmentId);
      attemptQuery = groupId
        ? attemptQuery.eq("group_id", groupId)
        : attemptQuery.eq("student_id", user.id);
      const { data: attempts } = await attemptQuery.order("attempt_number", { ascending: false });

      const existingAttempts = (attempts as any[] || []);
      setAllAttempts(existingAttempts as any as AttemptData[]);
      const inProgress = existingAttempts.find((a: any) => a.status === "in_progress");
      const deadlinePassed = assignmentData.deadline
        ? new Date(assignmentData.deadline) < new Date()
        : false;

      // Kdo naposledy upravoval sdílený pokus
      const editedSource = inProgress || existingAttempts[0];
      if (isGroupAssignment && editedSource?.last_edited_by && editedSource?.last_edited_at) {
        const { data: ed } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", editedSource.last_edited_by)
          .maybeSingle();
        setLastEdited({
          name: ed ? `${(ed as any).first_name ?? ""} ${(ed as any).last_name ?? ""}`.trim() || "Spolužák" : "Spolužák",
          at: editedSource.last_edited_at,
        });
      }

      if (deadlinePassed) {
        // Po termínu se NIKDY nezakládá nový pokus – žák si jen prohlíží,
        // co odevzdal (nebo rozpracoval) před termínem.
        const lastAttempt = (inProgress ?? existingAttempts[0]) as any as AttemptData | undefined;
        if (lastAttempt) {
          selectAttempt(lastAttempt);
        } else {
          setAttempt(null);
          setAnswers({});
          setNote("");
        }
      } else if (inProgress) {
        // Resume existing attempt
        const attemptData = inProgress as any as AttemptData;
        setAttempt(attemptData);
        setAnswers(attemptData.answers || {});
        setNote(attemptData.submission_note || "");
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
            group_id: groupId,
            attempt_number: newAttemptNum,
            status: "in_progress",
            answers: {},
            progress: { currentIndex: 0, completed: [] },
            last_edited_by: user.id,
            last_edited_at: new Date().toISOString(),
          } as any)
          .select()
          .single();
        if (nErr) throw nErr;
        setAttempt(newAttempt as any as AttemptData);
        setAllAttempts([newAttempt as any as AttemptData, ...(existingAttempts as any as AttemptData[])]);
        setAnswers({});
        setCurrentIndex(0);
        lastSavedAnswers.current = "{}";
      } else {
        // No more attempts
        const lastAttempt = existingAttempts[0] as any as AttemptData;
        selectAttempt(lastAttempt);
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
    const currentAnswersStr = JSON.stringify({ answers, note });
    if (currentAnswersStr === lastSavedAnswers.current) return;

    setSaving(true);
    try {
      await supabase
        .from("assignment_attempts" as any)
        .update({
          answers,
          submission_note: note.trim() ? note : null,
          progress: { currentIndex, completed: Object.keys(answers).map(Number).filter((k) => answers[k] !== undefined) },
          last_saved_at: new Date().toISOString(),
          last_edited_by: userId,
          last_edited_at: new Date().toISOString(),
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
          submission_note: note.trim() ? note : null,
          score,
          max_score: maxScore,
          submitted_at: new Date().toISOString(),
          last_edited_by: userId,
          last_edited_at: new Date().toISOString(),
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
  /** Prohlížení už uzavřeného odevzdání (po termínu nebo po vyčerpání pokusů). */
  const isReviewMode = isReadOnly && !!attempt;
  /**
   * Zobrazit žákovi i správné řešení? Učitel to může povolit v nastavení úlohy.
   * Pokud volba chybí, správné odpovědi se neukazují.
   */
  const revealCorrectAnswers = !!(
    (assignment?.settings as any)?.show_correct_answers ??
    (assignment?.settings as any)?.showCorrectAnswers
  );
  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== null).length;
  const progressPercent = items.length > 0 ? (answeredCount / items.length) * 100 : 0;
  const currentItem = items[currentIndex];

  /** Čitelný text odpovědi žáka pro prohlížení. */
  const formatStudentAnswer = (item: any, value: any): string => {
    if (value === undefined || value === null || value === "") return "Bez odpovědi";
    if (typeof value === "boolean") return value ? "Pravda" : "Nepravda";
    if (typeof value === "number" && Array.isArray(item?.choices)) {
      return item.choices[value] ?? String(value);
    }
    if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
    return String(value);
  };

  /** Správné řešení položky, pokud ho lze z dat zjistit. */
  const formatCorrectAnswer = (item: any): string | null => {
    if (item?.type === "mcq" && typeof item.correctIndex === "number") {
      return item.choices?.[item.correctIndex] ?? null;
    }
    if (item?.type === "true_false" && typeof item.isTrue === "boolean") {
      return item.isTrue ? "Pravda" : "Nepravda";
    }
    if (item?.correctAnswer !== undefined && item.correctAnswer !== null) {
      return Array.isArray(item.correctAnswer)
        ? item.correctAnswer.join(", ")
        : String(item.correctAnswer);
    }
    return null;
  };


  // Lockdown mode (bezpečný test)
  const lockdownEnabled = !!assignment?.lockdown_mode;
  const lockdown = useLockdownMode({
    enabled: lockdownEnabled,
    assignmentId: assignment?.id ?? null,
    studentId: userId,
    attemptId: attempt?.id ?? null,
    paused: isReadOnly,
  });
  const needsFullscreen = lockdownEnabled && !isReadOnly && !lockdown.isFullscreen;

  // End lockdown session on submit
  useEffect(() => {
    if (lockdownEnabled && attempt?.status === "submitted") {
      lockdown.endSession();
    }
  }, [lockdownEnabled, attempt?.status, lockdown]);

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

  if (noGroup) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center space-y-3">
              <Users className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm">
                Nejsi zařazen/a do žádné skupiny pro tento úkol, kontaktuj učitele.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
              </Button>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
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
      <main className="flex-1 container mx-auto px-4 pt-24 md:pt-28 pb-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold">{assignment.title}</h1>
              <ReadAloudButton
                text={`${assignment.title}. ${assignment.description || ""}`}
                size="icon"
              />
            </div>
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
              {assignment.is_portfolio_task
                ? "Odevzdáno"
                : `${attempt.score}/${attempt.max_score}`}
            </Badge>
          )}
        </div>

        {/* Skupinový úkol – spolužáci a kdo naposledy upravoval */}
        {myGroup && (
          <Card className="mb-4">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {myGroup.name}
                </Badge>
                {groupMemberNames.map((n) => (
                  <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                ))}
              </div>
              {lastEdited && (
                <p className="text-xs text-muted-foreground">
                  Naposledy upravil/a: {lastEdited.name} ·{" "}
                  {new Date(lastEdited.at).toLocaleString("cs-CZ")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Odevzdáváte společně – všichni pracujete na jednom odevzdání.
              </p>
            </CardContent>
          </Card>
        )}



        {/* Lockdown banner */}
        {lockdownEnabled && !isReadOnly && (
          <Card className="mb-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="p-3 flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Bezpečný testovací režim</p>
                <p className="text-amber-800 dark:text-amber-300">
                  Test musí běžet ve fullscreenu. Kopírování je blokováno. Opuštění stránky se nahlásí učiteli.
                  {lockdown.violationCount > 0 && (
                    <span className="ml-1 font-semibold">Porušení: {lockdown.violationCount}</span>
                  )}
                </p>
              </div>
              {!lockdown.isFullscreen && (
                <Button size="sm" variant="outline" onClick={lockdown.requestFullscreen}>
                  <Maximize className="w-3.5 h-3.5 mr-1" /> Fullscreen
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {needsFullscreen && (
          <Card className="mb-4 border-destructive">
            <CardContent className="p-6 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
              <h2 className="text-lg font-bold">Spustit bezpečný režim</h2>
              <p className="text-sm text-muted-foreground">
                Pro tento test je nutný fullscreen mód. Klikni na tlačítko a potvrď v prohlížeči.
              </p>
              <Button onClick={lockdown.requestFullscreen}>
                <Maximize className="w-4 h-4 mr-2" /> Spustit fullscreen a začít
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Propojená lekce z učebnice */}
        {linkedLesson && (
          <Card className="mb-4">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{linkedLesson.title}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(linkedLesson.url)}>
                <BookOpen className="w-4 h-4 mr-2" />
                Otevřít lekci
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Prohlížení uzavřeného úkolu – informace + přepínač pokusů */}
        {isReviewMode && (
          <Card className="mb-4 border-muted-foreground/30 bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">
                {isDeadlinePassed
                  ? "Termín už uplynul – tohle je tvoje odevzdané řešení, jen pro prohlížení."
                  : "Tohle je tvoje odevzdané řešení, jen pro prohlížení."}
              </p>
              {allAttempts.length > 1 && (
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Moje pokusy">
                  {[...allAttempts]
                    .sort((a, b) => a.attempt_number - b.attempt_number)
                    .map((a) => (
                      <Button
                        key={a.id}
                        size="sm"
                        role="tab"
                        aria-selected={a.id === attempt?.id}
                        variant={a.id === attempt?.id ? "default" : "outline"}
                        onClick={() => selectAttempt(a)}
                      >
                        Pokus {a.attempt_number}
                        {a.score != null && a.max_score != null && (
                          <span className="ml-1.5 text-xs opacity-80">
                            {a.score}/{a.max_score}
                          </span>
                        )}
                      </Button>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Po termínu bez jakéhokoli pokusu */}
        {isDeadlinePassed && !attempt && (
          <Card className="mb-4 border-destructive/40">
            <CardContent className="p-4 text-sm">
              Termín už uplynul a nemáš u tohoto úkolu žádné odevzdané řešení.
            </CardContent>
          </Card>
        )}


        {/* Celé zadání je společné pro všechny typy úkolů (pracovní list, aktivita i portfolio). */}
        {assignment.description && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Zadání</h2>
                <ReadAloudButton
                  text={assignment.description}
                  label="Přečíst zadání"
                  size="icon"
                />
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {assignment.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Materiály od učitele */}
        {parseMaterials(assignment.materials).length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <AssignmentMaterialsList materials={parseMaterials(assignment.materials)} />
            </CardContent>
          </Card>
        )}

        {/* Attachments uploader */}
        {userId && assignment && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <AttachmentsUploader
                assignmentId={assignment.id}
                studentId={userId}
                disabled={isReadOnly}
              />
            </CardContent>
          </Card>
        )}

        {/* Nepovinná poznámka / odpověď žáka */}
        {assignment && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-2">
              <label htmlFor="submission-note" className="text-sm font-medium">
                Tvoje poznámka / odpověď (nepovinné)
              </label>
              <Textarea
                id="submission-note"
                rows={3}
                value={note}
                disabled={isReadOnly}
                onChange={(e) => {
                  setNote(e.target.value);
                  scheduleAutosave();
                }}
                placeholder="Napiš, co je potřeba doplnit k odevzdání…"
              />
              <p className="text-xs text-muted-foreground">Poznámku uvidí tvůj učitel u odevzdání.</p>
            </CardContent>
          </Card>
        )}


        {/* Zpětná vazba od učitele k odevzdanému pokusu */}
        {attempt?.status === "submitted" &&
          (attempt.teacher_feedback_text || attempt.teacher_feedback_emoji) && (
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Zpětná vazba od učitele
                  {attempt.teacher_feedback_emoji && (
                    <span className="text-xl" aria-label="Reakce učitele">
                      {attempt.teacher_feedback_emoji}
                    </span>
                  )}
                </div>
                {attempt.teacher_feedback_text && (
                  <p className="whitespace-pre-wrap text-sm">{attempt.teacher_feedback_text}</p>
                )}
                {attempt.teacher_feedback_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(attempt.teacher_feedback_at).toLocaleString("cs-CZ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        {/* Portfolio task branch (upload-only, no quiz) */}
        {assignment.is_portfolio_task ? (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-end">
                {attempt?.status === "submitted" ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Úkol je odevzdaný a uložený v portfoliu
                  </div>
                ) : (
                  <Button
                    disabled={submitting || isReadOnly || !attempt}
                    onClick={async () => {
                      if (!attempt) return;
                      setSubmitting(true);
                      try {
                        // Poznámku uložíme ještě před odevzdáním, aby ji učitel viděl.
                        await supabase
                          .from("assignment_attempts" as any)
                          .update({
                            submission_note: note.trim() ? note : null,
                            last_edited_by: userId,
                            last_edited_at: new Date().toISOString(),
                          } as any)
                          .eq("id", attempt.id);
                        const { data, error } = await supabase.rpc("submit_portfolio_assignment", {
                          _attempt_id: attempt.id,
                        });
                        if (error) throw error;

                        const result = data as {
                          status?: string;
                          submitted_at?: string;
                          portfolio_item_id?: string;
                        } | null;
                        if (result?.status !== "submitted" || !result.portfolio_item_id) {
                          throw new Error("Odevzdání se nepodařilo úplně uložit. Zkuste to prosím znovu.");
                        }
                        setAttempt({ ...attempt, status: "submitted" });
                        toast({
                          title: "Odevzdáno!",
                          description: "Úkol je označený jako odevzdaný a přílohy jsou uložené v portfoliu.",
                        });
                      } catch (e: any) {
                        toast({
                          title: "Úkol se nepodařilo odevzdat",
                          description: e.message,
                          variant: "destructive",
                        });
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    <Send className="w-4 h-4 mr-1.5" /> Odevzdat úkol
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : worksheetSpec ? (
          <WorksheetPlayer
            key={attempt?.id ?? "no-attempt"}
            spec={worksheetSpec}
            variantId={worksheetSpec.variants[0]?.variantId ?? "A"}
            attemptId={attempt?.id ?? null}
            locked={isReadOnly}
            showResults={isReviewMode && revealCorrectAnswers}
            initialAnswers={(attempt?.answers as any) || {}}

            onSubmit={async (wAnswers, score, maxScore) => {
              if (!attempt) return;
              try {
                await supabase
                  .from("assignment_attempts" as any)
                  .update({
                    status: "submitted",
                    answers: wAnswers as any,
                    score,
                    max_score: maxScore,
                    submitted_at: new Date().toISOString(),
                    last_edited_by: userId,
                    last_edited_at: new Date().toISOString(),
                  } as any)
                  .eq("id", attempt.id);
                setAttempt({ ...attempt, status: "submitted", score, max_score: maxScore });
                toast({ title: "Odevzdáno!", description: `Skóre: ${score}/${maxScore}` });
              } catch (e: any) {
                toast({ title: "Chyba", description: e.message, variant: "destructive" });
              }
            }}
          />
        ) : (
          <>
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
          </>
        )}
      </main>
      {assignment && !isReadOnly && (
        <BezlaiTutorChat
          question={`${assignment.title}${assignment.description ? `\n\n${assignment.description}` : ""}`}
          contextKey={assignment.id}
        />
      )}
      <SiteFooter />
    </div>
  );
};

export default StudentAssignmentPlayer;
