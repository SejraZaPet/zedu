import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lessons: [] as any[],
  onCount: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "test-student-id" } }) }));
vi.mock("@/hooks/useMySchool", () => ({
  useMySchool: () => ({ schoolId: null }),
  useSchoolColleagues: () => ({ colleagues: [] }),
  colleagueLabel: () => "",
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/student-assignment-attempts", () => ({ loadStudentAssignmentAttempts: async () => [] }));
vi.mock("@/lib/calendar-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/calendar-utils")>()),
  expandScheduleSlots: () => mocks.lessons,
}));
vi.mock("@/lib/schedule-exception-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/schedule-exception-store")>()),
  fetchStudentScheduleChanges: async () => [],
  mergeStudentScheduleChanges: (lessons: any[]) => lessons,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "test-student-id" } } }) },
    from: (table: string) => {
      if (table === "class_schedule_slots") {
        return { select: async () => ({ data: [{ id: "slot", subject_id: "subject", subject_label: "Test" }] }) };
      }
      if (table === "assignments") {
        return {
          select: () => ({
            order: () => ({
              eq: () => ({
                or: async () => ({
                  data: [{
                    id: "assignment-1",
                    title: "[TEST] Písemka",
                    deadline: new Date(Date.now() + 86400000).toISOString(),
                    exam_type: "pisemne",
                    settings: {},
                  }, {
                    id: "assignment-overdue",
                    title: "[TEST] Po termínu",
                    deadline: new Date(Date.now() - 86400000).toISOString(),
                    exam_type: null,
                    settings: {},
                  }],
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              gte: () => ({
                lte: () => ({ neq: async () => ({ data: [] }) }),
              }),
            }),
          }),
        }),
      };
    },
  },
}));

import TodayWidget from "@/components/calendar/TodayWidget";

describe("TodayWidget – celý žákovský den", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const now = Date.now();
    mocks.lessons = [
      { id: "past", type: "lesson", title: "Čeština", start: new Date(now - 3 * 3600000), end: new Date(now - 2 * 3600000), room: "A1" },
      { id: "current", type: "lesson", title: "Odborný výcvik", start: new Date(now - 1800000), end: new Date(now + 1800000), room: "Dílna" },
      { id: "future", type: "lesson", title: "Matematika", start: new Date(now + 2 * 3600000), end: new Date(now + 3 * 3600000), room: "B2" },
    ];
  });
  afterEach(() => cleanup());

  it("zobrazí proběhlou, aktuální i budoucí hodinu a správné typové ikony", async () => {
    render(<MemoryRouter><TodayWidget role="student" onOpenAssignmentsChange={mocks.onCount} /></MemoryRouter>);
    expect(await screen.findByText("Čeština")).toBeVisible();
    expect(screen.getByText("Odborný výcvik")).toBeVisible();
    expect(screen.getByText("Matematika")).toBeVisible();
    expect(screen.getByText("proběhlo")).toBeVisible();

    const current = screen.getByText("Odborný výcvik").closest("li")!;
    expect(current).toHaveClass("dashboard-today-lesson--current");
    expect(within(current).getByText("Teď")).toBeVisible();
    expect(current.querySelector("svg.lucide-graduation-cap")).not.toBeNull();
    expect(screen.getByText("Čeština").closest("li")!.querySelector("svg.lucide-book")).not.toBeNull();
  });

  it("předá počet úloh ve skupině K odevzdání, bez úloh po termínu, a test označí Flag", async () => {
    render(<MemoryRouter><TodayWidget role="student" onOpenAssignmentsChange={mocks.onCount} /></MemoryRouter>);
    expect(await screen.findByText("[TEST] Písemka")).toBeVisible();
    expect(document.querySelector(".assignment-status-card svg.lucide-flag")).not.toBeNull();
    await waitFor(() => expect(mocks.onCount).toHaveBeenLastCalledWith(1));
  });
});
