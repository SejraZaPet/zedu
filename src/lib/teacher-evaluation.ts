import { supabase } from "@/integrations/supabase/client";
import { submittableOnly } from "@/lib/assignment-kind";
import { effectiveRecipients, fetchRecipientsMap } from "@/lib/assignment-recipients";
import { NO_SUBJECT, NO_SUBJECT_LABEL, subjectKey } from "@/lib/results-filters";
import { practiceSubjectLabel } from "@/lib/student-practice-lessons";
import type {
  EvaluationActivity,
  EvaluationAssignment,
  EvaluationAttempt,
  EvaluationLesson,
  EvaluationMastery,
  EvaluationPractice,
} from "@/lib/evaluation";

export interface TeacherEvaluationAssignment extends EvaluationAssignment {
  class_id: string | null;
  group_id: string | null;
  lesson_plan_id: string | null;
  status: string | null;
}

export interface TeacherEvaluationBase {
  assignments: TeacherEvaluationAssignment[];
  classes: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  classMembers: Array<{ class_id: string; user_id: string }>;
  groupMembers: Array<{ group_id: string; student_id: string }>;
  recipientsMap: Record<string, string[]>;
  profiles: Record<string, { first_name: string; last_name: string }>;
}

export interface TeacherEvaluationDetail {
  attempts: EvaluationAttempt[];
  activities: EvaluationActivity[];
  practice: EvaluationPractice[];
  mastery: EvaluationMastery[];
  lessons: EvaluationLesson[];
}

const throwOnError = (result: { error: unknown }): void => {
  if (result.error) throw result.error;
};

export function teacherEvaluationTargets(
  assignment: Pick<TeacherEvaluationAssignment, "id" | "class_id" | "group_id">,
  base: Pick<TeacherEvaluationBase, "classMembers" | "groupMembers" | "recipientsMap">,
): string[] {
  const members = assignment.class_id
    ? base.classMembers.filter((member) => member.class_id === assignment.class_id).map((member) => member.user_id)
    : assignment.group_id
      ? base.groupMembers.filter((member) => member.group_id === assignment.group_id).map((member) => member.student_id)
      : [];
  return effectiveRecipients(members, base.recipientsMap[assignment.id]);
}

/** Načte jen úkoly přihlášeného učitele a jejich skutečné příjemce. */
export async function loadTeacherEvaluationBase(teacherId: string): Promise<TeacherEvaluationBase> {
  const assignmentResult = await supabase.from("assignments")
    .select("id, title, class_id, group_id, subject_id, lesson_plan_id, lesson_id, lesson_source, status, settings")
    .eq("teacher_id", teacherId);
  throwOnError(assignmentResult);
  const rawAssignments = submittableOnly((assignmentResult.data ?? []) as any[]);
  const classIds = [...new Set(rawAssignments.map((row) => row.class_id).filter(Boolean))] as string[];
  const groupIds = [...new Set(rawAssignments.map((row) => row.group_id).filter(Boolean))] as string[];
  const subjectIds = [...new Set(rawAssignments.map((row) => row.subject_id).filter(Boolean))] as string[];
  const planIds = [...new Set(rawAssignments.map((row) => row.lesson_plan_id).filter(Boolean))] as string[];

  const [classResult, groupResult, classMemberResult, groupMemberResult, subjectResult, planResult, recipientsMap] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    groupIds.length ? supabase.from("subject_groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [], error: null }),
    classIds.length ? supabase.from("class_members").select("class_id, user_id").in("class_id", classIds) : Promise.resolve({ data: [], error: null }),
    groupIds.length ? supabase.from("subject_group_members").select("group_id, student_id").in("group_id", groupIds) : Promise.resolve({ data: [], error: null }),
    subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
    planIds.length ? supabase.from("lesson_plans").select("id, subject").in("id", planIds) : Promise.resolve({ data: [], error: null }),
    fetchRecipientsMap(rawAssignments.map((row) => row.id)),
  ]);
  [classResult, groupResult, classMemberResult, groupMemberResult, subjectResult, planResult].forEach(throwOnError);

  const subjectNames = new Map(((subjectResult.data ?? []) as any[]).map((subject) => [subject.id, subject.name]));
  const planSubjects = new Map(((planResult.data ?? []) as any[]).map((plan) => [plan.id, plan.subject]));
  const assignments: TeacherEvaluationAssignment[] = rawAssignments.map((row) => {
    const subjectLabel = (row.subject_id && subjectNames.get(row.subject_id))
      || (row.lesson_plan_id && planSubjects.get(row.lesson_plan_id))
      || null;
    const enriched = { ...row, subject: subjectLabel };
    return {
      id: row.id,
      title: row.title || "Úkol",
      class_id: row.class_id ?? null,
      group_id: row.group_id ?? null,
      lesson_plan_id: row.lesson_plan_id ?? null,
      lesson_id: row.lesson_id ?? null,
      lesson_source: row.lesson_source ?? null,
      status: row.status ?? null,
      subjectKey: subjectKey(enriched),
      subjectLabel: subjectLabel?.trim() || NO_SUBJECT_LABEL,
    };
  });

  const classMembers = (classMemberResult.data ?? []) as Array<{ class_id: string; user_id: string }>;
  const groupMembers = (groupMemberResult.data ?? []) as Array<{ group_id: string; student_id: string }>;
  const studentIds = [...new Set(assignments.flatMap((assignment) => teacherEvaluationTargets(assignment, {
    classMembers,
    groupMembers,
    recipientsMap,
  })))];
  const profileResult = studentIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", studentIds)
    : { data: [], error: null };
  throwOnError(profileResult);
  const profiles: TeacherEvaluationBase["profiles"] = {};
  for (const profile of (profileResult.data ?? []) as any[]) {
    profiles[profile.id] = { first_name: profile.first_name || "", last_name: profile.last_name || "" };
  }

  return {
    assignments,
    classes: ((classResult.data ?? []) as Array<{ id: string; name: string }>).sort((a, b) => a.name.localeCompare(b.name, "cs")),
    groups: ((groupResult.data ?? []) as Array<{ id: string; name: string }>).sort((a, b) => a.name.localeCompare(b.name, "cs")),
    classMembers,
    groupMembers,
    recipientsMap,
    profiles,
  };
}

