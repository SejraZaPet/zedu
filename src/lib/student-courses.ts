import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { assignmentKind } from "@/lib/assignment-kind";
import { assignmentStatus } from "@/lib/assignment-status";
import { expandScheduleSlots, formatTime } from "@/lib/calendar-utils";
import {
  fetchStudentScheduleChanges,
  isLessonNotHeld,
  mergeStudentScheduleChanges,
} from "@/lib/schedule-exception-store";
import { loadStudentAssignmentAttempts } from "@/lib/student-assignment-attempts";
import { fetchStudentScheduleData, type StudentClassSlot, type StudentScheduleData } from "@/lib/student-schedule";
import { getSubjectName } from "@/lib/subject-appearance";
import { countSubjectNews, EMPTY_NEWS, getSubjectSeen, type SubjectNews } from "@/lib/subject-news";

interface SubjectAppearance {
  name?: string | null;
  color?: string | null;
  abbreviation?: string | null;
  archived?: boolean | null;
}
interface ClassRow { id: string; name: string; archived?: boolean | null }
interface GroupRow {
  id: string;
  name: string;
  subject_id: string | null;
  archived?: boolean | null;
  subjects?: SubjectAppearance | null;
}
interface ClassSubjectRow {
  id: string;
  class_id: string;
  subject_id: string | null;
  archived?: boolean | null;
  subjects?: SubjectAppearance | null;
}
interface AssignmentRow {
  id: string;
  class_id: string | null;
  group_id: string | null;
  subject_id: string | null;
  deadline: string | null;
  exam_type: string | null;
  settings?: unknown;
  created_at?: string | null;
  scheduled_publish_at?: string | null;
}

export interface StudentCourse {
  id: string;
  subjectId: string | null;
  subjectName: string;
  audienceName: string;
  audienceKind: "class" | "group";
  classId: string | null;
  groupId: string | null;
  target: string;
  slots: StudentClassSlot[];
  openAssignments: number;
  hasUpcomingExam: boolean;
  nextLesson: Date | null;
  news: SubjectNews;
}

const subjectIdentity = (subjectId: string | null, name: string) =>
  name !== "Předmět" ? `name:${name.trim().toLocaleLowerCase("cs")}` : subjectId ?? "name:unknown";

/** Sestaví jednu kartu pro každou dvojici předmět + třída/skupina. */
export function buildStudentCourses(
  schedule: StudentScheduleData,
  classRows: ClassRow[],
  classSubjects: ClassSubjectRow[],
  groupRows: GroupRow[],
): StudentCourse[] {
  const classes = new Map(classRows.filter((row) => !row.archived).map((row) => [row.id, row]));
  const groups = new Map(groupRows.filter((row) => !row.archived).map((row) => [row.id, row]));
  const courses = new Map<string, StudentCourse>();

  const add = (input: {
    subjectId: string | null;
    subjectName: string;
    classId?: string | null;
    groupId?: string | null;
    audienceName: string;
    subjectParam?: string | null;
    slot?: StudentClassSlot;
  }) => {
    const name = input.subjectName.trim();
    if (!name || (!input.classId && !input.groupId)) return;
    const targetKind = input.groupId ? "group" : "class";
    const targetId = input.groupId ?? input.classId!;
    const key = `${targetKind}:${targetId}:${subjectIdentity(input.subjectId, name)}`;
    const existing = courses.get(key);
    if (existing) {
      if (input.slot && !existing.slots.some((slot) => slot.id === input.slot!.id)) existing.slots.push(input.slot);
      return;
    }
    const subjectParam = encodeURIComponent(input.subjectParam || (name !== "Předmět" ? name : input.subjectId) || "Předmět");
    courses.set(key, {
      id: key,
      subjectId: input.subjectId,
      subjectName: name,
      audienceName: input.audienceName,
      audienceKind: targetKind,
      classId: input.classId ?? null,
      groupId: input.groupId ?? null,
      target: `/student/predmet/${subjectParam}/${input.groupId ? "skupina" : "trida"}/${targetId}`,
      slots: input.slot ? [input.slot] : [],
      openAssignments: 0,
      news: EMPTY_NEWS,
      hasUpcomingExam: false,
      nextLesson: null,
    });
  };

  for (const row of classSubjects) {
    const klass = classes.get(row.class_id);
    if (!klass || row.archived || row.subjects?.archived) continue;
    add({
      subjectId: row.subject_id,
      subjectName: row.subjects?.name?.trim() || "Předmět",
      classId: klass.id,
      audienceName: klass.name,
    });
  }
  for (const group of groups.values()) {
    if (group.subjects?.archived) continue;
    add({
      subjectId: group.subject_id,
      subjectName: group.subjects?.name?.trim() || "Předmět",
      groupId: group.id,
      audienceName: group.name,
    });
  }
  for (const slot of schedule.slots) {
    if (slot.subjects?.archived) continue;
    const subjectName = getSubjectName(slot, slot.subjects, "").trim();
    if (!subjectName && !slot.subject_id) continue;
    if (slot.group_id) {
      const group = groups.get(slot.group_id);
      if (!group) continue;
      add({ subjectId: slot.subject_id ?? group.subject_id, subjectName: subjectName || "Předmět", groupId: group.id, audienceName: group.name, slot });
    } else if (slot.class_id) {
      const klass = classes.get(slot.class_id);
      if (!klass) continue;
      add({ subjectId: slot.subject_id ?? null, subjectName: subjectName || "Předmět", classId: klass.id, audienceName: klass.name, slot });
    }
  }
  return [...courses.values()].sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName, "cs") || a.audienceName.localeCompare(b.audienceName, "cs"));
}

