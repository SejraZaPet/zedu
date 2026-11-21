import { describe, it, expect } from "vitest";
import { buildUserContent, SYSTEM_PROMPT } from "../../supabase/functions/suggest-grading-feedback/prompt";
import { buildAssignmentFeedbackRequest } from "@/lib/grading-feedback";

describe("AI hodnocení – podklady učitele", () => {
  it("klient posílá ID úkolu, aby server dočetl lekci a materiály tokenem učitele", () => {
    const body = buildAssignmentFeedbackRequest({
      assignment: { id: "11111111-1111-4111-8111-111111111111", title: "Úkol" },
      answers: "odpověď", attachments: [],
    });
    expect(body.assignmentId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("bez ID se pole neposílá (starší volání beze změny)", () => {
    const body = buildAssignmentFeedbackRequest({ assignment: { title: "Úkol" }, answers: "x", attachments: [] });
    expect("assignmentId" in body).toBe(false);
  });

  it("lekce a materiály jsou v promptu označené jako podklad, ne práce žáka", () => {
    const parts = buildUserContent({
      question: "Zadání", answerText: "Moje práce", attachments: [],
      lesson: { title: "Lekce 6", text: "Text kapitoly" },
      teacherMaterials: [{ title: "pokyny.pdf", status: "ok", text: "Obsah pokynů" }, { title: "web", status: "link" }],
    });
    const all = parts.map((p) => ("text" in p ? p.text : "")).join("\n");
    expect(all).toContain("propojená lekce „Lekce 6“ (není to práce žáka)");
    expect(all).toContain("Text kapitoly");
    expect(all).toContain("materiál 1 (pokyny.pdf), NENÍ práce žáka");
    expect(all).toContain("Žák neodevzdal žádné přílohy.");
    expect(SYSTEM_PROMPT).toContain("NIKDY je nepovažuj za práci žáka");
  });
});
