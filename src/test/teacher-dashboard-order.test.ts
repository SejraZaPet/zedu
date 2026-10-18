import { describe, expect, it } from "vitest";
import { mergeTeacherDashboardOrder } from "@/lib/teacher-dashboard-order";

const defaults = ["today", "classroom-tools", "subjects", "profile"];
describe("dashboard tools discovery", () => {
  it("adds new tools after today for an existing demo session", () => {
    expect(mergeTeacherDashboardOrder(["profile", "today", "subjects"], defaults))
      .toEqual(["profile", "today", "classroom-tools", "subjects"]);
  });
  it("preserves a deliberately saved tools position", () => {
    expect(mergeTeacherDashboardOrder(["subjects", "today", "profile", "classroom-tools"], defaults))
      .toEqual(["subjects", "today", "profile", "classroom-tools"]);
  });
  it("removes obsolete and duplicate widgets without changing the remaining order", () => {
    expect(mergeTeacherDashboardOrder(["obsolete", "profile", "profile", "subjects"], defaults))
      .toEqual(["classroom-tools", "profile", "subjects", "today"]);
  });
});