export function nextLessonLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return `dnes ${formatTime(date)}`;
  if (isSameDay(date, addDays(now, 1))) return `zítra ${formatTime(date)}`;
  return `${format(date, "d. M.")} ${formatTime(date)}`;
}

export async function fetchStudentCourses(userId: string, now = new Date()): Promise<StudentCourse[]> {
  const schedule = await fetchStudentScheduleData(userId);
  if (schedule.classIds.length === 0 && schedule.groupIds.length === 0) return [];

  const [classesRes, classSubjectsRes, groupsRes, assignmentsRes] = await Promise.all([
    schedule.classIds.length
      ? supabase.from("classes").select("id, name, archived").in("id", schedule.classIds)
      : Promise.resolve({ data: [] as any[] }),
    schedule.classIds.length
      ? supabase.from("class_subjects").select("id, class_id, subject_id, archived, subjects(name, color, abbreviation, archived)").in("class_id", schedule.classIds)
      : Promise.resolve({ data: [] as any[] }),
    schedule.groupIds.length
      ? supabase.from("subject_groups").select("id, name, subject_id, archived, subjects(name, color, abbreviation, archived)").in("id", schedule.groupIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("assignments").select("id, class_id, group_id, subject_id, deadline, exam_type, settings, created_at, scheduled_publish_at").eq("status", "published"),
  ]);

  const courses = buildStudentCourses(
    schedule,
    (classesRes.data ?? []) as ClassRow[],
    (classSubjectsRes.data ?? []) as ClassSubjectRow[],
    (groupsRes.data ?? []) as GroupRow[],
  );
  if (courses.length === 0) return [];

  const allAssignments = (assignmentsRes.data ?? []) as AssignmentRow[];
  const assignments = allAssignments.filter((row) => assignmentKind(row.settings) === "task");
  const attempts = await loadStudentAssignmentAttempts(userId, assignments.map((row) => row.id));
  const from = startOfDay(now);
  const to = endOfDay(addDays(now, 56));
  const expanded = expandScheduleSlots(schedule.slots as any[], from, to);
  const changes = await fetchStudentScheduleChanges(from, to);
  const lessons = mergeStudentScheduleChanges(expanded, changes, { from, to }, (f, t) => expandScheduleSlots(schedule.slots as any[], f, t));
  const examLimit = endOfDay(addDays(now, 14));

  return courses.map((course) => {
    const slotIds = new Set(course.slots.map((slot) => slot.id));
    const next = lessons
      .filter((event) => event.type === "lesson" && event.start >= now && !isLessonNotHeld(event) && event.scheduleSource?.slotId && slotIds.has(event.scheduleSource.slotId))
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
    const matches = (assignment: AssignmentRow) => {
      const sameAudience = course.groupId ? assignment.group_id === course.groupId : assignment.class_id === course.classId;
      const sameSubject = course.subjectId
        ? assignment.subject_id === course.subjectId || assignment.subject_id == null
        : assignment.subject_id == null;
      return sameAudience && sameSubject;
    };
    const relevant = assignments.filter(matches);
    const news = countSubjectNews(allAssignments.filter(matches), getSubjectSeen(userId, course.target), now);
    const openAssignments = relevant.filter((assignment) =>
      assignmentStatus(assignment, attempts.filter((attempt) => attempt.assignment_id === assignment.id), now).group === "pending").length;
    const hasUpcomingExam = relevant.some((assignment) => {
      if (!assignment.exam_type || !assignment.deadline) return false;
      const deadline = new Date(assignment.deadline);
      return deadline >= startOfDay(now) && deadline <= examLimit;
    });
    return { ...course, openAssignments, hasUpcomingExam, nextLesson: next?.start ?? null, news };
  });
}
