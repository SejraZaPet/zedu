import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
const chatProps = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
  },
}));
vi.mock("@/components/BezlaiTutorChat", () => ({
  default: (p: { open: boolean }) => {
    chatProps(p);
    return p.open ? <div data-testid="chat-open" /> : null;
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import LessonStudyBar from "@/components/lesson/LessonStudyBar";

const longText = "Hygiena ve společném stravování je důležitá. ".repeat(20);
const blocks = [{ type: "text", props: { text: longText } }];

const renderBar = (b: unknown = blocks) =>
  render(
    <MemoryRouter>
      <LessonStudyBar lessonId="lesson-123" lessonTitle="Hygiena" blocks={b} />
    </MemoryRouter>,
  );

describe("LessonStudyBar – Učím se", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("v liště je jen jedno tlačítko Učím se", () => {
    renderBar();
    const bar = screen.getByLabelText("Studijní nástroje lekce");
    const buttons = within(bar).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Učím se");
  });

  it("panel má dvě sekce a 8 technik s odkazem na lekci", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /Učím se/ }));
    expect(screen.getByText("Rychle procvičit")).toBeInTheDocument();
    expect(screen.getByText("Podle techniky")).toBeInTheDocument();
    const slugs = ["sq4r", "pqrst", "5p", "neana", "sekvencni", "akrostika", "loci", "pomodoro"];
    for (const slug of slugs) {
      expect(screen.getByTestId(`technique-${slug}`)).toHaveAttribute(
        "href",
        `/student/metody/${slug}/procviceni?lesson=lesson-123&min=10`,
      );
    }
    expect(screen.getAllByText("Jak technika funguje")).toHaveLength(8);
  });

  it("Shrnutí a Kartičky volají stejnou funkci lesson-study-helper", async () => {
    invoke.mockResolvedValue({ data: { bullets: ["a"], cards: [] }, error: null });
    renderBar([]);
    fireEvent.click(screen.getByRole("button", { name: /Učím se/ }));
    fireEvent.click(screen.getByRole("button", { name: /Shrnutí/ }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("lesson-study-helper", { body: { lesson_id: "lesson-123", mode: "summary" } }),
    );
    cleanup();
    renderBar([]);
    fireEvent.click(screen.getByRole("button", { name: /Učím se/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kartičky/ }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("lesson-study-helper", { body: { lesson_id: "lesson-123", mode: "cards" } }),
    );
  });

  it("Zeptat se otevře stejný chat ZedAI", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /Učím se/ }));
    fireEvent.click(screen.getByRole("button", { name: /Zeptat se/ }));
    expect(screen.getByTestId("chat-open")).toBeInTheDocument();
  });

  it("lekce s málo textem ukáže srozumitelnou hlášku", () => {
    renderBar([{ type: "text", props: { text: "Krátké." } }]);
    fireEvent.click(screen.getByRole("button", { name: /Učím se/ }));
    expect(screen.getByRole("status")).toHaveTextContent("nemá dost textu");
  });
});
