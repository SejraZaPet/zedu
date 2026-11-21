import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { fetchStudentScheduleData } from "@/lib/student-schedule";

const slot = (id: string, day: number, start: string, classId: string | null, groupId: string | null) => ({
  id, class_id: classId, group_id: groupId, day_of_week: day, start_time: start, end_time: "09:15:00",
  week_parity: "every", subject_label: "Matematika", abbreviation: "M", color: null, room: null,
  textbook_id: null, classes: classId ? { name: "8. A" } : null, subject_groups: groupId ? { name: "Skupina" } : null,
});

describe("Sdílené čtení žákovského rozvrhu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("čte vlastní třídy i skupiny, sloučí sloty bez duplicit a seřadí je", async () => {
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => Promise.resolve({ data: table === "class_members" ? [{ class_id: "c1" }] : [{ group_id: "g1" }] }),
        in: (_column: string, ids: string[]) => Promise.resolve({
          data: ids.includes("c1") ? [slot("s2", 2, "08:30:00", "c1", null), slot("s1", 1, "08:00:00", "c1", null)] : [slot("s1", 1, "08:00:00", "c1", null)],
        }),
      }),
    }));
    const result = await fetchStudentScheduleData("student-1");
    expect(result.classIds).toEqual(["c1"]);
    expect(result.groupIds).toEqual(["g1"]);
    expect(result.slots.map((row) => row.id)).toEqual(["s1", "s2"]);
    expect(result.classNames).toEqual(["8. A"]);
  });

  it("bez členství se vůbec nedotazuje na rozvrhové sloty", async () => {
    mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }));
    const result = await fetchStudentScheduleData("student-1");
    expect(result.slots).toEqual([]);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["class_members", "subject_group_members"]);
  });
});
