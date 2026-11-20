import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/game/GameAvatarFigure", () => ({ default: () => null }));
vi.mock("@/components/game/QuickGameDialog", () => ({ QuickGameDialog: () => null }));
import { GameLeaderboardFinal } from "@/components/game/GameLeaderboardFinal";
import { accuracyPct } from "@/lib/game-results";
import { canStudentRaiseHand, sortRaisedHands } from "@/lib/raised-hands";
import type { GamePlayer, GameResponse, GameSession } from "@/lib/game-types";

const mk = (id: string, score: number, i: number): GamePlayer => ({ id, session_id: "s", nickname: `[TEST] ${id}`, user_id: null, total_score: score, created_at: `2026-11-20T10:0${i}:00Z` });
const players = [mk("a", 500, 1), mk("b", 400, 2), mk("me", 300, 3), mk("d", 200, 4), mk("e", 100, 5)];
const session = (settings: Record<string, unknown> = {}) => ({ id: "s", title: "[TEST] hra", activity_data: [{}, {}, {}, {}], settings, teams: { teams: [] } }) as unknown as GameSession;
const resp = (player_id: string, question_index: number, is_correct: boolean, answer: unknown = {}) => ({ id: `${player_id}${question_index}`, session_id: "s", player_id, question_index, is_correct, answer, score: 0 }) as unknown as GameResponse;
const view = (s: GameSession, responses: GameResponse[] = [], highlight?: string) =>
  render(<MemoryRouter><GameLeaderboardFinal session={s} players={players} responses={responses} highlightPlayerId={highlight} /></MemoryRouter>);

describe("final podium on student phone", () => {
  it("shows all players with ranks, not only the student", () => {
    view(session(), [], "me");
    for (const id of ["a", "b", "d", "e"]) expect(screen.getAllByText(`[TEST] ${id}`).length).toBeGreaterThan(0);
    expect(screen.getByText("[TEST] me (ty)")).toBeInTheDocument();
    expect(screen.getByText("5.")).toBeInTheDocument();
  });
  it("anonymous mode hides other nicknames but keeps own", () => {
    view(session({ anonymousAnswers: true }), [], "me");
    expect(screen.queryByText("[TEST] a")).toBeNull();
    expect(screen.getByText("Žák 1")).toBeInTheDocument();
    expect(screen.getByText("[TEST] me (ty)")).toBeInTheDocument();
  });
  it("student sees own % and no class % computed from own answers", () => {
    view(session(), [resp("me", 0, true), resp("me", 1, false), resp("me", 2, false, { soloRound: true, correctCount: 3, totalCount: 4 })], "me");
    expect(screen.getByTestId("my-accuracy")).toHaveTextContent("58%");
    expect(screen.queryByTestId("class-accuracy")).toBeNull();
  });
  it("without own answers no fake 0 % and no false 'all correct' list", () => {
    view(session(), [], "me");
    expect(screen.queryByTestId("my-accuracy")).toBeNull();
    expect(screen.queryByText(/všechny zodpovězené otázky máš správně/)).toBeNull();
  });
  it("teacher view keeps class % across all answers", () => {
    view(session(), [resp("a", 0, true), resp("b", 0, false)]);
    expect(screen.getByTestId("class-accuracy")).toHaveTextContent("50%");
  });
});

describe("accuracy", () => {
  it("0, partial, all and none", () => {
    expect(accuracyPct([resp("x", 0, false)])).toBe(0);
    expect(accuracyPct([resp("x", 0, true), resp("x", 1, true)])).toBe(100);
    expect(accuracyPct([resp("x", 0, false, { soloRound: true, correctCount: 1, totalCount: 4 })])).toBe(25);
    expect(accuracyPct([])).toBeNull();
  });
});

describe("raised hands", () => {
  it("orders by raise time and ignores lowered hands", () => {
    const list = sortRaisedHands([
      { id: "x", hand_raised: true, hand_raised_at: "2026-11-20T10:02:00Z" },
      { id: "y", hand_raised: false, hand_raised_at: null },
      { id: "z", hand_raised: true, hand_raised_at: "2026-11-20T10:01:00Z" },
    ]);
    expect(list.map((p) => p.id)).toEqual(["z", "x"]);
  });
  it("student button available in lobby and play, not on results", () => {
    expect(canStudentRaiseHand("lobby", true)).toBe(true);
    expect(canStudentRaiseHand("playing", true)).toBe(true);
    expect(canStudentRaiseHand("finished", true)).toBe(false);
    expect(canStudentRaiseHand("playing", false)).toBe(false);
  });
});
