import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  insert: vi.fn(),
  tables: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: "student-1" } } } })) },
    functions: { invoke: mocks.invoke },
    from: (table: string) => {
      mocks.tables.push(table);
      if (table === "study_methods") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "method-1" }, error: null }) }) }) };
      }
      if (table === "student_practice_sessions") return { insert: mocks.insert };
      throw new Error(`Neočekávaný dotaz do ${table}`);
    },
  },
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div /> }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useParams: () => ({ slug: "sq4r" }),
  useSearchParams: () => [new URLSearchParams("source=custom&min=15")],
  useNavigate: () => vi.fn(),
}));

import StudentPractice from "@/pages/StudentPractice";
import { PRACTICE_SOURCE_KEY } from "@/lib/practice-method";

const SOURCE_TEXT = "Fotosyntéza přeměňuje světelnou energii na chemickou energii. ".repeat(5).trim();

describe("procvičování z potvrzené fotografie", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.tables.length = 0;
  });

  it("předá photo do RAG a uloží jen typ zdroje, null lekci a skóre bez textu", async () => {
    sessionStorage.setItem(PRACTICE_SOURCE_KEY, JSON.stringify({ kind: "photo", text: SOURCE_TEXT, label: "Fotografie" }));
    mocks.invoke.mockResolvedValue({
      data: {
        lesson: null,
        target_difficulty: "medium",
        phases: [
          { key: "read", title: "Čtení", instruction: "Přečti", kind: "read", content: { text: SOURCE_TEXT }, questions: [] },
          { key: "review", title: "Kvíz", instruction: "Odpověz", kind: "questions", questions: [
            { type: "true_false", text: "Fotosyntéza používá světlo.", correct_answer: true },
          ] },
        ],
      },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });

    render(<StudentPractice />);
    expect(await screen.findByText("Fotosyntéza používá světlo.")).toBeInTheDocument();
    expect(screen.getByText("Zdroj: Fotografie")).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("ai-practice-rag", {
      body: { source_text: SOURCE_TEXT, source_kind: "photo", method: "sq4r", question_count: 12 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Pravda" }));
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    const saved = mocks.insert.mock.calls[0][0];
    expect(saved).toMatchObject({
      student_id: "student-1",
      method_id: "method-1",
      lesson_id: null,
      duration_min: 15,
      score: 1,
      answers_json: { source: { kind: "photo" }, score: 1, total_scorable: 1, percent: 100 },
    });
    expect(saved.answers_json.phases[0].content).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain(SOURCE_TEXT);
    expect(mocks.tables).not.toContain("student_lesson_mastery");
    expect(await screen.findByText("1 / 1 (100 %)")).toBeInTheDocument();
  });
});
