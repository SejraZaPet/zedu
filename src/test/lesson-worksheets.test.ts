import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { assignmentForWorksheet, pickLessonWorksheets, type LessonWorksheetRow } from "@/lib/lesson-worksheets";

const L = "lesson-1";
const base: LessonWorksheetRow = {
  id: "w1", title: "List", status: "published", show_in_lesson: true, scheduled_publish_at: null, source_lesson_id: L,
};
const NOW = Date.parse("2026-10-11T12:00:00Z");

describe("pracovní listy u lekce", () => {
  it("žák vidí publikovaný list se show_in_lesson = true", () => {
    expect(pickLessonWorksheets([base], L, NOW).map((w) => w.id)).toEqual(["w1"]);
  });

  it("nezobrazí vypnutý list, koncept, budoucí publikaci ani list jiné lekce", () => {
    const rows = [
      { ...base, id: "off", show_in_lesson: false },
      { ...base, id: "draft", status: "draft" },
      { ...base, id: "sched", scheduled_publish_at: "2026-12-01T00:00:00Z" },
      { ...base, id: "other", source_lesson_id: "lesson-2" },
    ];
    expect(pickLessonWorksheets(rows, L, NOW)).toEqual([]);
  });

  it("list zadaný jako úkol vede do úkolu (žádný druhý pokus)", () => {
    const a = assignmentForWorksheet("w1", [
      { id: "old", worksheet_id: "w1", deadline: "2026-01-01T00:00:00Z", status: "published" },
      { id: "next", worksheet_id: "w1", deadline: "2026-10-20T00:00:00Z", status: "published" },
      { id: "draft", worksheet_id: "w1", deadline: "2026-10-12T00:00:00Z", status: "draft" },
    ], NOW);
    expect(a?.id).toBe("next");
    expect(assignmentForWorksheet("w2", [], NOW)).toBeNull();
  });

  it("migrace je aditivní a stávající přístupy přes plán hodiny a úkol zůstávají", () => {
    const dir = "drizzle/migrations";
    const file = readdirSync(dir).find((f) => f.includes("worksheets_show_in_lesson"))!;
    const sql = readFileSync(`${dir}/${file}`, "utf8");
    expect(sql).toMatch(/show_in_lesson boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/can_view_textbook_lesson/);
    expect(sql).not.toMatch(/DROP POLICY|ALTER POLICY/i);
  });
});
