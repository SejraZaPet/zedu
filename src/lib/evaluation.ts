import {
  bestActivityResults,
  bestAttemptsBy,
  resultRatio,
  type ActivityResultRow,
  type AttemptResultRow,
} from "@/lib/best-results";
import {
  splitStrengthsWeaknesses,
  summarizePerformance,
  type StrengthWeaknessRow,
} from "@/lib/strengths-weaknesses";

export const EVALUATION_LOW_DATA_THRESHOLD = 3;
export const EVALUATION_LOW_DATA_MESSAGE = "Málo dat, závěr je orientační";
export const EVALUATION_TREND_THRESHOLD = 5;

export interface EvaluationAssignment {
  id: string;
  title: string;
  lesson_id: string | null;
  lesson_source?: string | null;
  subjectKey: string;
  subjectLabel: string;
}

export interface EvaluationAttempt extends AttemptResultRow {
  id: string;
  assignment_id: string;
  student_id?: string;
}

export interface EvaluationActivity extends ActivityResultRow {
  lesson_id: string;
}

export interface EvaluationPractice {
  lesson_id: string;
  percent: number;
  created_at: string;
}

export interface EvaluationMastery {
  lesson_id: string;
  mastery_percent: number;
  sessions_count: number;
  mastered_at: string | null;
  updated_at?: string | null;
}

export interface EvaluationLesson {
  id: string;
  title: string;
  topicTitle?: string | null;
  subjectKey: string;
  subjectLabel: string;
  source?: string | null;
}

export type EvaluationTrend = "improving" | "stable" | "declining" | "unknown";

export interface EvaluationTopic {
  key: string;
  label: string;
  topicTitle: string | null;
  lessonId: string | null;
  lessonSource: string | null;
  subjectKey: string;
  subjectLabel: string;
  successPct: number | null;
  evidenceCount: number;
  attemptCount: number;
  firstPct: number | null;
  bestPct: number | null;
  masteryPct: number | null;
  trend: EvaluationTrend;
  trendDelta: number | null;
  category: StrengthWeaknessRow["category"];
  lastDataAt: string | null;
}

export interface StudentEvaluation {
  topics: EvaluationTopic[];
  strong: EvaluationTopic[];
  weak: EvaluationTopic[];
  evidenceCount: number;
  successPct: number | null;
  lowData: boolean;
  summary: string;
  lastDataAt: string | null;
}

export interface EvaluationInput {
  assignments: EvaluationAssignment[];
  attempts: EvaluationAttempt[];
  activities: EvaluationActivity[];
  practice: EvaluationPractice[];
  mastery: EvaluationMastery[];
  lessons?: EvaluationLesson[];
}

interface Evidence {
  ratio: number;
  at: string | null;
}

interface TopicAccumulator {
  topic: Omit<EvaluationTopic, "successPct" | "evidenceCount" | "attemptCount" | "firstPct" | "bestPct" | "masteryPct" | "trend" | "trendDelta" | "category" | "lastDataAt">;
  best: Evidence[];
  all: Evidence[];
  masteryPct: number | null;
}

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value));
const validPercent = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 100;
const timeOf = (value: string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};
const average = (values: number[]): number | null => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

export function evaluationLessonKey(lessonId: string): string {
  return `lesson:${lessonId}`;
}

export function evaluationSubjectKey(subjectKey: string): string {
  return `subject:${subjectKey}`;
}

function topicAccumulator(
  map: Map<string, TopicAccumulator>,
  key: string,
  topic: TopicAccumulator["topic"],
): TopicAccumulator {
  const existing = map.get(key);
  if (existing) return existing;
  const created: TopicAccumulator = { topic, best: [], all: [], masteryPct: null };
  map.set(key, created);
  return created;
}

function lessonTopic(lesson: EvaluationLesson): TopicAccumulator["topic"] {
  return {
    key: evaluationLessonKey(lesson.id),
    label: lesson.title || "Lekce",
    topicTitle: lesson.topicTitle ?? null,
    lessonId: lesson.id,
    lessonSource: lesson.source ?? null,
    subjectKey: lesson.subjectKey,
    subjectLabel: lesson.subjectLabel,
  };
}

function addEvidence(accumulator: TopicAccumulator, evidence: Evidence, countsAsBest = true): void {
  if (!Number.isFinite(evidence.ratio)) return;
  const normalized = { ...evidence, ratio: clampRatio(evidence.ratio) };
  accumulator.all.push(normalized);
  if (countsAsBest) accumulator.best.push(normalized);
}

function calculateTrend(evidence: Evidence[]): Pick<EvaluationTopic, "trend" | "trendDelta"> {
  const dated = evidence.filter((item) => timeOf(item.at) > 0).sort((a, b) => timeOf(a.at) - timeOf(b.at));
  if (dated.length < 2) return { trend: "unknown", trendDelta: null };
  const middle = Math.floor(dated.length / 2);
  const earlier = average(dated.slice(0, middle).map((item) => item.ratio));
  const recent = average(dated.slice(middle).map((item) => item.ratio));
  if (earlier === null || recent === null) return { trend: "unknown", trendDelta: null };
  const delta = Math.round((recent - earlier) * 100);
  return {
    trend: Math.abs(delta) < EVALUATION_TREND_THRESHOLD ? "stable" : delta > 0 ? "improving" : "declining",
    trendDelta: delta,
  };
}

