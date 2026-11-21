import { describe, expect, it } from "vitest";
import {
  assignmentAttachmentRefs,
  buildAssignmentFeedbackRequest,
  buildAssignmentStudentAnswer,
} from "./grading-feedback";

describe("vstup AI hodnocení úkolu", () => {
  it("převede přílohy úkolu na cesty a zadání na prostý text", () => {
    const request = buildAssignmentFeedbackRequest({
      assignment: {
        title: "Pouze pro UPX",
        description: "<p>Vytvoř <strong>vlastní</strong> příspěvek.</p>",
        settings: { criteria: "Obsah a vlastní zpracování" },
      },
      answers: {},
      submissionNote: "Práce je v dokumentu.",
      attachments: [{ file_name: "prace.pdf", file_path: "a/s/prace.pdf" }],
      score: null,
      maxScore: 10,
    });

    expect(request.question).toBe("Pouze pro UPX\n\nVytvoř vlastní příspěvek.");
    expect(request.criteria).toBe("Obsah a vlastní zpracování");
    expect(request.studentAnswer).toBe("Poznámka žáka:\nPráce je v dokumentu.");
    expect(request.attachments).toEqual([{ path: "a/s/prace.pdf", name: "prace.pdf", type: "" }]);
  });

  it("nepovažuje prázdné odpovědi bez poznámky za odevzdaný text", () => {
    expect(buildAssignmentStudentAnswer({}, null)).toBe("");
    expect(buildAssignmentStudentAnswer({ q1: "", q2: [] }, "  ")).toBe("");
    expect(buildAssignmentStudentAnswer({ q1: "Odpověď" }, null)).toContain('"q1": "Odpověď"');
  });

  it("zachová názvy všech souborů skupinového odevzdání", () => {
    expect(assignmentAttachmentRefs([
      { file_name: "a.pdf", file_path: "a/s1/a.pdf" },
      { file_name: "b.docx", file_path: "a/s2/b.docx" },
    ]).map((file) => file.name)).toEqual(["a.pdf", "b.docx"]);
  });
});
