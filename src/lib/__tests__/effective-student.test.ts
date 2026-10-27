import { describe, it, expect, vi } from "vitest";
import { resolveEffectiveStudent, PREVIEW_DEMO_STUDENT_ID, blockPreviewWrite } from "../effective-student";

describe("effective student", () => {
  it("admin viewing as student reads demo student in preview", () => {
    expect(resolveEffectiveStudent("me", "admin", "user")).toEqual({ studentId: PREVIEW_DEMO_STUDENT_ID, isPreview: true });
  });
  it("normal student uses own id", () => {
    expect(resolveEffectiveStudent("me", "user", null)).toEqual({ studentId: "me", isPreview: false });
  });
  it("non-admin cannot trigger preview", () => {
    expect(resolveEffectiveStudent("me", "teacher", "user").isPreview).toBe(false);
  });
  it("admin viewing as teacher is not student preview", () => {
    expect(resolveEffectiveStudent("me", "admin", "teacher").studentId).toBe("me");
  });
  it("writes are blocked in preview", () => {
    const n = vi.fn();
    expect(blockPreviewWrite(true, n)).toBe(true);
    expect(n).toHaveBeenCalled();
    expect(blockPreviewWrite(false, n)).toBe(false);
  });
});