export function evaluationTrendLabel(trend: EvaluationTrend): string {
  if (trend === "improving") return "zlepšuje se";
  if (trend === "declining") return "potřebuje pozornost";
  if (trend === "stable") return "stabilní";
  return "zatím bez trendu";
}

function formatSummary(topics: EvaluationTopic[], evidenceCount: number, successPct: number | null): string {
  if (evidenceCount === 0 || successPct === null) return "Zatím nejsou dostupné výsledky, ze kterých by šlo vytvořit souhrn.";
  const prefix = evidenceCount >= 2 && evidenceCount <= 4 ? "Ze" : "Z";
  const parts = [`${prefix} ${evidenceCount} ${evidenceCount === 1 ? "podkladu" : "podkladů"} vychází orientační úspěšnost ${successPct} %.`];
  const strong = topics.filter((topic) => topic.category === "strong").sort((a, b) => (b.successPct ?? 0) - (a.successPct ?? 0));
  const weak = topics.filter((topic) => topic.category === "weak").sort((a, b) => (a.successPct ?? 0) - (b.successPct ?? 0));
  if (strong.length) parts.push(`Silná témata: ${strong.slice(0, 2).map((topic) => topic.label).join(", ")}.`);
  if (weak.length) parts.push(`Více pozornosti potřebuje: ${weak.slice(0, 2).map((topic) => topic.label).join(", ")}.`);
  if (!strong.length && !weak.length) parts.push("Výsledky jsou zatím vyrovnané bez výrazně silného nebo slabého tématu.");
  if (evidenceCount < EVALUATION_LOW_DATA_THRESHOLD) parts.push(`${EVALUATION_LOW_DATA_MESSAGE}.`);
  return parts.join(" ");
}

/**
 * Čisté interní vyhodnocení jednoho žáka. Nejlepší odevzdané pokusy a aktivity
 * sdílí pravidla se stávajícími Výsledky; nic neukládá a nepracuje se jmény.
 */
