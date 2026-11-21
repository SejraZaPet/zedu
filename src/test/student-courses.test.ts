import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  attempts: vi.fn(async () => []),
  changes: vi.fn(async () => []),
  schedule: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/student-schedule", () => ({ fetchStudentScheduleData: mocks.schedule }));
vi.mock("@/lib/student-assignment-attempts", () => ({ loadStudentAssignmentAttempts: mocks.attempts }));
vi.mock("@/lib/schedule-exception-store", () => ({
  fetchStudentScheduleChanges: mocks.changes,
  mergeStudentScheduleChanges: (events: unknown[]) => events,
  isLessonNotHeld: () => false,
}));

import { buildStudentCourses, fetchStudentCourses, nextLessonLabel } from "@/lib/student-courses";

const schedule = { classIds: ["class-1"], groupIds: ["group-1"], classNames: ["8. A"], slots: [] };

describe("Žákové předměty – povolená data a odvozené karty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.schedule.mockResolvedValue(schedule);
    const rows: Record<string, unknown[]> = {
      classes: [{ id: "class-1", name: "8. A", archived: false }],
      class_subjects: [{ id: "cs-1", class_id: "class-1", subject_id: "math", archived: false, subjects: { name: "Matematika", archived: false } }],
      subject_groups: [{ id: "group-1", name: "Fyzika odpoledne", subject_id: "physics", archived: false, subjects: { name: "Fyzika", archived: false } }],
      assignments: [
        { id: "a1", class_id: "class-1", group_id: null, subject_id: "math", deadline: "2026-11-25T08:00:00", exam_type: "pisemne", settings: { kind: "task" } },
        { id: "a2", class_id: null, group_id: "group-1", subject_id: "physics", deadline: null, exam_type: null, settings: { kind: "task" } },
      ],
    };
    mocks.from.mockImplementation((table: string) => {
      const query: any = {};
      query.select = () => query;
      query.in = () => Promise.resolve({ data: rows[table] ?? [] });
      query.eq = () => Promise.resolve({ data: rows[table] ?? [] });
      return query;
    });
  });

  it("použije pouze existující čtení tříd, předmětů, skupin a přiřazených úloh", async () => {
    const courses = await fetchStudentCourses("student-1", new Date("2026-11-21T08:00:00"));
    expect(mocks.from.mock.calls.map(([table]) => table).sort()).toEqual([
      "assignments", "class_subjects", "classes", "subject_groups",
    ]);
    expect(courses.find((row) => row.subjectId === "math")).toMatchObject({
      target: "/student/predmet/Matematika/trida/class-1", openAssignments: 1, hasUpcomingExam: true,
    });
    expect(courses.find((row) => row.subjectId === "physics")).toMatchObject({
      target: "/student/predmet/Fyzika/skupina/group-1", openAssignments: 1, hasUpcomingExam: false,
    });
  });

  it("archivované třídy, skupiny a předměty nevytvoří karty", () => {
    const rows = buildStudentCourses(schedule,
      [{ id: "class-1", name: "8. A", archived: true }],
      [{ id: "cs-1", class_id: "class-1", subject_id: "math", subjects: { name: "Matematika" } }],
      [{ id: "group-1", name: "Fyzika", subject_id: "physics", archived: true, subjects: { name: "Fyzika" } }]);
    expect(rows).toEqual([]);
  });

  it("starý slot bez subject_id nezduplikuje kartu kanonického předmětu", () => {
    const legacySlot: any = {
      id: "slot-1", class_id: "class-1", group_id: null, subject_id: null, subject_label: "Matematika",
      day_of_week: 1, start_time: "08:00:00", end_time: "08:45:00", week_parity: "every",
    };
    const rows = buildStudentCourses({ ...schedule, groupIds: [], slots: [legacySlot] },
      [{ id: "class-1", name: "8. A", archived: false }],
      [{ id: "cs-1", class_id: "class-1", subject_id: "math", subjects: { name: "Matematika" } }], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].subjectId).toBe("math");
    expect(rows[0].slots.map((row) => row.id)).toEqual(["slot-1"]);
  });

  it("další hodina používá dnešní a zítřejší označení", () => {
    const now = new Date("2026-11-21T08:00:00");
    expect(nextLessonLabel(new Date("2026-11-21T08:25:00"), now)).toBe("dnes 8:25");
    expect(nextLessonLabel(new Date("2026-11-22T09:10:00"), now)).toBe("zítra 9:10");
  });
});
