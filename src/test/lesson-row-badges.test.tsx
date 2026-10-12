import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import LessonRowBadges, { TODAY_ROW_CLASS } from "@/components/lesson/LessonRowBadges";
import { assignmentLabel, computeRowBadges, isTodayLesson, isUpcomingLesson } from "@/lib/lesson-row-badges";

const now = new Date(2026, 9, 12, 9, 30);
const at = (h: number, m = 0, d = 12) => new Date(2026, 9, d, h, m);

describe("Průběh – dnešní hodina a ikonky", () => {
  it("probíhající hodina je dnešní a patří do „Co nás čeká“, minulá ne", () => {
    const running = { start: at(9), end: at(9, 45) };
    const ended = { start: at(8), end: at(8, 45) };
    const tomorrow = { start: at(9, 0, 13), end: at(9, 45, 13) };
    expect(isUpcomingLesson(running, now)).toBe(true);
    expect(isTodayLesson(running, now)).toBe(true);
    expect(isUpcomingLesson(ended, now)).toBe(false);
    expect(isTodayLesson(ended, now)).toBe(false);
    expect(isTodayLesson(tomorrow, now)).toBe(false);
    expect(TODAY_ROW_CLASS).toContain("bg-gradient-brand");
  });

  it("ikonky jen tam, kde něco existuje", () => {
    const empty = computeRowBadges({ assignments: [] });
    const { container } = render(<LessonRowBadges badges={empty} />);
    expect(container.innerHTML).toBe("");

    const b = computeRowBadges({
      topicMaterials: 1, planMaterials: 1, planWorksheetIds: ["w1"], lessonId: "L",
      assignments: [{ id: "a", deadline: "2026-10-15T10:00:00", worksheet_id: "w1" }, { id: "x", deadline: null, lesson_id: "other" }],
    });
    expect(b).toEqual({ attachments: 2, worksheets: 1, assignment: { deadline: "2026-10-15T10:00:00" } });
    render(<LessonRowBadges badges={b} />);
    expect(screen.getByLabelText("2 přílohy")).toBeTruthy();
    expect(screen.getByLabelText("Pracovní list")).toBeTruthy();
    expect(screen.getByLabelText("Úkol do 15. 10.")).toBeTruthy();
    expect(assignmentLabel(null)).toBe("Úkol");
  });

  it("„Co nás čeká“ je vlevo / první, „Co jsme probrali“ vpravo", () => {
    const src = readFileSync("src/pages/TeacherSubjectClass.tsx", "utf8");
    expect(src).toMatch(/className="order-1" data-testid="section-upcoming"/);
    expect(src).toMatch(/className="order-2" data-testid="section-past"/);
  });
});
