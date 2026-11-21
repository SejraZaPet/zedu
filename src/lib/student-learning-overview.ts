import { supabase } from "@/integrations/supabase/client";
import { fetchStudentPracticeLessons, type PracticeLessonGroup, type PracticeLessonOption } from "@/lib/student-practice-lessons";
import { loadStudentAssignmentAttempts } from "@/lib/student-assignment-attempts";

export type MissionState = "done" | "now" | "bonus";
export type MissionAction = "quiz" | "material";

export interface LearningTopic extends PracticeLessonOption {
  masteryPercent: number;
  sessionsCount: number;
  mastered: boolean;
  lastPracticedAt: string | null;
}

export interface LearningMission {
  id: string;
  title: string;
  detail: string;
  state: MissionState;
  action: MissionAction;
  lessonId: string | null;
}

export interface NextLearningExam {
  id: string;
  title: string;
  deadline: string;
  days: number;
}

export interface StudentLearningOverview {
  xp: number;
  streakDays: number;
  todaySessions: number;
  dailyGoal: number;
  masteredCount: number;
  lessonGroups: PracticeLessonGroup[];
  topics: LearningTopic[];
  activeSubject: string | null;
  currentTopicId: string | null;
  lastLesson: PracticeLessonOption | null;
  weakLesson: LearningTopic | null;
  missions: LearningMission[];
  nextExam: NextLearningExam | null;
}

interface PracticeSessionRow {
  lesson_id: string | null;
  created_at: string;
}

interface MasteryRow {
  lesson_id: string;
  mastery_percent: number;
  sessions_count: number;
  mastered_at: string | null;
}

interface ExamRow {
  id: string;
  title: string;
  deadline: string;
}

export interface LearningOverviewInput {
  lessonGroups: PracticeLessonGroup[];
  sessions: PracticeSessionRow[];
  mastery: MasteryRow[];
  xp?: number | null;
  streakDays?: number | null;
  nextExam?: Omit<NextLearningExam, "days"> | null;
  now: Date;
}

