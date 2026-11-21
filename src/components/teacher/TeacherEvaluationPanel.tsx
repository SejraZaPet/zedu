import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpenCheck,
  Clipboard,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import AiContentBadge from "@/components/ai/AiContentBadge";
import {
  ALL_SCOPE,
  assignmentInScope,
  classScope,
  groupScope,
  groupsFullyInClass,
} from "@/lib/results-filters";
import {
  buildStudentEvaluation,
  evaluationAiCandidates,
  evaluationHasNewData,
  evaluationTrendLabel,
  type EvaluationTopic,
  type StudentEvaluation,
} from "@/lib/evaluation";
import {
  loadTeacherEvaluationBase,
  loadTeacherEvaluationDetail,
  teacherEvaluationTargets,
  type TeacherEvaluationAssignment,
} from "@/lib/teacher-evaluation";

interface TeacherEvaluationPanelProps {
  defaultScope?: string;
  defaultSubject?: string;
  fixedScope?: string;
  fixedStudentId?: string;
}

interface RepetitionSuggestion {
  key: string;
  title: string;
  reason: string;
  practiceHref: string;
}

interface RepetitionResult {
  basedOn: string;
  suggestions: RepetitionSuggestion[];
}

const studentName = (profiles: Record<string, { first_name: string; last_name: string }>, id: string): string => {
  const profile = profiles[id];
  return profile ? `${profile.first_name} ${profile.last_name}`.trim() || "Žák" : "Žák";
};

function allowedAiCandidates(evaluation: StudentEvaluation, assignments: TeacherEvaluationAssignment[]): EvaluationTopic[] {
  const allowed = new Set(assignments.flatMap((assignment) => assignment.lesson_id
    ? [`lesson:${assignment.lesson_id}`]
    : [`subject:${assignment.subjectKey}`]));
  return evaluationAiCandidates(evaluation).filter((topic) => allowed.has(topic.key));
}

