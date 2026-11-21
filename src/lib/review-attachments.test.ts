import { describe, it, expect } from "vitest";
import { attachmentsForSubmission } from "./review-attachments";

const f = (id: string, student_id: string) => ({ id, assignment_id: "a1", student_id, file_name: id, file_path: `a/${student_id}/${id}`, file_size: 1 });

describe("attachmentsForSubmission", () => {
  const all = [f("1", "s1"), f("2", "s2"), f("3", "s1")];
  it("ukáže jen přílohy daného žáka", () => {
    expect(attachmentsForSubmission(all, "s1").map((a) => a.id)).toEqual(["1", "3"]);
  });
  it("u skupinové práce ukáže přílohy všech členů", () => {
    expect(attachmentsForSubmission(all, "s1", ["s2"]).map((a) => a.id)).toEqual(["1", "2", "3"]);
  });
  it("žák bez příloh nedostane cizí soubory", () => {
    expect(attachmentsForSubmission(all, "s9")).toEqual([]);
  });
});
