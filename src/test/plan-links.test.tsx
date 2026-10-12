import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) , storage: { from: () => ({}) } } }));
vi.mock("@/components/worksheet/PublishWorksheetDialog", () => ({ default: () => null }));

import PlanLinksPanel from "@/components/lesson-plan/PlanLinksPanel";
import { emptyLinks, teacherLessonHref, type PlanLinks } from "@/lib/plan-links";

const full: PlanLinks = {
  lesson: { id: "l1", title: "Rajonizace", textbook: "Zeměpis 8", href: teacherLessonHref("l1", "teacher_textbook_lessons", "tb1") },
  worksheets: [{ id: "w1", title: "List A", state: "draft", subject_id: null, href: "/ucitel/pracovni-listy/w1" }],
  materials: [{ id: "m1", kind: "link", title: "Odkaz", url: "example.com" }],
  assignments: [{ id: "a1", title: "Úkol 1", deadline: null, status: "published", href: "/ucitel/ulohy?detail=a1" }],
  presentations: [],
};

const r = (l: PlanLinks | null) => render(<MemoryRouter><PlanLinksPanel links={l} /></MemoryRouter>);

describe("panel K této hodině", () => {
  it("zobrazí jen existující položky se správnými cíli", () => {
    r(full);
    expect(screen.getByTestId("link-lesson").getAttribute("href")).toBe("/ucitel/ucebnice/tb1?lesson=l1");
    expect(screen.getByTestId("link-worksheet").getAttribute("href")).toBe("/ucitel/pracovni-listy/w1");
    expect(screen.getByTestId("link-assignment").getAttribute("href")).toBe("/ucitel/ulohy?detail=a1");
    expect(screen.getByTestId("link-material")).toBeTruthy();
    expect(screen.queryByTestId("link-presentation")).toBeNull();
    expect(screen.getByText("Publikovat")).toBeTruthy();
  });
  it("bez obsahu se panel nezobrazí", () => {
    r(emptyLinks());
    expect(screen.queryByTestId("plan-links-panel")).toBeNull();
  });
  it("globální lekce vede do učebnice", () => {
    expect(teacherLessonHref("x", "textbook_lessons")).toBe("/ucebnice/obsah/0/lekce/x");
  });
});
