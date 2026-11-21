import { describe, expect, it } from "vitest";
import {
  createDefaultTeacherDashboardOrder,
  DEFAULT_TEACHER_DASHBOARD_ORDER,
  migrateTeacherDashboardOrder,
  moveTeacherDashboardTile,
  parseTeacherDashboardOrder,
  serializeTeacherDashboardOrder,
} from "@/lib/teacher-dashboard-order";

describe("učitelský přehled – skupinové pořadí v2", () => {
  it("má pevné skupiny a všech 16 dlaždic přesně jednou", () => {
    const order = createDefaultTeacherDashboardOrder();
    expect(Object.keys(order)).toEqual(["priority", "teaching", "preparation", "classes", "personal"]);
    const ids = Object.values(order).flat();
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);
    expect(order).toEqual(DEFAULT_TEACHER_DASHBOARD_ORDER);
    expect(order).not.toBe(DEFAULT_TEACHER_DASHBOARD_ORDER);
    expect(order.priority).not.toBe(DEFAULT_TEACHER_DASHBOARD_ORDER.priority);
  });

  it("migruje ploché v1 a zachová relativní pořadí uvnitř nových skupin", () => {
    const migrated = migrateTeacherDashboardOrder([
      "profile", "subjects", "today", "assignments", "activities", "classroom-tools", "review", "calendar",
    ]);
    expect(migrated.priority).toEqual(["activities", "review"]);
    expect(migrated.teaching).toEqual(["assignments", "classroom-tools", "results"]);
    expect(migrated.classes).toEqual(["subjects", "classes", "svp", "notifications"]);
    expect(migrated.personal).toEqual(["calendar", "todos", "academy"]);
  });

  it("doplní nové dlaždice bez přesunutí uložených a odstraní zastaralé", () => {
    const migrated = migrateTeacherDashboardOrder(["obsolete", "results", "results", "assignments"]);
    expect(migrated.teaching).toEqual(["results", "assignments", "classroom-tools"]);
    expect(migrated.priority).toEqual(["activities", "review"]);
  });

  it("sanitizuje v2, duplicity, cizí ID a chybějící skupiny", () => {
    const migrated = migrateTeacherDashboardOrder({
      version: 2,
      groups: {
        teaching: ["results", "subjects", "results", 42],
        classes: ["notifications", "obsolete"],
      },
    });
    expect(migrated.teaching).toEqual(["results", "classroom-tools", "assignments"]);
    expect(migrated.classes).toEqual(["notifications", "classes", "subjects", "svp"]);
    expect(migrated.preparation).toEqual(DEFAULT_TEACHER_DASHBOARD_ORDER.preparation);
  });

  it.each([null, "broken", 42, {}, { version: 1, groups: {} }])("bez pádu obnoví výchozí pořadí pro %j", (saved) => {
    expect(migrateTeacherDashboardOrder(saved)).toEqual(DEFAULT_TEACHER_DASHBOARD_ORDER);
    expect(parseTeacherDashboardOrder("not-json")).toBeUndefined();
  });

  it("přesune dlaždici jen uvnitř její skupiny", () => {
    const order = createDefaultTeacherDashboardOrder();
    const moved = moveTeacherDashboardTile(order, "results", "classroom-tools");
    expect(moved.teaching).toEqual(["results", "classroom-tools", "assignments"]);
    expect(moved.preparation).toEqual(order.preparation);
    expect(order.teaching).toEqual(["classroom-tools", "assignments", "results"]);
  });

  it("odmítne přesun do jiné skupiny i mezi širokými a běžnými dlaždicemi", () => {
    const order = createDefaultTeacherDashboardOrder();
    expect(moveTeacherDashboardTile(order, "activities", "assignments")).toBe(order);
    expect(moveTeacherDashboardTile(order, "subjects", "worksheets")).toBe(order);
    expect(moveTeacherDashboardTile(order, "unknown", "review")).toBe(order);
  });

  it("serializace v2 zůstane čitelná a obnovená", () => {
    const order = createDefaultTeacherDashboardOrder();
    const raw = serializeTeacherDashboardOrder(order);
    expect(JSON.parse(raw).version).toBe(2);
    expect(migrateTeacherDashboardOrder(parseTeacherDashboardOrder(raw))).toEqual(order);
  });
});
