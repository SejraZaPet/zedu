import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LessonAssignments, { type Assignment } from "@/components/admin/LessonAssignments";

/** Témata existují i pro předměty, které nejsou ve starém `textbook_subjects`. */
const topicRows = [
  { subject: "ekonomika", grade: 1 },
  { subject: "ekonomika", grade: 2 },
  { subject: "technologie", grade: 2 },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    from: (table: string) => {
      if (table === "textbook_topics") {
        const rows = [
          { id: "t-eko-1", title: "Úvod do ekonomiky", subject: "ekonomika", grade: 1 },
        ];
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          order: () => Promise.resolve({ data: rows, error: null }),
          then: (res: any) => Promise.resolve({ data: topicRows, error: null }).then(res),
        };
        return builder;
      }
      if (table === "textbook_subjects") {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          order: () => Promise.resolve({ data: [{ id: "s1", slug: "technologie", label: "Technologie", active: true, sort_order: 1, textbook_grades: [{ id: "g", subject_id: "s1", grade_number: 2, label: "2", sort_order: 1 }] }], error: null }),
        };
        return builder;
      }
      if (table === "subjects") {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [{ id: "c1", name: "Ekonomika", color: "#fff", abbreviation: null, school_id: null, created_by: null, archived: false }],
              error: null,
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    },
  },
}));

vi.mock("@/hooks/useTeacherClasses", () => ({ useTeacherClasses: () => ({ myClasses: [], classes: [] }) }));
vi.mock("@/hooks/useSubjectGroups", () => ({ useSubjectGroups: () => ({ groups: [] }) }));

const assignment: Assignment = {
  topic_id: "",
  subject: "ekonomika",
  grade: 1,
  topic_title: "",
  sort_order: 0,
  status: "published",
  target_type: "grade",
};

const renderRow = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LessonAssignments lessonId="l1" assignments={[assignment]} onChange={() => {}} />
    </QueryClientProvider>,
  );
};

describe("umístění lekce – zdroj předmětů", () => {
  it("nabídne předmět z kanonického katalogu (ekonomika) a jeho ročníky z témat", async () => {
    renderRow();

    // Předmět uložený u lekce je rozpoznaný a zobrazený.
    await waitFor(() => expect(screen.getByText("Ekonomika")).toBeInTheDocument());

    // Ročník není zamčený a nabízí ročníky, pro které existují témata.
    const gradeTrigger = screen.getByText("1. ročník").closest("button")!;
    expect(gradeTrigger).not.toBeDisabled();
    fireEvent.click(gradeTrigger);
    fireEvent.keyDown(gradeTrigger, { key: "Enter" });
    await waitFor(() => expect(screen.getAllByText("2. ročník").length).toBeGreaterThan(0));
  });
});
