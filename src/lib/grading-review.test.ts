import { describe, expect, it } from "vitest";
import {
  buildReviewRows,
  filterReviewRows,
  moveReviewIndex,
  prepareBulkComment,
  prepareMarkReviewed,
  prepareUndo,
  readGrading,
  isReviewed,
  attemptHasOpenAnswers,
  loadCommentTemplates,
  saveCommentTemplate,
  DEFAULT_COMMENT_TEMPLATES,
  type ReviewAttempt,
} from "./grading-review";

const asg = [
  { id: "a1", title: "Úkol 1", class_id: "c1", group_id: null, worksheet_id: "w1" },
  { id: "a2", title: "Úkol 2", class_id: null, group_id: "g1", worksheet_id: null },
];

const profiles = {
  s1: { first_name: "Anna", last_name: "Nová" },
  s2: { first_name: "Petr", last_name: "Svoboda" },
};

function attempt(over: Partial<ReviewAttempt>): ReviewAttempt {
  return {
    id: "t1",
    assignment_id: "a1",
    student_id: "s1",
    status: "submitted",
    score: 5,
    max_score: 10,
    submitted_at: "2026-11-01T10:00:00Z",
    attempt_number: 1,
    ...over,
  };
}

describe("buildReviewRows", () => {
  it("vezme jen odevzdané pokusy známých úkolů a nejnovější pokus žáka", () => {
    const rows = buildReviewRows({
      assignments: asg,
      attempts: [
        attempt({ id: "old", submitted_at: "2026-10-01T10:00:00Z" }),
        attempt({ id: "new", submitted_at: "2026-11-01T10:00:00Z" }),
        attempt({ id: "draft", status: "in_progress" }),
        attempt({ id: "foreign", assignment_id: "ax" }),
      ],
      profiles,
      targetNames: { c1: "7.A" },
    });
    expect(rows.map((r) => r.attemptId)).toEqual(["new"]);
    expect(rows[0].studentName).toBe("Nová Anna");
    expect(rows[0].targetName).toBe("7.A");
  });

  it("řadí nejstarší odevzdání nahoře", () => {
    const rows = buildReviewRows({
      assignments: asg,
      attempts: [
        attempt({ id: "t1", student_id: "s1", submitted_at: "2026-11-05T10:00:00Z" }),
        attempt({ id: "t2", student_id: "s2", submitted_at: "2026-11-01T10:00:00Z" }),
      ],
      profiles,
      targetNames: {},
    });
    expect(rows.map((r) => r.attemptId)).toEqual(["t2", "t1"]);
  });

  it("skupinové odevzdání označí jednou, ne dvakrát", () => {
    const rows = buildReviewRows({
      assignments: asg,
      attempts: [attempt({ id: "t9", assignment_id: "a2", group_id: "grp1" })],
      profiles,
      targetNames: { g1: "Skupina A" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].groupSubmission).toBe(true);
    expect(rows[0].targetName).toBe("Skupina A");
  });
});

describe("filterReviewRows", () => {
  const rows = buildReviewRows({
    assignments: asg,
    attempts: [
      attempt({ id: "t1", student_id: "s1" }),
      attempt({
        id: "t2",
        student_id: "s2",
        progress: { _teacher_grading: { reviewed: true } },
      }),
    ],
    profiles,
    targetNames: { c1: "7.A" },
  });

  it("stav pending ukáže jen nezkontrolované", () => {
    expect(filterReviewRows(rows, { state: "pending" }).map((r) => r.attemptId)).toEqual(["t1"]);
    expect(filterReviewRows(rows, { state: "reviewed" }).map((r) => r.attemptId)).toEqual(["t2"]);
    expect(filterReviewRows(rows, { state: "all" })).toHaveLength(2);
  });

  it("hledání žáka funguje bez diakritiky a velikosti písmen", () => {
    expect(filterReviewRows(rows, { query: "nova" }).map((r) => r.attemptId)).toEqual(["t1"]);
    expect(filterReviewRows(rows, { query: "SVOBODA" }).map((r) => r.attemptId)).toEqual(["t2"]);
  });

  it("filtr úkolu a třídy", () => {
    expect(filterReviewRows(rows, { assignmentId: "a1" })).toHaveLength(2);
    expect(filterReviewRows(rows, { assignmentId: "a2" })).toHaveLength(0);
    expect(filterReviewRows(rows, { targetId: "c1" })).toHaveLength(2);
  });
});

describe("moveReviewIndex", () => {
  it("posouvá bez zacyklení a v mezích", () => {
    expect(moveReviewIndex(0, 1, 3)).toBe(1);
    expect(moveReviewIndex(2, 1, 3)).toBe(2);
    expect(moveReviewIndex(0, -1, 3)).toBe(0);
    expect(moveReviewIndex(-1, 1, 0)).toBe(-1);
  });
});

describe("hromadné akce nemění score ani status", () => {
  const at = attempt({
    id: "t1",
    progress: { _teacher_grading: { total: 5, max: 10 } },
    teacher_feedback_text: "starý",
  });

  it("prepareMarkReviewed mění jen progress a feedback meta", () => {
    const patch = prepareMarkReviewed(at, "2026-11-08T12:00:00Z", "u1");
    expect(patch).not.toHaveProperty("score");
    expect(patch).not.toHaveProperty("status");
    expect((patch.progress._teacher_grading as any).reviewed).toBe(true);
    expect((patch.progress._teacher_grading as any).total).toBe(5);
    expect((patch.progress._teacher_grading as any).undo.action).toBe("reviewed");
  });

  it("prepareBulkComment nastaví komentář a uloží undo, score/status netkne", () => {
    const patch = prepareBulkComment(at, "Výborně!", "2026-11-08T12:00:00Z", "u1");
    expect(patch).not.toHaveProperty("score");
    expect(patch).not.toHaveProperty("status");
    expect(patch.teacher_feedback_text).toBe("Výborně!");
    expect((patch.progress._teacher_grading as any).undo.feedback_text).toBe("starý");
  });

  it("prepareUndo obnoví předchozí hodnoty; bez undo vrátí null", () => {
    const patch = prepareBulkComment(at, "Výborně!", "2026-11-08T12:00:00Z", "u1");
    const after: ReviewAttempt = {
      ...at,
      progress: patch.progress,
      teacher_feedback_text: patch.teacher_feedback_text,
    };
    const undo = prepareUndo(after, "2026-11-08T13:00:00Z", "u1");
    expect(undo).not.toBeNull();
    expect(undo!.teacher_feedback_text).toBe("starý");
    expect((undo!.progress._teacher_grading as any).total).toBe(5);
    expect(undo!.progress._teacher_grading).not.toHaveProperty("undo");
    expect(prepareUndo(attempt({ id: "x" }), "2026-11-08T13:00:00Z", "u1")).toBeNull();
  });
});

describe("readGrading / isReviewed", () => {
  it("čte jen platný tvar", () => {
    expect(readGrading(null)).toBeNull();
    expect(readGrading({ _teacher_grading: "špatně" })).toBeNull();
    expect(isReviewed({ _teacher_grading: { reviewed: true } })).toBe(true);
    expect(isReviewed({})).toBe(false);
  });
});

describe("attemptHasOpenAnswers", () => {
  const spec = {
    variants: [
      {
        variantId: "A",
        items: [
          { id: "i1", type: "mcq" },
          { id: "i2", type: "open_answer" },
        ],
      },
    ],
  };
  it("pozná otevřenou odpověď podle specu listu", () => {
    expect(attemptHasOpenAnswers(spec, { i1: "A", i2: "text" })).toBe(true);
    expect(attemptHasOpenAnswers(spec, { i1: "A" })).toBe(false);
    expect(attemptHasOpenAnswers(null, { i2: "text" })).toBe(false);
  });
});

describe("šablony komentářů", () => {
  function memStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
  }
  it("výchozí šablony jsou vždy k dispozici, vlastní se přidají", () => {
    const s = memStorage();
    expect(loadCommentTemplates(s)).toEqual(DEFAULT_COMMENT_TEMPLATES);
    const next = saveCommentTemplate(s, "Zkus to znovu.");
    expect(next[next.length - 1]).toBe("Zkus to znovu.");
    expect(next.filter((t) => t === "Zkus to znovu.")).toHaveLength(1);
    // Duplicita se nepřidá.
    expect(saveCommentTemplate(s, "Zkus to znovu.")).toEqual(next);
  });
});
