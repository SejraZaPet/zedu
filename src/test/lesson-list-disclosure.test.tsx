import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { LessonListDisclosure, useLessonListDisclosure } from "@/components/lesson/LessonListDisclosure";
import { isUpcomingLesson, isTodayLesson } from "@/lib/lesson-row-badges";
import { TODAY_ROW_CLASS } from "@/components/lesson/LessonRowBadges";

function List({ count, label }: { count: number; label: string }) {
  const list = useLessonListDisclosure(Array.from({ length: count }, (_, i) => i));
  return <section aria-label={label}>
    <div data-testid={`${label}-rows`} className={list.className}>
      {list.visible.map((i) => <article key={i}>{i === 0 ? "Dnes" : `Hodina ${i}`}</article>)}
    </div>
    <LessonListDisclosure {...list} />
  </section>;
}

describe("Rozbalování hodin", () => {
  it("ukáže pět, rozbalí všechny s rolováním a vrátí pět nezávisle na druhém seznamu", () => {
    render(<><List count={20} label="budoucí" /><List count={12} label="minulé" /></>);
    const future = within(screen.getByRole("region", { name: "budoucí" }));
    const past = within(screen.getByRole("region", { name: "minulé" }));
    expect(future.getAllByRole("article")).toHaveLength(5);
    expect(past.getAllByRole("article")).toHaveLength(5);
    fireEvent.click(future.getByRole("button", { name: "Ukázat vše (20)" }));
    expect(future.getAllByRole("article")).toHaveLength(20);
    expect(past.getAllByRole("article")).toHaveLength(5);
    expect(future.getByTestId("budoucí-rows")).toHaveClass("overflow-y-auto", "max-h-[70vh]");
    expect(future.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(past.getByRole("button", { name: "Ukázat vše (12)" }));
    fireEvent.click(future.getByRole("button", { name: "Zobrazit méně" }));
    expect(future.getAllByRole("article")).toHaveLength(5);
    expect(past.getAllByRole("article")).toHaveLength(12);
    expect(future.getByText("Dnes")).toBeVisible();
  });

  it.each([0, 1, 5])("neukáže tlačítko pro %i hodin", (count) => {
    render(<List count={count} label="krátký" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(count);
  });

  it("obě stránky omezují jen zobrazení a dávkové odkazy berou viditelné hodiny", () => {
    for (const name of ["TeacherSubjectClass", "StudentSubjectClass"]) {
      const source = readFileSync(`src/pages/${name}.tsx`, "utf8");
      expect(source).not.toContain("slice(0, 15)");
      expect(source).not.toContain("slice(-15)");
      expect(source).toContain("pastList.visible.map");
      expect(source).toContain("upcomingList.visible.map");
      expect(source).toContain("isUpcomingLesson(e, now) && e.start <= upcomingLimit");
      expect(source).toContain("reverse().slice(0, 200)");
    }
    const source = readFileSync("src/pages/TeacherSubjectClass.tsx", "utf8");
    expect(source).toContain("const shownPlanIdsKey = [...pastList.visible, ...upcomingList.visible]");
    expect(source).toContain("loadPlanLinks(ids)");
  });

  it("probíhající dnešní hodina zůstane první a zvýrazněná mezi pěti", () => {
    const now = new Date(2026, 9, 12, 9, 30);
    const lessons = Array.from({ length: 10 }, (_, i) => ({
      start: new Date(2026, 9, 12 + i, 9), end: new Date(2026, 9, 12 + i, 10),
    }));
    const visible = lessons.filter((e) => isUpcomingLesson(e, now)).slice(0, 5);
    expect(visible).toHaveLength(5);
    expect(isTodayLesson(visible[0], now)).toBe(true);
    expect(TODAY_ROW_CLASS).toContain("bg-gradient-brand");
  });
});