function startOfLocalDay(value: Date): number {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function daysUntilLocalDay(iso: string, now: Date): number {
  return Math.max(0, Math.ceil((startOfLocalDay(new Date(iso)) - startOfLocalDay(now)) / 86_400_000));
}

export function examDayLabel(days: number): string {
  if (days === 0) return "Test je dnes";
  if (days === 1) return "Test je zítra";
  return `Test za ${days} ${days >= 2 && days <= 4 ? "dny" : "dní"}`;
}

/** Čisté sestavení mise a cesty; nemění žádná data ani neuděluje XP. */
export function buildLearningOverview(input: LearningOverviewInput): StudentLearningOverview {
  const flatLessons = input.lessonGroups.flatMap((group) => group.lessons);
  const lessonById = new Map(flatLessons.map((lesson) => [lesson.id, lesson]));
  const masteryByLesson = new Map(input.mastery.map((row) => [row.lesson_id, row]));
  const sortedSessions = [...input.sessions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastPracticeByLesson = new Map<string, string>();
  for (const session of sortedSessions) {
    if (session.lesson_id && !lastPracticeByLesson.has(session.lesson_id)) {
      lastPracticeByLesson.set(session.lesson_id, session.created_at);
    }
  }

  const topics = flatLessons.map((lesson): LearningTopic => {
    const mastery = masteryByLesson.get(lesson.id);
    return {
      ...lesson,
      masteryPercent: Number(mastery?.mastery_percent) || 0,
      sessionsCount: mastery?.sessions_count ?? 0,
      mastered: Boolean(mastery?.mastered_at),
      lastPracticedAt: lastPracticeByLesson.get(lesson.id) ?? null,
    };
  });
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const lastSessionLesson = sortedSessions.map((session) => session.lesson_id && lessonById.get(session.lesson_id)).find(Boolean) ?? null;
  const lastLesson = lastSessionLesson ?? flatLessons[0] ?? null;
  const activeSubject = lastLesson?.subject ?? flatLessons[0]?.subject ?? null;
  const activeTopics = topics.filter((topic) => topic.subject === activeSubject);
  const weakLesson = [...topics]
    .filter((topic) => topic.sessionsCount > 0 && !topic.mastered)
    .sort((a, b) => a.masteryPercent - b.masteryPercent || (b.lastPracticedAt ?? "").localeCompare(a.lastPracticedAt ?? ""))[0] ?? null;
  const currentTopic = (lastLesson && topicById.get(lastLesson.id) && !topicById.get(lastLesson.id)!.mastered
    ? topicById.get(lastLesson.id)
    : null)
    ?? activeTopics.find((topic) => topic.sessionsCount > 0 && !topic.mastered)
    ?? activeTopics.find((topic) => !topic.mastered)
    ?? null;

  const todayStart = startOfLocalDay(input.now);
  const todaySessions = sortedSessions.filter((session) => new Date(session.created_at).getTime() >= todayStart);
  const todayLessonIds = new Set(todaySessions.map((session) => session.lesson_id).filter(Boolean));
  const missions: LearningMission[] = [{
    id: "daily-practice",
    title: todaySessions.length > 0 ? "Dnešní procvičování je hotové" : "Dokonči jedno krátké procvičování",
    detail: todaySessions.length > 0 ? "Denní cíl máš splněný." : "Stačí jedno pětiminutové cvičení.",
    state: todaySessions.length > 0 ? "done" : "now",
    action: "quiz",
    lessonId: lastLesson?.id ?? null,
  }];

  if (lastLesson) {
    const lessonDone = todayLessonIds.has(lastLesson.id);
    missions.push({
      id: "last-lesson",
      title: `Rychlý kvíz: ${lastLesson.title}`,
      detail: lastLesson.subject,
      state: lessonDone ? "done" : todaySessions.length > 0 ? "now" : "bonus",
      action: "quiz",
      lessonId: lastLesson.id,
    });
  } else {
    missions.push({
      id: "own-material",
      title: "Procvič si vlastní poznámky",
      detail: "Vlož text nebo soubor, ze kterého se chceš naučit.",
      state: "bonus",
      action: "material",
      lessonId: null,
    });
  }

  if (weakLesson && weakLesson.id !== lastLesson?.id) {
    missions.push({
      id: "weak-topic",
      title: `Zopakuj slabé téma: ${weakLesson.title}`,
      detail: `${Math.round(weakLesson.masteryPercent)} % zvládnuto · zkus to znovu`,
      state: "bonus",
      action: "quiz",
      lessonId: weakLesson.id,
    });
  }

  return {
    xp: input.xp ?? 0,
    streakDays: input.streakDays ?? 0,
    todaySessions: todaySessions.length,
    dailyGoal: 1,
    masteredCount: topics.filter((topic) => topic.mastered).length,
    lessonGroups: input.lessonGroups,
    topics,
    activeSubject,
    currentTopicId: currentTopic?.id ?? null,
    lastLesson,
    weakLesson,
    missions: missions.slice(0, 3),
    nextExam: input.nextExam ? { ...input.nextExam, days: daysUntilLocalDay(input.nextExam.deadline, input.now) } : null,
  };
}

/** Jen existující vlastní čtení žáka; žádné zápisy, RPC ani nové datové zdroje. */
export async function loadStudentLearningOverview(userId: string, now = new Date(), cachedLessonGroups?: PracticeLessonGroup[]): Promise<StudentLearningOverview> {
  const examEnd = new Date(now);
  examEnd.setDate(examEnd.getDate() + 14);
  const [lessonGroups, sessionsResult, masteryResult, xpResult, examsResult] = await Promise.all([
    cachedLessonGroups === undefined ? fetchStudentPracticeLessons(userId) : Promise.resolve(cachedLessonGroups),
    supabase.from("student_practice_sessions")
      .select("lesson_id, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("student_lesson_mastery")
      .select("lesson_id, mastery_percent, sessions_count, mastered_at")
      .eq("student_id", userId),
    supabase.from("student_xp")
      .select("total_xp, streak_days")
      .eq("student_id", userId)
      .maybeSingle(),
    supabase.from("assignments")
      .select("id, title, deadline")
      .eq("status", "published")
      .in("exam_type", ["exam", "test"])
      .not("deadline", "is", null)
      .gte("deadline", now.toISOString())
      .lte("deadline", examEnd.toISOString())
      .order("deadline")
      .limit(20),
  ]);

  const examIds = ((examsResult.data ?? []) as ExamRow[]).map((exam) => exam.id);
  const attempts = await loadStudentAssignmentAttempts(userId, examIds);
  const submitted = new Set(attempts.filter((attempt) => attempt.status === "submitted").map((attempt) => attempt.assignment_id));
  const nextExam = ((examsResult.data ?? []) as ExamRow[]).find((exam) => exam.deadline && !submitted.has(exam.id)) ?? null;

  return buildLearningOverview({
    lessonGroups,
    sessions: (sessionsResult.data ?? []) as PracticeSessionRow[],
    mastery: (masteryResult.data ?? []) as MasteryRow[],
    xp: xpResult.data?.total_xp,
    streakDays: xpResult.data?.streak_days,
    nextExam,
    now,
  });
}