function TopicList({ title, topics, empty }: { title: string; topics: EvaluationTopic[]; empty: string }) {
  return <section aria-label={title} className="space-y-2">
    <h3 className="text-sm font-semibold">{title}</h3>
    {topics.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2">
      {topics.map((topic) => <li key={topic.key} className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{topic.label}</p>
            <p className="text-xs text-muted-foreground">{topic.subjectLabel}{topic.topicTitle ? ` · ${topic.topicTitle}` : ""}</p>
          </div>
          <Badge variant={topic.category === "weak" ? "destructive" : "secondary"}>{topic.successPct ?? "–"} %</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Podklady: {topic.evidenceCount}</span>
          <span>Výsledky v čase: {topic.attemptCount}</span>
          {topic.masteryPct !== null && <span>Zvládnuto {topic.masteryPct} %</span>}
          <span className="inline-flex items-center gap-1">
            {topic.trend === "improving" && <TrendingUp className="h-3.5 w-3.5" aria-hidden />}
            {topic.trend === "declining" && <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            {evaluationTrendLabel(topic.trend)}{topic.trendDelta !== null && topic.trend !== "stable" ? ` (${topic.trendDelta > 0 ? "+" : ""}${topic.trendDelta} p. b.)` : ""}
          </span>
        </div>
      </li>)}
    </ul>}
  </section>;
}

/** Interní učitelský panel. Nemá žádný zápis ani žákovskou/rodičovskou variantu. */
export default function TeacherEvaluationPanel({
  defaultScope = ALL_SCOPE,
  defaultSubject = ALL_SCOPE,
  fixedScope,
  fixedStudentId,
}: TeacherEvaluationPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scope, setScope] = useState(fixedScope ?? defaultScope);
  const [subject, setSubject] = useState(defaultSubject);
  const [studentId, setStudentId] = useState(fixedStudentId ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [repetition, setRepetition] = useState<RepetitionResult | null>(null);

  useEffect(() => { if (fixedScope) setScope(fixedScope); else setScope(defaultScope); }, [defaultScope, fixedScope]);
  useEffect(() => { setSubject(defaultSubject); }, [defaultSubject]);
  useEffect(() => { if (fixedStudentId) setStudentId(fixedStudentId); }, [fixedStudentId]);

  const baseQuery = useQuery({
    queryKey: ["teacher-evaluation-base", user?.id],
    queryFn: () => loadTeacherEvaluationBase(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const base = baseQuery.data;
  const groupToClass = useMemo(() => groupsFullyInClass(base?.groupMembers ?? [], base?.classMembers ?? []), [base]);
  const scopedAssignments = useMemo(() => (base?.assignments ?? []).filter((assignment) => assignmentInScope(assignment, scope, groupToClass)), [base, scope, groupToClass]);
  const availableSubjects = useMemo(() => [...new Map(scopedAssignments.map((assignment) => [assignment.subjectKey, assignment.subjectLabel])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs")), [scopedAssignments]);

  useEffect(() => {
    if (!base) return;
    if (subject !== ALL_SCOPE && !availableSubjects.some((option) => option.value === subject)) setSubject(ALL_SCOPE);
  }, [availableSubjects, base, subject]);

  const subjectAssignments = useMemo(() => scopedAssignments.filter((assignment) => subject === ALL_SCOPE || assignment.subjectKey === subject), [scopedAssignments, subject]);
  const studentIds = useMemo(() => base ? [...new Set(subjectAssignments.flatMap((assignment) => teacherEvaluationTargets(assignment, base)))].sort((a, b) =>
    studentName(base.profiles, a).localeCompare(studentName(base.profiles, b), "cs")) : [], [base, subjectAssignments]);

  useEffect(() => {
    if (fixedStudentId) return;
    if (!studentIds.includes(studentId)) setStudentId(studentIds[0] ?? "");
  }, [fixedStudentId, studentId, studentIds]);

  const selectedAssignments = useMemo(() => {
    if (!base || !studentId) return [];
    return subjectAssignments.filter((assignment) => teacherEvaluationTargets(assignment, base).includes(studentId));
  }, [base, studentId, subjectAssignments]);
  const selectedAssignmentIds = useMemo(() => selectedAssignments.map((assignment) => assignment.id).sort(), [selectedAssignments]);

  const evaluationQuery = useQuery({
    queryKey: ["teacher-evaluation-student", user?.id, studentId, selectedAssignmentIds],
    queryFn: async () => {
      const detail = await loadTeacherEvaluationDetail(studentId, selectedAssignments);
      return buildStudentEvaluation({ assignments: selectedAssignments, ...detail });
    },
    enabled: Boolean(user?.id && studentId && selectedAssignments.length),
    staleTime: 5_000,
  });
  const evaluation = evaluationQuery.data;

  useEffect(() => {
    setRepetition(null);
    setAiError(null);
  }, [studentId, subject, scope]);

  const selectedSubject = availableSubjects.find((option) => option.value === subject);
  const aiCandidates = evaluation ? allowedAiCandidates(evaluation, selectedAssignments) : [];
  const aiDisabledReason = subject === ALL_SCOPE
    ? "Pro AI návrh vyberte jeden předmět."
    : aiCandidates.length < 3
      ? "Pro AI návrh jsou potřeba alespoň tři ohodnocená témata z vašich úkolů."
      : null;
  const dataChanged = Boolean(repetition && evaluation && evaluationHasNewData(evaluation, repetition.basedOn));

  const suggestRepetition = async () => {
    if (!evaluation || aiDisabledReason) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const fresh = await evaluationQuery.refetch();
      const currentEvaluation = fresh.data ?? evaluation;
      const currentCandidates = allowedAiCandidates(currentEvaluation, selectedAssignments);
      if (currentCandidates.length < 3) throw new Error("Pro návrh už nejsou alespoň tři ohodnocená témata.");
      const basedOn = currentEvaluation.lastDataAt ?? new Date().toISOString();
      const { data, error } = await supabase.functions.invoke("suggest-evaluation-repetition", {
        body: {
          studentId,
          subjectKey: subject,
          subjectLabel: selectedSubject?.label ?? "Předmět",
          basedOn,
          topics: currentCandidates.map((topic) => ({
            key: topic.key,
            label: topic.label,
            successPct: topic.successPct,
            evidenceCount: topic.evidenceCount,
            attemptCount: topic.attemptCount,
            trendDelta: topic.trendDelta,
          })),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Návrh se nepodařilo vytvořit.");
      if (!Array.isArray(data?.suggestions)) throw new Error("AI nevrátila použitelný návrh.");
      setRepetition({ basedOn: data.basedOn ?? basedOn, suggestions: data.suggestions });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Návrh se nepodařilo vytvořit. Zkuste to znovu.");
    } finally {
      setAiLoading(false);
    }
  };

  const copyRepetition = async () => {
    if (!repetition) return;
    const text = repetition.suggestions.map((item, index) => `${index + 1}. ${item.title}\n${item.reason}\n${item.practiceHref}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(`Co opakovat\n\n${text}`);
      toast({ title: "Návrh je zkopírovaný", description: "Nic se neuložilo." });
    } catch {
      toast({ title: "Kopírování se nepodařilo", description: "Označte text a zkopírujte ho ručně.", variant: "destructive" });
    }
  };

  if (!user) return null;
  return <Card className="mb-6 border-primary/20" data-testid="teacher-evaluation-panel">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5 text-primary" aria-hidden />Vyhodnocení</CardTitle>
          <CardDescription>Interní přehled pouze pro učitele. Žák ani rodič ho nevidí.</CardDescription>
        </div>
        <Badge variant="outline"><BookOpenCheck className="mr-1 h-3.5 w-3.5" aria-hidden />Bez automatického ukládání</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      {baseQuery.isPending ? <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Načítám žáky a předměty…</p>
        : baseQuery.isError ? <Alert variant="destructive"><AlertCircle aria-hidden /><AlertTitle>Podklady se nepodařilo načíst</AlertTitle><AlertDescription className="space-y-3"><p>Zkuste načtení zopakovat.</p><Button type="button" variant="outline" onClick={() => void baseQuery.refetch()}>Zkusit znovu</Button></AlertDescription></Alert>
          : !base?.assignments.length ? <p className="text-sm text-muted-foreground">Vyhodnocení se zpřístupní po zadání prvního úkolu.</p>
            : <>
              <div className={`grid gap-3 ${fixedStudentId || fixedScope ? "sm:grid-cols-1" : "lg:grid-cols-3"}`}>
                {!fixedScope && <div><label htmlFor="evaluation-scope" className="text-sm font-medium">Třída nebo skupina</label><SearchableSelect id="evaluation-scope" label="Hledat třídu nebo skupinu" triggerLabel="Třída nebo skupina" value={scope} onValueChange={setScope} options={[
                  { value: ALL_SCOPE, label: "Všechny třídy a skupiny", pinned: true },
                  ...(base.classes ?? []).map((item) => ({ value: classScope(item.id), label: item.name, group: "Třídy" })),
                  ...(base.groups ?? []).map((item) => ({ value: groupScope(item.id), label: item.name, group: "Skupiny" })),
                ]} /></div>}
                <div><label htmlFor="evaluation-subject" className="text-sm font-medium">Předmět</label><SearchableSelect id="evaluation-subject" label="Hledat předmět" triggerLabel="Předmět" value={subject} onValueChange={setSubject} options={[
                  { value: ALL_SCOPE, label: "Všechny předměty", pinned: true },
                  ...availableSubjects,
                ]} /></div>
                {!fixedStudentId && <div><label htmlFor="evaluation-student" className="text-sm font-medium">Žák</label><SearchableSelect id="evaluation-student" label="Hledat žáka" triggerLabel="Žák" value={studentId} onValueChange={setStudentId} options={studentIds.map((id) => ({ value: id, label: studentName(base.profiles, id) }))} emptyMessage="V tomto výběru nemáte žáka s vlastním úkolem." /></div>}
              </div>

              {!studentId || !selectedAssignments.length ? <p className="text-sm text-muted-foreground">Vyberte žáka a předmět s alespoň jedním vaším úkolem.</p>
                : evaluationQuery.isPending ? <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Počítám vyhodnocení…</p>
                  : evaluationQuery.isError ? <Alert variant="destructive"><AlertCircle aria-hidden /><AlertTitle>Výsledky žáka se nepodařilo načíst</AlertTitle><AlertDescription className="space-y-3"><p>Zkuste to prosím znovu. Nic se nezměnilo.</p><Button type="button" variant="outline" onClick={() => void evaluationQuery.refetch()}>Zkusit znovu</Button></AlertDescription></Alert>
                    : evaluation && <>
                      <div className="rounded-lg bg-muted/50 p-4">
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                          <span><strong>Orientační úspěšnost:</strong> {evaluation.successPct === null ? "–" : `${evaluation.successPct} %`}</span>
                          <span><strong>Podklady:</strong> {evaluation.evidenceCount}</span>
                          <span><strong>Poslední data:</strong> {evaluation.lastDataAt ? new Date(evaluation.lastDataAt).toLocaleDateString("cs-CZ") : "–"}</span>
                        </div>
                        <p className="mt-2 text-sm">{evaluation.summary}</p>
                      </div>
                      {evaluation.lowData && <Alert><AlertCircle className="h-4 w-4" aria-hidden /><AlertTitle>Málo dat, závěr je orientační</AlertTitle><AlertDescription>Doplňte závěr vlastní znalostí žáka a dalším pozorováním.</AlertDescription></Alert>}
                      <div className="grid gap-5 lg:grid-cols-2">
                        <TopicList title="Silné stránky po tématech" topics={evaluation.strong.slice(0, 5)} empty="Zatím žádné téma s úspěšností aspoň 75 %." />
                        <TopicList title="Slabé stránky po tématech" topics={evaluation.weak.slice(0, 5)} empty="Zatím žádné téma s úspěšností pod 50 %." />
                      </div>

                      <section aria-labelledby="evaluation-repetition-title" className="space-y-3 rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><h3 id="evaluation-repetition-title" className="font-semibold">Co opakovat</h3><p className="text-sm text-muted-foreground">AI navrhne 3–5 témata jen z výše uvedených podkladů. Návrh se nikam neukládá.</p></div>
                          <Button type="button" className="min-h-11" disabled={Boolean(aiDisabledReason) || aiLoading} onClick={() => void suggestRepetition()}>
                            {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="mr-2 h-4 w-4" aria-hidden />}
                            {repetition || dataChanged ? "Navrhnout znovu" : "Navrhnout, co opakovat"}
                          </Button>
                        </div>
                        {aiDisabledReason && <p className="text-sm text-muted-foreground">{aiDisabledReason}</p>}
                        {aiError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" aria-hidden /><AlertTitle>Návrh se nepodařil</AlertTitle><AlertDescription>{aiError}</AlertDescription></Alert>}
                        {dataChanged && <Alert><RefreshCw className="h-4 w-4" aria-hidden /><AlertTitle>Data se změnila, navrhni znovu</AlertTitle><AlertDescription>Po posledním návrhu přibyl nový výsledek nebo procvičování.</AlertDescription></Alert>}
                        {repetition && <div className="space-y-3" data-testid="evaluation-ai-result">
                          <div className="flex flex-wrap items-center justify-between gap-2"><AiContentBadge aiGenerated /><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void copyRepetition()}><Clipboard className="mr-1 h-4 w-4" aria-hidden />Kopírovat</Button><Button type="button" size="sm" variant="ghost" aria-label="Zavřít návrh" onClick={() => setRepetition(null)}><X className="h-4 w-4" aria-hidden /></Button></div></div>
                          <ol className="space-y-2">{repetition.suggestions.map((item) => <li key={item.key} className="rounded-lg bg-muted/40 p-3">
                            <p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                            <a className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4" href={item.practiceHref}>Otevřít procvičování</a>
                          </li>)}</ol>
                          <p className="text-xs text-muted-foreground">Dočasný AI návrh. Před použitím ho zkontrolujte; žák ani rodič ho nevidí.</p>
                        </div>}
                      </section>
                    </>}
            </>}
    </CardContent>
  </Card>;
}