export function buildStudentEvaluation(input: EvaluationInput): StudentEvaluation {
  const map = new Map<string, TopicAccumulator>();
  const assignmentById = new Map(input.assignments.map((assignment) => [assignment.id, assignment]));
  const lessonById = new Map((input.lessons ?? []).map((lesson) => [lesson.id, lesson]));

  for (const assignment of input.assignments) {
    if (assignment.lesson_id) {
      const lesson = lessonById.get(assignment.lesson_id);
      const key = evaluationLessonKey(assignment.lesson_id);
      topicAccumulator(map, key, lessonTopic(lesson ?? {
        id: assignment.lesson_id,
        title: assignment.title,
        subjectKey: assignment.subjectKey,
        subjectLabel: assignment.subjectLabel,
        source: assignment.lesson_source,
      }));
    } else {
      const key = evaluationSubjectKey(assignment.subjectKey);
      topicAccumulator(map, key, {
        key,
        label: "Úkoly bez navázané lekce",
        topicTitle: null,
        lessonId: null,
        lessonSource: null,
        subjectKey: assignment.subjectKey,
        subjectLabel: assignment.subjectLabel,
      });
    }
  }

  const submitted = input.attempts.filter((attempt) => attempt.status === "submitted" && assignmentById.has(attempt.assignment_id));
  const bestAttempts = bestAttemptsBy(submitted, (attempt) => attempt.assignment_id);
  for (const attempt of submitted) {
    const ratio = resultRatio(attempt);
    if (ratio === null) continue;
    const assignment = assignmentById.get(attempt.assignment_id)!;
    const key = assignment.lesson_id ? evaluationLessonKey(assignment.lesson_id) : evaluationSubjectKey(assignment.subjectKey);
    const accumulator = map.get(key);
    if (!accumulator) continue;
    const isBest = bestAttempts.get(assignment.id)?.id === (attempt as EvaluationAttempt & { id?: string }).id;
    addEvidence(accumulator, { ratio, at: attempt.submitted_at ?? null }, isBest);
  }

  const activityByLesson = new Map<string, EvaluationActivity[]>();
  for (const activity of input.activities) {
    if (!activity.lesson_id) continue;
    activityByLesson.set(activity.lesson_id, [...(activityByLesson.get(activity.lesson_id) ?? []), activity]);
  }
  for (const [lessonId, rows] of activityByLesson) {
    const lesson = lessonById.get(lessonId);
    if (!lesson && !map.has(evaluationLessonKey(lessonId))) continue;
    const accumulator = topicAccumulator(map, evaluationLessonKey(lessonId), lessonTopic(lesson ?? {
      id: lessonId,
      title: "Lekce",
      subjectKey: "unknown",
      subjectLabel: "Ostatní",
    }));
    const best = bestActivityResults(rows);
    for (const row of rows) {
      const ratio = resultRatio(row);
      if (ratio === null) continue;
      addEvidence(accumulator, { ratio, at: row.completed_at ?? null }, best.get(row.activity_index) === row);
    }
  }

  for (const row of input.practice) {
    if (!validPercent(row.percent)) continue;
    const lesson = lessonById.get(row.lesson_id);
    if (!lesson && !map.has(evaluationLessonKey(row.lesson_id))) continue;
    const accumulator = topicAccumulator(map, evaluationLessonKey(row.lesson_id), lessonTopic(lesson ?? {
      id: row.lesson_id,
      title: "Lekce",
      subjectKey: "unknown",
      subjectLabel: "Ostatní",
    }));
    addEvidence(accumulator, { ratio: row.percent / 100, at: row.created_at });
  }

  for (const row of input.mastery) {
    if (!validPercent(row.mastery_percent)) continue;
    const lesson = lessonById.get(row.lesson_id);
    if (!lesson && !map.has(evaluationLessonKey(row.lesson_id))) continue;
    const accumulator = topicAccumulator(map, evaluationLessonKey(row.lesson_id), lessonTopic(lesson ?? {
      id: row.lesson_id,
      title: "Lekce",
      subjectKey: "unknown",
      subjectLabel: "Ostatní",
    }));
    const at = row.updated_at ?? row.mastered_at;
    addEvidence(accumulator, { ratio: row.mastery_percent / 100, at }, true);
    accumulator.masteryPct = Math.round(row.mastery_percent);
  }

  const performance = new Map<string, StrengthWeaknessRow>();
  const topics = [...map.values()].filter((accumulator) => accumulator.best.length > 0).map((accumulator): EvaluationTopic => {
    const success = average(accumulator.best.map((item) => item.ratio));
    const successPct = success === null ? null : Math.round(success * 100);
    const base = summarizePerformance({
      key: accumulator.topic.key,
      label: accumulator.topic.label,
    }, [{
      learnerId: "student",
      attempts: accumulator.all.map((item, index) => ({ correctRatio: item.ratio, order: timeOf(item.at) || index, completedAt: item.at })),
    }]);
    const category = successPct === null ? "other" : successPct >= 75 ? "strong" : successPct < 50 ? "weak" : "other";
    performance.set(accumulator.topic.key, { ...base, category });
    const lastDataAt = accumulator.all.reduce<string | null>((latest, item) => timeOf(item.at) > timeOf(latest) ? item.at : latest, null);
    return {
      ...accumulator.topic,
      successPct,
      evidenceCount: accumulator.best.length,
      attemptCount: accumulator.all.length,
      firstPct: base.firstPct,
      bestPct: base.bestPct,
      masteryPct: accumulator.masteryPct,
      ...calculateTrend(accumulator.all),
      category,
      lastDataAt,
    };
  }).sort((a, b) => a.label.localeCompare(b.label, "cs"));

  const split = splitStrengthsWeaknesses([...performance.values()]);
  const topicByKey = new Map(topics.map((topic) => [topic.key, topic]));
  const strong = split.strong.map((row) => topicByKey.get(row.key)).filter((topic): topic is EvaluationTopic => Boolean(topic));
  const weak = split.weak.map((row) => topicByKey.get(row.key)).filter((topic): topic is EvaluationTopic => Boolean(topic));
  const evidenceCount = topics.reduce((sum, topic) => sum + topic.evidenceCount, 0);
  const overallValues = topics.flatMap((topic) => topic.successPct === null ? [] : [topic.successPct]);
  const successPct = average(overallValues) === null ? null : Math.round(average(overallValues)!);
  const lastDataAt = topics.reduce<string | null>((latest, topic) => timeOf(topic.lastDataAt) > timeOf(latest) ? topic.lastDataAt : latest, null);
  return {
    topics,
    strong,
    weak,
    evidenceCount,
    successPct,
    lowData: evidenceCount > 0 && evidenceCount < EVALUATION_LOW_DATA_THRESHOLD,
    summary: formatSummary(topics, evidenceCount, successPct),
    lastDataAt,
  };
}

/** Do AI jdou pouze tato čísla a názvy vybraných témat, nikdy identita žáka. */
export function evaluationAiCandidates(evaluation: StudentEvaluation, limit = 12): EvaluationTopic[] {
  return [...evaluation.topics]
    .filter((topic) => topic.evidenceCount > 0)
    .sort((a, b) => (a.successPct ?? 101) - (b.successPct ?? 101) || b.evidenceCount - a.evidenceCount || a.label.localeCompare(b.label, "cs"))
    .slice(0, Math.max(0, Math.min(12, limit)));
}

export function evaluationPracticeHref(topic: Pick<EvaluationTopic, "lessonId">): string {
  return topic.lessonId
    ? `/student/metody/5p/procviceni?lesson=${encodeURIComponent(topic.lessonId)}&min=10`
    : "/student/metody";
}

export function evaluationHasNewData(evaluation: StudentEvaluation, basedOn: string): boolean {
  return timeOf(evaluation.lastDataAt) > timeOf(basedOn);
}
