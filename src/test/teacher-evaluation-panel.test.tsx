import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeacherEvaluationPanel from "@/components/teacher/TeacherEvaluationPanel";
import type { TeacherEvaluationBase, TeacherEvaluationDetail } from "@/lib/teacher-evaluation";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  loadBase: vi.fn(),
  loadDetail: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher-1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/lib/teacher-evaluation", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/teacher-evaluation")>();
  return { ...original, loadTeacherEvaluationBase: mocks.loadBase, loadTeacherEvaluationDetail: mocks.loadDetail };
});

const assignments = ["l1", "l2", "l3"].map((lessonId, index) => ({
  id: `a${index + 1}`,
  title: `Úkol ${index + 1}`,
  class_id: "c1",
  group_id: null,
  lesson_plan_id: null,
  lesson_id: lessonId,
  lesson_source: "textbook_lessons",
  status: "published",
  subjectKey: "id:s1",
  subjectLabel: "Administrativa",
}));
const base: TeacherEvaluationBase = {
  assignments,
  classes: [{ id: "c1", name: "1. A" }],
  groups: [],
  classMembers: [{ class_id: "c1", user_id: "student-1" }],
  groupMembers: [],
  recipientsMap: {},
  profiles: { "student-1": { first_name: "Jmeno", last_name: "Soukrome" } },
};
const detail: TeacherEvaluationDetail = {
  attempts: assignments.map((assignment, index) => ({
    id: `t${index + 1}`,
    assignment_id: assignment.id,
    status: "submitted",
    score: 4 + index,
    max_score: 10,
    submitted_at: `2026-11-0${index + 1}T10:00:00Z`,
    attempt_number: 1,
  })),
  activities: [],
  practice: [],
  mastery: [],
  lessons: assignments.map((assignment, index) => ({
    id: assignment.lesson_id,
    title: `Téma ${index + 1}`,
    subjectKey: "id:s1",
    subjectLabel: "Administrativa",
  })),
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TeacherEvaluationPanel fixedStudentId="student-1" fixedScope="c:c1" defaultSubject="id:s1" /></QueryClientProvider>);
}

describe("učitelský panel Vyhodnocení", () => {
  beforeEach(() => {
    mocks.loadBase.mockClear();
    mocks.loadDetail.mockClear();
    mocks.loadBase.mockResolvedValue(base);
    mocks.loadDetail.mockResolvedValue(detail);
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue({ data: {
      basedOn: "2026-11-03T10:00:00Z",
      suggestions: detail.lessons.map((lesson) => ({ key: `lesson:${lesson.id}`, title: lesson.title, reason: "Krátké zdůvodnění.", practiceHref: `/student/metody/5p/procviceni?lesson=${lesson.id}&min=10` })),
    }, error: null });
  });

  it("ukáže interní souhrn, témata a počet podkladů", async () => {
    renderPanel();
    expect(await screen.findByText("Orientační úspěšnost:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Interní přehled pouze pro učitele. Žák ani rodič ho nevidí.")).toBeInTheDocument();
    expect(screen.getByText("Téma 1")).toBeInTheDocument();
    expect(screen.getByText(/Ze 3 podkladů/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Navrhnout, co opakovat" })).toBeEnabled();
  });

  it("do AI pošle pseudonymizovaná čísla bez jména a návrh neuloží", async () => {
    renderPanel();
    const button = await screen.findByRole("button", { name: "Navrhnout, co opakovat" });
    fireEvent.click(button);
    await screen.findByTestId("evaluation-ai-result");
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const [name, request] = mocks.invoke.mock.calls[0];
    expect(name).toBe("suggest-evaluation-repetition");
    const serialized = JSON.stringify(request.body);
    expect(serialized).not.toContain("Jmeno");
    expect(serialized).not.toContain("Soukrome");
    expect(serialized).not.toContain("1. A");
    expect(serialized).not.toContain("answers");
    expect(request.body.topics).toHaveLength(3);
    expect(request.body.topics.every((topic: Record<string, unknown>) => topic.key && topic.label && "successPct" in topic)).toBe(true);
    expect(screen.getByText("AI generováno")).toBeInTheDocument();
    expect(mocks.loadBase).toHaveBeenCalledTimes(1);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "Kopírovat" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Co opakovat")));
    fireEvent.click(screen.getByRole("button", { name: "Zavřít návrh" }));
    await waitFor(() => expect(screen.queryByTestId("evaluation-ai-result")).not.toBeInTheDocument());
  });
});