export function practicePercent(row: { score: number | null; answers_json: unknown }): number | null {
  const data = row.answers_json && typeof row.answers_json === "object" && !Array.isArray(row.answers_json)
    ? row.answers_json as Record<string, unknown>
    : {};
  const percent = Number(data.percent);
  if (Number.isFinite(percent) && percent >= 0 && percent <= 100) return percent;
  const total = Number(data.totalScorable);
  if (row.score !== null && Number.isFinite(total) && total > 0) return Math.round((row.score / total) * 100);
  return null;
}

/**
 * Podklady jednoho žáka. Vše čte jeho/učitelův JWT přes RLS; lekce mimo předměty
 * vlastních úkolů se do vyhodnocení nepřidají. Žádné odpovědi se neposílají do AI.
 */
export async function loadTeacherEvaluationDetail(
  studentId: string,
  assignments: TeacherEvaluationAssignment[],
): Promise<TeacherEvaluationDetail> {
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [attemptResult, activityResult, practiceResult, masteryResult] = await Promise.all([
    assignmentIds.length
      ? supabase.from("assignment_attempts")
        .select("id, assignment_id, student_id, status, score, max_score, started_at, submitted_at, attempt_number")
        .in("assignment_id", assignmentIds).eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("student_activity_results")
      .select("lesson_id, source_lesson_id, activity_index, score, max_score, completed_at")
      .eq("user_id", studentId).order("completed_at", { ascending: false }).limit(500),
    supabase.from("student_practice_sessions")
      .select("lesson_id, score, answers_json, created_at")
      .eq("student_id", studentId).order("created_at", { ascending: false }).limit(500),
    supabase.from("student_lesson_mastery")
      .select("lesson_id, mastery_percent, sessions_count, mastered_at, updated_at")
      .eq("student_id", studentId).limit(500),
  ]);
  [attemptResult, activityResult, practiceResult, masteryResult].forEach(throwOnError);

  const activityRows = (activityResult.data ?? []) as any[];
  const practiceRows = (practiceResult.data ?? []) as any[];
  const masteryRows = (masteryResult.data ?? []) as any[];
  const lessonIds = [...new Set([
    ...assignments.map((assignment) => assignment.lesson_id),
    ...activityRows.map((row) => row.lesson_id || row.source_lesson_id),
    ...practiceRows.map((row) => row.lesson_id),
    ...masteryRows.map((row) => row.lesson_id),
  ].filter(Boolean))] as string[];
  if (lessonIds.length === 0) {
    return { attempts: (attemptResult.data ?? []) as EvaluationAttempt[], activities: [], practice: [], mastery: [], lessons: [] };
  }

  const [teacherLessonResult, globalLessonResult, subjectCatalogResult] = await Promise.all([
    supabase.from("teacher_textbook_lessons" as any).select("id, title, textbook_id").in("id", lessonIds),
    supabase.from("textbook_lessons").select("id, title, topic_id").in("id", lessonIds),
    supabase.from("subjects").select("id, name"),
  ]);
  [teacherLessonResult, globalLessonResult, subjectCatalogResult].forEach(throwOnError);
  const teacherLessons = (teacherLessonResult.data ?? []) as any[];
  const globalLessons = (globalLessonResult.data ?? []) as any[];
  const textbookIds = [...new Set(teacherLessons.map((lesson) => lesson.textbook_id).filter(Boolean))];
  const topicIds = [...new Set(globalLessons.map((lesson) => lesson.topic_id).filter(Boolean))];
  const [textbookResult, topicResult, textbookSubjectResult] = await Promise.all([
    textbookIds.length ? supabase.from("teacher_textbooks").select("id, title, subject, subject_id").in("id", textbookIds) : Promise.resolve({ data: [], error: null }),
    topicIds.length ? supabase.from("textbook_topics").select("id, title, subject").in("id", topicIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("textbook_subjects").select("slug, label"),
  ]);
  [textbookResult, topicResult, textbookSubjectResult].forEach(throwOnError);

  // Katalog subjects nemá slug; globální téma spárujeme přes čitelný český název.
  const subjectCatalog = (subjectCatalogResult.data ?? []) as any[];
  const subjectById = new Map(subjectCatalog.map((subject) => [subject.id, subject]));
  const normalizeSubjectName = (value: string) => value.trim().toLocaleLowerCase("cs").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const subjectByName = new Map(subjectCatalog.map((subject) => [normalizeSubjectName(subject.name), subject]));
  const labelBySlug = new Map(((textbookSubjectResult.data ?? []) as any[]).map((subject) => [subject.slug, subject.label]));
  const textbookById = new Map(((textbookResult.data ?? []) as any[]).map((textbook) => [textbook.id, textbook]));
  const topicById = new Map(((topicResult.data ?? []) as any[]).map((topic) => [topic.id, topic]));
  const lessons: EvaluationLesson[] = [];

  for (const lesson of teacherLessons) {
    const textbook = textbookById.get(lesson.textbook_id);
    if (!textbook) continue;
    const catalog = textbook.subject_id ? subjectById.get(textbook.subject_id) : null;
    const label = catalog?.name || textbook.subject || "Ostatní";
    lessons.push({
      id: lesson.id,
      title: lesson.title || "Lekce",
      subjectKey: catalog ? `id:${catalog.id}` : textbook.subject?.trim() ? `name:${textbook.subject.trim()}` : NO_SUBJECT,
      subjectLabel: label,
      source: "teacher_textbook_lessons",
    });
  }
  for (const lesson of globalLessons) {
    const topic = topicById.get(lesson.topic_id);
    const slug = topic?.subject || "";
    const fallbackLabel = practiceSubjectLabel(slug, labelBySlug.get(slug));
    const catalog = subjectByName.get(normalizeSubjectName(fallbackLabel));
    const label = catalog?.name || fallbackLabel;
    lessons.push({
      id: lesson.id,
      title: lesson.title || "Lekce",
      topicTitle: topic?.title || null,
      subjectKey: catalog ? `id:${catalog.id}` : slug ? `name:${label}` : NO_SUBJECT,
      subjectLabel: label,
      source: "textbook_lessons",
    });
  }

  const assignmentLessonIds = new Set(assignments.map((assignment) => assignment.lesson_id).filter(Boolean));
  const allowedSubjectKeys = new Set(assignments.map((assignment) => assignment.subjectKey));
  const allowedLessonIds = new Set(lessons
    .filter((lesson) => assignmentLessonIds.has(lesson.id) || allowedSubjectKeys.has(lesson.subjectKey))
    .map((lesson) => lesson.id));
  for (const assignment of assignments) {
    if (assignment.lesson_id && !lessons.some((lesson) => lesson.id === assignment.lesson_id)) {
      allowedLessonIds.add(assignment.lesson_id);
      lessons.push({
        id: assignment.lesson_id,
        title: assignment.title,
        subjectKey: assignment.subjectKey,
        subjectLabel: assignment.subjectLabel,
        source: assignment.lesson_source,
      });
    }
  }

  const activities: EvaluationActivity[] = activityRows.flatMap((row) => {
    const lessonId = row.lesson_id || row.source_lesson_id;
    return lessonId && allowedLessonIds.has(lessonId) ? [{
      lesson_id: lessonId,
      activity_index: row.activity_index,
      score: row.score,
      max_score: row.max_score,
      completed_at: row.completed_at,
    }] : [];
  });
  const practice: EvaluationPractice[] = practiceRows.flatMap((row) => {
    const percent = practicePercent(row);
    return row.lesson_id && allowedLessonIds.has(row.lesson_id) && percent !== null
      ? [{ lesson_id: row.lesson_id, percent, created_at: row.created_at }]
      : [];
  });
  const mastery: EvaluationMastery[] = masteryRows.filter((row) => allowedLessonIds.has(row.lesson_id)).map((row) => ({
    lesson_id: row.lesson_id,
    mastery_percent: row.mastery_percent,
    sessions_count: row.sessions_count,
    mastered_at: row.mastered_at,
    updated_at: row.updated_at,
  }));

  return {
    attempts: (attemptResult.data ?? []) as EvaluationAttempt[],
    activities,
    practice,
    mastery,
    lessons: lessons.filter((lesson) => allowedLessonIds.has(lesson.id)),
  };
}
