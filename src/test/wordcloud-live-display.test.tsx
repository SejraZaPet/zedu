import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WordCloudView from "@/components/activities/WordCloudView";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import StudentGamePlay from "@/pages/StudentGamePlay";
import { isWordcloudShown } from "@/lib/wordcloud-visibility";

const rpc = vi.hoisted(() => vi.fn());
const game = vi.hoisted(() => ({ session: null as any }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverMock;

const slide = {
  slideId: "slide-wordcloud-test",
  type: "activity",
  projector: { headline: "[TEST] Jedním slovem" },
  blocks: [],
  activitySpec: {
    activityType: "wordcloud",
    question: "[TEST] Co vás napadne?",
    colors: { card: "#F3F1E6", text: "#2B1A3F", answer: "#FFFFFF", accent: "#663196" },
  },
};

const response = (text: string) => ({ answer: { text } });

describe("isWordcloudShown", () => {
  it("bez nastavení a ve starší publikované relaci je mrak viditelný", () => {
    expect(isWordcloudShown(undefined, 0)).toBe(true);
    expect(isWordcloudShown({}, 0)).toBe(true);
    expect(isWordcloudShown({ wordcloudPublished: true, wordcloudPublishedQuestion: 0 }, 0)).toBe(true);
  });

  it("skrytí platí jen pro snímek, na kterém ho učitel výslovně nastavil", () => {
    const hidden = { wordcloudPublished: false, wordcloudPublishedQuestion: 2 };
    expect(isWordcloudShown(hidden, 2)).toBe(false);
    expect(isWordcloudShown(hidden, 1)).toBe(true);
    expect(isWordcloudShown(hidden, 3)).toBe(true);
  });
});

describe("WordCloudView", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it("prázdný světlý mrak má čitelný text a počet přijatých příspěvků", async () => {
    render(
      <WordCloudView
        sessionId="session-test"
        questionIndex={0}
        colors={slide.activitySpec.colors}
        projector
      />,
    );

    expect(await screen.findByText("Čekám na příspěvky žáků…")).toBeInTheDocument();
    expect(screen.getByText("0 příspěvků přijato")).toBeInTheDocument();
    expect(screen.getByTestId("wordcloud-projector")).toHaveStyle({ color: "#2B1A3F" });
  });

  it("velikost slov odvozuje plynule od maxima a paletu od tmavého podkladu", async () => {
    rpc.mockResolvedValue({
      data: [response("[TEST] AI"), response("[TEST] AI"), response("[TEST] Praxe"), response("[TEST] Tým")],
      error: null,
    });
    render(
      <WordCloudView
        sessionId="session-test"
        questionIndex={0}
        colors={{ card: "#2B1A3F", text: "#FFFFFF", answer: "#F3F1E6", accent: "#63C7CF" }}
        projector
      />,
    );

    const mostFrequent = await screen.findByText("[TEST] AI");
    const single = screen.getByText("[TEST] Praxe");
    expect(parseFloat(mostFrequent.style.fontSize)).toBeGreaterThan(parseFloat(single.style.fontSize));
    expect(parseFloat(mostFrequent.style.fontSize)).toBe(128);
    expect(screen.getByTestId("wordcloud-projector")).toHaveStyle({ backgroundColor: "#2B1A3F" });
  });
});

describe("živé zobrazení mraku", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [response("[TEST] Živé")], error: null });
    sessionStorage.setItem("game_player_session-test", "player-test");
    sessionStorage.setItem("game_token_session-test", "test-token");
    game.session = {
      id: "session-test",
      status: "playing",
      current_question_index: 0,
      settings: {},
      activity_data: [slide],
      teams: { teams: [] },
    };
  });

  afterEach(() => {
    sessionStorage.clear();
    game.session = null;
  });

  it("projektor ukazuje mrak bez kliknutí, skryje ho jen explicitně a neukazuje editorský pokyn", async () => {
    const shown = render(
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
    expect(await screen.findByText("[TEST] Živé")).toBeInTheDocument();
    expect(screen.getByTestId("wordcloud-question")).toHaveTextContent("[TEST] Co vás napadne?");
    expect(screen.queryByText("Aktivita · Slovní mrak")).not.toBeInTheDocument();
    expect(screen.queryByText(/Obsah aktivity upravíte v panelu vpravo/)).not.toBeInTheDocument();
    shown.unmount();

    render(
      <ProjectorSlideView
        sessionId="session-test"
        session={{ title: "[TEST] Prezentace", status: "playing", settings: { wordcloudPublished: false, wordcloudPublishedQuestion: 0 } }}
        currentSlide={slide}
        currentIndex={0}
        slides={[slide]}
        players={[]}
        gameCode="TEST"
      />,
    );
    expect(await screen.findByText(/Učitel zobrazí mrak/)).toBeInTheDocument();
    expect(screen.queryByText("[TEST] Živé")).not.toBeInTheDocument();
  });

  it("žákovské zařízení ukazuje příspěvky hned od začátku snímku", async () => {
    render(
      <MemoryRouter initialEntries={["/live/play/session-test"]}>
        <Routes>
          <Route path="/live/play/:sessionId" element={<StudentGamePlay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("[TEST] Živé")).toBeInTheDocument();
  });
});
