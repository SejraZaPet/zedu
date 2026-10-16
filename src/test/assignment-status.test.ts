import { describe, expect, it } from "vitest";
import { assignmentStatus, assignmentClassProgress, sortStatusAssignments, ASSIGNMENT_GROUPS } from "@/lib/assignment-status";

const now = new Date("2026-10-16T10:00:00Z");
const deadline = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString();
const ungraded = { student_id: "a", status: "submitted", score: null, max_score: null };
const graded = { ...ungraded, score: 10, max_score: 13 };

describe("assignment display state", () => {
  it("uses the requested group order", () => expect(ASSIGNMENT_GROUPS.slice(0, 4).map((g) => g.label)).toEqual(["K odevzdání", "Odevzdáno", "Po termínu", "Ohodnoceno"]));
  it.each([[23, "soon"], [24, "soon"], [25, "pending"], [0, "overdue"], [-1, "overdue"]])("deadline %s hours: %s", (hours, expected) => {
    expect(assignmentStatus({ deadline: deadline(Number(hours)) }, [], now).state).toBe(expected);
  });
  it("does not mark no-deadline tasks overdue", () => {
    expect(assignmentStatus({}, [], now).state).toBe("pending");
    expect(assignmentStatus({ deadline: null, exam_type: "prace_v_hodine" }, [], now).label).toBe("V hodině");
  });
  it("treats an invalid date safely", () => expect(assignmentStatus({ deadline: "invalid" }, [], now).state).toBe("pending"));
  it("submitted late still awaits grading", () => expect(assignmentStatus({ deadline: deadline(-2) }, [ungraded], now).state).toBe("submitted"));
  it("graded late displays the score, not overdue", () => expect(assignmentStatus({ deadline: deadline(-2) }, [graded], now)).toMatchObject({ state: "graded", label: "10 / 13" }));
  it("zero is a valid grade", () => expect(assignmentStatus({}, [{ ...graded, score: 0 }], now).state).toBe("graded"));
  it("an unfinished retry does not hide submitted work", () => expect(assignmentStatus({}, [ungraded, { status: "in_progress", score: 0, max_score: 13 }], now).state).toBe("submitted"));
  it("in-progress scores never mark an assignment graded", () => expect(assignmentStatus({}, [{ status: "in_progress", score: 4, max_score: 10 }], now).state).toBe("pending"));
  it("retains best submitted result", () => expect(assignmentStatus({}, [graded, { ...graded, score: 2 }], now).label).toBe("10 / 13"));
  it("labels today and tomorrow using the local calendar", () => {
    const morning = new Date(2026, 9, 16, 8);
    expect(assignmentStatus({ deadline: new Date(2026, 9, 16, 17).toISOString() }, [], morning).label).toBe("Končí dnes");
    expect(assignmentStatus({ deadline: new Date(2026, 9, 17, 7).toISOString() }, [], morning).label).toBe("Končí zítra");
  });
  it("teacher overdue if at least one student is missing", () => expect(assignmentStatus({ deadline: deadline(-1) }, [], now, { submitted: 12, total: 24, graded: 12 }).state).toBe("overdue"));
  it("teacher completed roster awaiting grading", () => expect(assignmentStatus({ deadline: deadline(-1) }, [], now, { submitted: 24, total: 24, graded: 23 }).state).toBe("submitted"));
  it("teacher fully graded roster", () => expect(assignmentStatus({}, [], now, { submitted: 24, total: 24, graded: 24 }).state).toBe("graded"));
  it("empty roster is not automatically graded", () => expect(assignmentStatus({}, [], now, { submitted: 0, total: 0, graded: 0 }).state).toBe("pending"));
  it("future publication is preparing, not overdue", () => expect(assignmentStatus({ status: "scheduled", scheduled_publish_at: deadline(4), deadline: deadline(-2) }, [], now, { submitted: 0, total: 24, graded: 0 })).toMatchObject({ state: "preparing", label: expect.stringContaining("Od ") }));
  it("deduplicates students and ignores old/outside-roster attempts", () => expect(assignmentClassProgress([graded, graded, { ...graded, student_id: "former" }], ["a", "a", "b"])).toEqual({ submitted: 1, graded: 1, total: 2 }));
  it("shared group submissions count for each member", () => expect(assignmentClassProgress([{ ...graded, group_id: "team" }], ["a", "b"], [{ group_id: "team", student_id: "a" }, { group_id: "team", student_id: "b" }])).toEqual({ submitted: 2, graded: 2, total: 2 }));
  it("sorts imminent first, nearest deadline first, no deadline last without mutating", () => {
    const items = [{ id: "none" }, { id: "later", deadline: deadline(25) }, { id: "soon", deadline: deadline(23) }, { id: "nearest", deadline: deadline(2) }];
    expect(sortStatusAssignments(items, (a) => assignmentStatus(a, [], now)).map((a) => a.id)).toEqual(["nearest", "soon", "later", "none"]);
    expect(items[0].id).toBe("none");
  });
});