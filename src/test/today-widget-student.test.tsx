import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lessons: [] as any[],
  notebooks: [] as any[],
  latestPage: null as any,
  onCount: vi.fn(),
  onExams: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "test-student-id" } }) }));
vi.mock("@/hooks/useMySchool", () => ({
  useMySchool: () => ({ schoolId: null }),
  useSchoolColleagues: () => ({ colleagues: [] }),
  colleagueLabel: () => "",
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/student-assignment-attempts", () => ({ loadStudentAssignmentAttempts: async () => [] }));
vi.mock("@/lib/notebook", () => ({ loadNotebooks: async () => mocks.notebooks }));
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
                    id: "assignment-today",
                    title: "[TEST] Dnešní úkol",
                    deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
                    exam_type: null,
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
      if (table === "notebook_pages") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: async () => ({ data: mocks.latestPage ? [mocks.latestPage] : [] }),
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
    mocks.notebooks = [];
    mocks.latestPage = null;
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

  it("místo karty Nejbližší úkoly ukáže dnešní úkol a nejbližší test jako pilulky", async () => {
    render(<MemoryRouter><TodayWidget role="student" onOpenAssignmentsChange={mocks.onCount} onUpcomingExamsChange={mocks.onExams} /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "1 úkol k odevzdání dnes" })).toHaveAttribute("href", "/student/ulohy");
    const exam = screen.getByRole("link", { name: "Test: [TEST] Písemka · zítra" });
    expect(exam).toHaveAttribute("href", "/student/ulohy/assignment-1");
    expect(exam.querySelector("svg.lucide-flag")).not.toBeNull();
    expect(screen.queryByText("Nejbližší úkoly")).not.toBeInTheDocument();
    expect(document.querySelector(".assignment-status-card")).toBeNull();
    await waitFor(() => expect(mocks.onCount).toHaveBeenLastCalledWith(2));
    await waitFor(() => expect(mocks.onExams).toHaveBeenLastCalledWith(1));
  });

  it("pilulku sešitu ukáže jen pro dnešní existující zápis", async () => {
    mocks.notebooks = [{ id: "notebook-1" }];
    mocks.latestPage = { updated_at: new Date().toISOString() };
    render(<MemoryRouter><TodayWidget role="student" /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Nový zápis v sešitě" })).toHaveAttribute("href", "/student/sesit");
  });
});
