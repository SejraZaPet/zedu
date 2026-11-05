import { describe, expect, it } from "vitest";
import { assignmentStatus, assignmentClassProgress, sortStatusAssignments, LATE_BADGE, LATE_DRAFT_LABEL } from "@/lib/assignment-status";
import { assignmentKind, canSubmitNow, lateUntilFromDays, mergeKindSettings, announcementVisible, lateMode } from "@/lib/assignment-kind";

const now = new Date("2026-11-05T10:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
const sub = (submitted_at: string, score: number | null = null) => ({ student_id: "a", status: "submitted", score, max_score: score == null ? null : 10, submitted_at });

describe("student states", () => {
  it("submitted after deadline is Odevzdané with late badge, not Po termínu", () => {
    const s = assignmentStatus({ deadline: at(-5) }, [sub(at(-1))], now);
    expect(s.group).toBe("submitted");
    expect(s.badges).toEqual([LATE_BADGE]);
  });
  it("submitted on time has no late badge", () => expect(assignmentStatus({ deadline: at(-5) }, [sub(at(-6))], now).badges).toBeUndefined());
  it("graded late keeps score and late badge", () => expect(assignmentStatus({ deadline: at(-5) }, [sub(at(-1), 0)], now)).toMatchObject({ group: "graded", label: "0 / 10", badges: [LATE_BADGE] }));
  it("in-progress after deadline = Po termínu – rozpracováno", () => expect(assignmentStatus({ deadline: at(-1) }, [{ status: "in_progress", score: null, max_score: null }], now)).toMatchObject({ group: "overdue", label: LATE_DRAFT_LABEL }));
  it("nothing after deadline = Neodevzdáno", () => expect(assignmentStatus({ deadline: at(-1) }, [], now).label).toBe("Neodevzdáno"));
});

describe("teacher states", () => {
  it("Probíhá before deadline with nothing to review", () => expect(assignmentStatus({ deadline: at(5) }, [], now, { submitted: 0, total: 24, graded: 0 })).toMatchObject({ state: "pending", label: "Probíhá", progress: { text: "Odevzdalo 0/24", tone: "none" } }));
  it("Uzavřené when deadline passed and nobody submitted", () => expect(assignmentStatus({ deadline: at(-1) }, [], now, { submitted: 0, total: 24, graded: 0 })).toMatchObject({ state: "closed", progress: { tone: "none-overdue" } }));
  it("Ke kontrole with one ungraded before deadline", () => expect(assignmentStatus({ deadline: at(5) }, [], now, { submitted: 18, total: 24, graded: 17 })).toMatchObject({ state: "review", progress: { text: "Odevzdalo 18/24", tone: "some" } }));
  it("all submitted and graded = Zkontrolované, green", () => expect(assignmentStatus({ deadline: at(5) }, [], now, { submitted: 24, total: 24, graded: 24 })).toMatchObject({ state: "graded", progress: { tone: "all" } }));
  it("preview student outside roster is not counted", () => expect(assignmentClassProgress([sub(at(-1)), { ...sub(at(-1)), student_id: "preview" }], ["a", "b"]).submitted).toBe(1));
});

describe("late submission setting", () => {
  it("missing lateUntil = no (today's behaviour)", () => {
    expect(lateMode({})).toBe("no");
    expect(canSubmitNow({ deadline: at(-1), settings: {} }, now)).toBe(false);
  });
  it("+7 days is computed from the deadline", () => expect(lateUntilFromDays("2026-11-01T22:59:00.000Z", 7)).toBe("2026-11-08T22:59:00.000Z"));
  it("until date allows submission until then, not after", () => {
    expect(canSubmitNow({ deadline: at(-5), settings: { lateUntil: at(5) } }, now)).toBe(true);
    expect(canSubmitNow({ deadline: at(-5), settings: { lateUntil: at(-1) } }, now)).toBe(false);
  });
  it("unlimited always allows", () => expect(canSubmitNow({ deadline: at(-500), settings: { lateUntil: "unlimited" } }, now)).toBe(true));
});

describe("material and announcement", () => {
  it("material is outside states and never submittable", () => {
    expect(assignmentStatus({ deadline: at(-1), settings: { kind: "material" } }, [], now).group).toBe("material");
    expect(assignmentStatus({ settings: { kind: "material" } }, [], now, { submitted: 0, total: 24, graded: 0 }).progress).toBeUndefined();
    expect(canSubmitNow({ settings: { kind: "material" } }, now)).toBe(false);
  });
  it("announcement hides after visibleUntil", () => {
    expect(announcementVisible({ kind: "announcement", visibleUntil: at(-1) }, now)).toBe(false);
    expect(announcementVisible({ kind: "announcement" }, now)).toBe(true);
  });
  it("pinned comes first", () => {
    const items = [{ id: "a", deadline: at(1) }, { id: "p", settings: { kind: "announcement", pinned: true } }];
    expect(sortStatusAssignments(items, (x) => assignmentStatus(x, [], now)).map((x) => x.id)[0]).toBe("p");
  });
  it("task without kind and plan settings unchanged; merge keeps plan", () => {
    expect(assignmentKind({ plan: { kind: "test" } })).toBe("task");
    expect(mergeKindSettings({ plan: { kind: "test" } }, { kind: "material", lateUntil: "unlimited" })).toEqual({ plan: { kind: "test" }, kind: "material" });
    expect(mergeKindSettings({ kind: "material" }, { kind: "task" })).toEqual({});
  });
});

import { notifyEmailEnabled, notifyOverdueEnabled, mergeKindSettings as mergeNotify } from "@/lib/assignment-kind";
describe("e-mailové volby úkolu", () => {
  it("výchozí: úkol a oznámení e-mail ano, materiál ne", () => {
    expect(notifyEmailEnabled({})).toBe(true);
    expect(notifyEmailEnabled({ kind: "announcement" })).toBe(true);
    expect(notifyEmailEnabled({ kind: "material" })).toBe(false);
  });
  it("upozornění neodevzdáno: výchozí zapnuto jen u úkolu", () => {
    expect(notifyOverdueEnabled({})).toBe(true);
    expect(notifyOverdueEnabled({ notifyOverdue: false })).toBe(false);
    expect(notifyOverdueEnabled({ kind: "material" })).toBe(false);
  });
  it("uloží volby a zachová plan", () => {
    const s = mergeNotify({ plan: { x: 1 } }, { kind: "task", notifyEmail: false, notifyOverdue: true });
    expect(s).toMatchObject({ plan: { x: 1 }, notifyEmail: false, notifyOverdue: true });
    expect(mergeNotify(s, { kind: "material" }).notifyOverdue).toBeUndefined();
  });
});
