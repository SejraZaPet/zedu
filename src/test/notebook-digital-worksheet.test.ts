import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: any[] = [];
let attemptsRows: any[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const q: any = {
      _op: "select", _payload: null,
      select: () => q, eq: () => q, order: () => Promise.resolve({ data: attemptsRows, error: null }),
      insert: (p: any) => { q._op = "insert"; q._payload = p; calls.push({ table, op: "insert", p }); return q; },
      update: (p: any) => { q._op = "update"; calls.push({ table, op: "update", p }); return { eq: () => Promise.resolve({ error: null }) }; },
      single: () => Promise.resolve({ data: { id: "new", ...q._payload }, error: null }),
    };
    return q;
  };
  return { supabase: { from: builder } };
});
vi.mock("@/lib/worksheet-notebook", () => ({
  SNAPSHOT_KEY: "_notebookSnapshot",
  snapshotPenPagesForAttempt: vi.fn(async () => ({ created_at: "x", pages: [{ path: "p1", title: "List" }] })),
}));
vi.mock("@/lib/lesson-activity-index", () => ({ fetchLessonActivities: async () => [] }));

import { decideAttempt, loadOrCreateIndividualAttempt, submitWorksheetAttempt } from "@/lib/worksheet-attempt";
import { pageDisplayTitle } from "@/lib/notebook-toc";
import { snapshotPenPagesForAttempt } from "@/lib/worksheet-notebook";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

beforeEach(() => { calls.length = 0; attemptsRows = []; });

describe("digitální list v sešitu", () => {
  it("stránka sešitu nese název listu místo „Strana N“", () => {
    expect(pageDisplayTitle({ title: null, content: { worksheet: { title: "Česká gastronomie" } } } as any, 2)).toBe("Česká gastronomie");
    expect(pageDisplayTitle({ title: "Můj název", content: { worksheet: { title: "X" } } } as any, 0)).toBe("Můj název");
    expect(pageDisplayTitle({ title: null } as any, 2)).toBe("Strana 3");
  });

  it("obnoví rozpracovaný pokus (stejný jako v úkolu)", () => {
    const d = decideAttempt({ deadline: future, max_attempts: 2 }, [
      { id: "a1", status: "submitted", attempt_number: 1, score: 1, max_score: 2 },
      { id: "a2", status: "in_progress", attempt_number: 2 },
    ]);
    expect(d).toEqual({ kind: "resume", attempt: expect.objectContaining({ id: "a2" }) });
  });

  it("po termínu nezakládá nový pokus", () => {
    expect(decideAttempt({ deadline: past, max_attempts: 3 }, [])).toEqual({ kind: "view", attempt: null, reason: "deadline" });
  });

  it("respektuje max_attempts", () => {
    const d = decideAttempt({ deadline: null, max_attempts: 1 }, [{ id: "a1", status: "submitted", attempt_number: 1, score: 1, max_score: 1 }]);
    expect(d.kind).toBe("view");
  });

  it("založí nový pokus, když žádný není", async () => {
    const r = await loadOrCreateIndividualAttempt({ id: "as", deadline: future, max_attempts: 1 }, "stu");
    expect(r.attempt?.id).toBe("new");
    expect(calls[0]).toMatchObject({ op: "insert", p: { attempt_number: 1, student_id: "stu", status: "in_progress" } });
  });

  it("odevzdání přiloží snapshot stránek pera a zachová odpovědi z linek", async () => {
    const res = await submitWorksheetAttempt({
      assignment: { id: "as", deadline: future, max_attempts: 1, worksheet_id: "ws" },
      attemptId: "a1", studentId: "stu", answers: { wl1: "Svíčková" }, score: 0, maxScore: 0, gate: async () => true,
    });
    expect(res).toEqual({ ok: true });
    const up = calls.find((c) => c.op === "update");
    expect(up.p.status).toBe("submitted");
    expect(up.p.answers.wl1).toBe("Svíčková");
    expect(up.p.answers._notebookSnapshot.pages).toHaveLength(1);
  });

  it("po termínu odevzdání odmítne a nic neuloží", async () => {
    const res = await submitWorksheetAttempt({
      assignment: { id: "as", deadline: past, max_attempts: 1 }, attemptId: "a1", studentId: "stu",
      answers: {}, score: 0, maxScore: 0, gate: async () => true,
    });
    expect(res).toMatchObject({ ok: false, title: "Termín vypršel" });
    expect(calls).toHaveLength(0);
  });

  it("chybějící podklad zastaví odevzdání bez přepsání odpovědí", async () => {
    vi.mocked(snapshotPenPagesForAttempt).mockRejectedValueOnce(new Error("Podklad se nenačetl"));
    const answers = { wl1: "Uložený text" };
    const result = await submitWorksheetAttempt({
      assignment: { id: "as", deadline: future, max_attempts: 1, worksheet_id: "ws" },
      attemptId: "a1", studentId: "stu", answers, score: 0, maxScore: 0, gate: async () => true,
    });
    expect(result).toMatchObject({ ok: false });
    expect(calls).toHaveLength(0);
    expect(answers).toEqual({ wl1: "Uložený text" });
  });

  it("nesplněné povinné aktivity zastaví odevzdání", async () => {
    const res = await submitWorksheetAttempt({
      assignment: { id: "as", deadline: future, max_attempts: 1 }, attemptId: "a1", studentId: "stu",
      answers: {}, score: 0, maxScore: 0, gate: async () => false,
    });
    expect(res).toBe("gated");
    expect(calls).toHaveLength(0);
  });
});
