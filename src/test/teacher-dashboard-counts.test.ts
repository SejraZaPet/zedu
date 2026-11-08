import { describe, it, expect, vi, beforeEach } from "vitest";
const { from, queries, responses } = vi.hoisted(() => ({
  from: vi.fn(), queries: {} as Record<string, ReturnType<typeof vi.fn>>,
  responses: {} as Record<string, { count: number | null; error: unknown } | Error>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { loadTeacherDashboardCounts } from "@/lib/teacher-dashboard-counts";

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of ["assignments", "todos", "notifications"]) responses[table] = { count: 3, error: null };
  from.mockImplementation((table: string) => {
    const call = vi.fn();
    queries[table] = call;
    const q = {
      select: (...args: unknown[]) => { call("select", ...args); return q; },
      eq: (...args: unknown[]) => { call("eq", ...args); return q; },
      is: (...args: unknown[]) => { call("is", ...args); return q; },
      or: (...args: unknown[]) => { call("or", ...args); return q; },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        const response = responses[table];
        return (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)).then(resolve, reject);
      },
    };
    return q;
  });
});
const now = new Date("2026-11-08T09:46:00.000Z");
describe("teacher dashboard read-only counts", () => {
  it("counts published tasks only, excluding archived, drafts and scheduled statuses", async () => {
    await loadTeacherDashboardCounts("teacher-test", now);
    expect(queries.assignments).toHaveBeenCalledWith("eq", "status", "published");
    expect(queries.assignments).toHaveBeenCalledWith("or", "settings->>kind.is.null,settings->>kind.eq.task");
  });
  it("includes no deadline or a deadline that has not elapsed, regardless of late submission", async () => {
    await loadTeacherDashboardCounts("teacher-test", now);
    expect(queries.assignments).toHaveBeenCalledWith("or", "deadline.is.null,deadline.gte.2026-11-08T09:46:00.000Z");
  });
  it("counts only the teacher's own assignments", async () => {
    await loadTeacherDashboardCounts("teacher-test", now);
    expect(queries.assignments).toHaveBeenCalledWith("eq", "teacher_id", "teacher-test");
  });
  it("counts only pending personal todos, not delegated work", async () => {
    await loadTeacherDashboardCounts("teacher-test", now);
    expect(queries.todos).toHaveBeenCalledWith("eq", "user_id", "teacher-test");
    expect(queries.todos).toHaveBeenCalledWith("eq", "status", "pending");
  });
  it("counts all unread notifications for the owner, without the 50-row list limit", async () => {
    await loadTeacherDashboardCounts("teacher-test", now);
    expect(queries.notifications).toHaveBeenCalledWith("eq", "recipient_id", "teacher-test");
    expect(queries.notifications).toHaveBeenCalledWith("is", "read_at", null);
  });
  it("fetches only three counts, no activity badge, rows or writes", async () => {
    expect(await loadTeacherDashboardCounts("teacher-test", now)).toEqual({ assignments: 3, todos: 3, notifications: 3 });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["assignments", "todos", "notifications"]);
    for (const query of Object.values(queries)) expect(query).toHaveBeenCalledWith("select", "id", { count: "exact", head: true });
  });
  it("hides zero counts", async () => {
    responses.todos = { count: 0, error: null };
    expect((await loadTeacherDashboardCounts("teacher-test", now)).todos).toBeNull();
  });
  it("hides query errors without discarding other counts", async () => {
    responses.assignments = { count: 5, error: { message: "[TEST] failure" } };
    expect(await loadTeacherDashboardCounts("teacher-test", now)).toEqual({ assignments: null, todos: 3, notifications: 3 });
  });
  it("hides rejected reads", async () => {
    responses.notifications = new Error("[TEST] disconnected");
    expect((await loadTeacherDashboardCounts("teacher-test", now)).notifications).toBeNull();
  });
});