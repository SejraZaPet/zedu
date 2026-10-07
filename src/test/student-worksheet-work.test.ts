import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Minimal in-memory mock of the student_worksheet_work table ──
type Row = Record<string, any>;
const db: { rows: Row[]; attemptUpdates: Row[] } = { rows: [], attemptUpdates: [] };
let seq = 0;

function query(table: string) {
  const filters: [string, any][] = [];
  let op: "select" | "insert" | "update" = "select";
  let payload: Row = {};
  const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
  const api: any = {
    select: () => api,
    eq: (k: string, v: any) => (filters.push([k, v]), api),
    order: () => api,
    limit: () => api,
    insert: (p: Row) => ((op = "insert"), (payload = p), api),
    update: (p: Row) => ((op = "update"), (payload = p), api),
    single: () => api.then((r: any) => r),
    then: (res: any) => {
      if (table === "assignment_attempts") {
        db.attemptUpdates.push(payload);
        return Promise.resolve({ data: null, error: null }).then(res);
      }
      if (op === "insert") {
        if (payload.status === "draft" && db.rows.some((r) => r.status === "draft" && r.worksheet_id === payload.worksheet_id && r.student_id === payload.student_id && r.variant_id === payload.variant_id)) {
          return Promise.resolve({ data: null, error: { message: "duplicate" } }).then(res);
        }
        const row = { id: `w${++seq}`, updated_at: new Date(Date.now() + seq).toISOString(), submitted_at: null, score: null, max_score: null, ...payload };
        db.rows.push(row);
        return Promise.resolve({ data: { id: row.id }, error: null }).then(res);
      }
      if (op === "update") {
        db.rows.filter(match).forEach((r) => Object.assign(r, payload, { updated_at: new Date(Date.now() + ++seq).toISOString() }));
        return Promise.resolve({ data: null, error: null }).then(res);
      }
      const data = db.rows.filter(match).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return Promise.resolve({ data, error: null }).then(res);
    },
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => query(t) } }));

import { saveDraft, submitWork, loadWork } from "@/lib/worksheet-work";
import { useWorksheetAutosave } from "@/hooks/useWorksheetAutosave";

const T = { worksheetId: "ws1", studentId: "s1", variantId: "A" };

beforeEach(() => {
  db.rows = [];
  db.attemptUpdates = [];
  localStorage.clear();
});

describe("vlastní práce žáka bez úkolu", () => {
  it("upsert: druhé uložení aktualizuje stejný koncept", async () => {
    const id = await saveDraft(T, { q1: "A" }, null);
    const id2 = await saveDraft(T, { q1: "B" }, null); // souběh → najde existující
    expect(id2).toBe(id);
    expect(db.rows.filter((r) => r.status === "draft")).toHaveLength(1);
    expect(db.rows[0].answers).toEqual({ q1: "B" });
  });

  it("Začít znovu: odevzdaná verze zůstává, vznikne nový koncept", async () => {
    const id = await saveDraft(T, { q1: "A" }, null);
    expect(await submitWork(T, { q1: "A" }, id, 1, 2)).toBe(true);
    await saveDraft(T, { q1: "C" }, null);
    const { draft, lastSubmitted } = await loadWork(T);
    expect(lastSubmitted?.score).toBe(1);
    expect(draft?.answers).toEqual({ q1: "C" });
    expect(db.rows).toHaveLength(2);
  });

  it("hook obnoví odpovědi ze serveru, když jsou novější než localStorage", async () => {
    localStorage.setItem("k", JSON.stringify({ answers: { q1: "old" }, currentIndex: 0, savedAt: "2000-01-01T00:00:00Z" }));
    db.rows.push({ id: "d1", ...{ worksheet_id: "ws1", student_id: "s1", variant_id: "A" }, status: "draft", answers: { q1: "server" }, updated_at: new Date().toISOString() });
    const { result } = renderHook(() =>
      useWorksheetAutosave({ storageKey: "k", attemptId: null, intervalSec: 999, editable: true, work: T }),
    );
    await waitFor(() => expect(result.current.answers).toEqual({ q1: "server" }));
  });

  it("hook: odevzdání + Začít znovu", async () => {
    const { result } = renderHook(() =>
      useWorksheetAutosave({ storageKey: "k2", attemptId: null, intervalSec: 999, editable: true, work: T }),
    );
    act(() => result.current.setAnswer("q1", "A"));
    await act(async () => { await result.current.submitOwnWork(1, 1); });
    expect(result.current.workStatus).toBe("submitted");
    act(() => result.current.startOver());
    expect(result.current.answers).toEqual({});
    expect(result.current.workStatus).toBe("draft");
    expect(db.rows.some((r) => r.status === "submitted")).toBe(true);
  });

  it("s attemptId (úkol) se do vlastní práce nic neukládá", async () => {
    const { result } = renderHook(() =>
      useWorksheetAutosave({ storageKey: "k3", attemptId: "att1", intervalSec: 999, editable: true, work: T }),
    );
    act(() => result.current.setAnswer("q1", "A"));
    await act(async () => { await result.current.flushNow(); });
    expect(db.rows).toHaveLength(0);
    expect(db.attemptUpdates).toHaveLength(1);
    expect(result.current.workStatus).toBeNull();
  });
});
