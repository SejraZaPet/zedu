import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ActivitySpecPreview from "@/components/presentation/ActivitySpecPreview";
import SlideCanvas from "@/components/admin/SlideCanvas";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import StudentGamePlay from "@/pages/StudentGamePlay";

const game = vi.hoisted(() => ({ session: null as any }));

vi.mock("@/hooks/useGameSession", () => ({
  useGameSession: () => ({
    session: game.session,
    players: [{ id: "player-test", nickname: "[TEST] Žák", total_score: 0, student_index: 0 }],
    responses: [],
    loading: false,
    connectionStatus: "connected",
    reconnect: vi.fn(),
    refreshPlayers: vi.fn(),
  }),
}));
vi.mock("@/hooks/useFinalGameResults", () => ({
  useFinalGameResults: () => ({ result: null, retry: vi.fn() }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverMock;

const mcqSpec = {
  activityType: "mcq",
  question: "[TEST] Hlavní město?",
  options: [
    { text: "[TEST] Praha", correct: true },
    { text: "[TEST] Brno", correct: false },
  ],
};

const trueFalseSlide = {
  slideId: "slide-test-tf",
  type: "activity",
  projector: { headline: "[TEST] Pravda nebo nepravda" },
  blocks: [],
  activitySpec: {
    activityType: "true_false",
    trueFalse: { statements: [{ text: "[TEST] Země je kulatá", isTrue: true }] },
  },
};

const expectNoPrematureAnswer = (container: HTMLElement) => {
  expect(screen.queryByText(/správná/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/správná odpověď/i)).not.toBeInTheDocument();
  expect(container.querySelector("[data-correct]")).toBeNull();
};

describe("ActivitySpecPreview – bezpečné skrytí řešení", () => {
  it("bez revealAnswers neobsahuje označení, atribut ani odlišné ohraničení správné odpovědi", () => {
    const { container } = render(<ActivitySpecPreview spec={mcqSpec} />);

    expectNoPrematureAnswer(container);
    const answers = Array.from(container.querySelectorAll("li"));
    expect(answers).toHaveLength(2);
    expect(answers.every((answer) => answer.style.borderColor === "transparent")).toBe(true);
  });

  it("s revealAnswers označí správnou odpověď včetně DOM atributu", () => {
    const { container } = render(<ActivitySpecPreview spec={mcqSpec} revealAnswers />);

    expect(screen.getByText("✓ správná")).toBeInTheDocument();
    expect(container.querySelector('[data-correct="true"]')).toHaveTextContent("[TEST] Praha");
  });

  it("pravda/nepravda odhalí řešení jen po explicitním povolení", () => {
    const spec = trueFalseSlide.activitySpec;
    const hidden = render(<ActivitySpecPreview spec={spec} />);
    expectNoPrematureAnswer(hidden.container);
    hidden.unmount();

    const revealed = render(<ActivitySpecPreview spec={spec} revealAnswers />);
    expect(revealed.container.querySelector('[data-correct="true"]')).toHaveTextContent("[TEST] Země je kulatá");
  });

  it("párování a řazení bez povolení neprozradí dvojice ani správné pořadí", () => {
    const matching = render(<ActivitySpecPreview spec={{ activityType: "matching", matching: { left: ["[TEST] Praha"], right: ["[TEST] Česko"] } }} />);
    expect(screen.getByText("[TEST] Praha → ?")).toBeInTheDocument();
    expect(screen.queryByText("[TEST] Praha → [TEST] Česko")).not.toBeInTheDocument();
    matching.unmount();

    const ordering = render(<ActivitySpecPreview spec={{ activityType: "ordering", ordering: { items: ["[TEST] Závěr", "[TEST] Úvod"] } }} />);
    expect(screen.queryByText("1. [TEST] Závěr")).not.toBeInTheDocument();
    expect(screen.getByText("• [TEST] Úvod")).toBeInTheDocument();
    ordering.unmount();

    render(<ActivitySpecPreview revealAnswers spec={{ activityType: "ordering", ordering: { items: ["[TEST] Závěr", "[TEST] Úvod"] } }} />);
    expect(screen.getByText("1. [TEST] Závěr")).toBeInTheDocument();
  });

  it("SlideCanvas předává explicitní oprávnění i do samostatného activity bloku", () => {
    const slide = {
      type: "activity",
      projector: { headline: "[TEST] Kvíz" },
      blocks: [{ id: "activity-test", type: "activity", renderAs: "activity-preview", props: mcqSpec }],
    };
    const hidden = render(<SlideCanvas slide={slide} />);
    expectNoPrematureAnswer(hidden.container);
    hidden.unmount();

    const revealed = render(<SlideCanvas slide={slide} showCorrectAnswers />);
    expect(revealed.container.querySelector('[data-correct="true"]')).toBeInTheDocument();
  });
});

describe("živá projekce a žákovské zařízení", () => {
  beforeEach(() => {
    sessionStorage.setItem("game_player_session-test", "player-test");
    sessionStorage.setItem("game_token_session-test", "test-token");
    game.session = {
      id: "session-test",
      status: "playing",
      current_question_index: 0,
      settings: {},
      activity_data: [trueFalseSlide],
      teams: { teams: [] },
    };
  });

  afterEach(() => {
    sessionStorage.clear();
    game.session = null;
  });

  it("ProjectorSlideView před zveřejněním neukáže řešení; po něm jen výsledkový náhled", () => {
    const slide = { ...trueFalseSlide, activitySpec: mcqSpec };
    const hidden = render(
      <ProjectorSlideView
        sessionId="session-test"
        session={{ title: "[TEST] Prezentace", status: "playing", settings: {} }}
        currentSlide={slide}
        currentIndex={0}
        slides={[slide]}
        players={[]}
        gameCode="TEST"
      />,
    );
    expectNoPrematureAnswer(hidden.container);
    hidden.unmount();

    const revealed = render(
      <ProjectorSlideView
        sessionId="session-test"
        session={{ title: "[TEST] Prezentace", status: "question_results", settings: { mcqRevealedQuestion: 0 } }}
        currentSlide={slide}
        currentIndex={0}
        slides={[slide]}
        players={[]}
        gameCode="TEST"
      />,
    );
    expect(screen.getByLabelText("Správná odpověď")).toBeInTheDocument();
    expect(revealed.container.querySelector("[data-correct]")).toBeNull();
  });

  it("StudentGamePlay neukáže správnou odpověď před kontrolou", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/live/play/session-test"]}>
        <Routes>
          <Route path="/live/play/:sessionId" element={<StudentGamePlay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("[TEST] Země je kulatá").length).toBeGreaterThan(0);
    expectNoPrematureAnswer(container);
  });
});
