import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SoloRoundActivityPlayer from "@/components/live/SoloRoundActivityPlayer";
import SoloRoundProjector from "@/components/live/SoloRoundProjector";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

const spec = {
  activityType: "matching", soloRound: true, question: "Přiřaď města", timeLimitSec: 0,
  matching: { left: ["Praha"], right: ["Česko"], shuffled: false },
};
const base = { sessionId: "s", joinToken: "secret-token", playerId: "p1", questionIndex: 0 };
const playing = { status: "playing", settings: { gameMode: "standard", timePerQuestion: 0 }, question_started_at: new Date().toISOString() };

afterEach(() => { cleanup(); invoke.mockReset(); });

describe("telefon samostatného kola", () => {
  it("odešle jen volby, skryje dřívější kontrolu a výsledek ukáže až po skončení", async () => {
    invoke.mockResolvedValue({ data: { success: true, score: 1000, correctCount: 1, totalCount: 1 }, error: null });
    const { rerender } = render(<SoloRoundActivityPlayer {...base} spec={spec} session={playing} />);
    expect(screen.queryByRole("button", { name: /Zkontrolovat/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/správně$/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat a čekat" }));
    await screen.findByText("Čekejte na ostatní");
    expect(invoke).toHaveBeenCalledWith("submit-activity-response", expect.objectContaining({
      body: expect.objectContaining({ playerId: "p1", questionIndex: 0, answerData: { selections: { 0: 0 } } }),
    }));
    expect(screen.queryByText(/1 \/ 1 správně/)).not.toBeInTheDocument();
    rerender(<SoloRoundActivityPlayer {...base} spec={spec} session={{ ...playing, status: "question_results" }} />);
    expect(await screen.findByText("1 / 1 správně")).toBeInTheDocument();
    expect(screen.getByText("Správné řešení")).toBeInTheDocument();
  });

  it("po vypršení času odešle i rozpracovaný stav", async () => {
    invoke.mockResolvedValue({ data: { success: true, score: 0, correctCount: 0, totalCount: 1 }, error: null });
    render(<SoloRoundActivityPlayer {...base} spec={{ ...spec, timeLimitSec: 45 }} session={{ ...playing, question_started_at: new Date(Date.now() - 46_000).toISOString() }} />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body.answerData).toEqual({ selections: {} });
  });

  it("předčasné ukončení učitelem automaticky odešle aktuální stav", async () => {
    invoke.mockResolvedValue({ data: { success: true, score: 0, correctCount: 0, totalCount: 1 }, error: null });
    render(<SoloRoundActivityPlayer {...base} spec={spec} session={{ ...playing, status: "question_results" }} />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
  });
});

describe("projektor samostatného kola", () => {
  it("ukáže průběh X z N a potom úspěšnost, chyby a body", () => {
    const slide = { type: "activity", activitySpec: spec };
    const players = [{ id: "p1", nickname: "A", total_score: 1000 }, { id: "p2", nickname: "B", total_score: 0 }];
    const { rerender } = render(<SoloRoundProjector session={playing} currentSlide={slide} currentIndex={0} players={players} responses={[]} />);
    expect(screen.getByText("0 z 2 hotovo")).toBeInTheDocument();
    expect(screen.getByText("Pracujte na telefonu")).toBeInTheDocument();
    rerender(<SoloRoundProjector session={{ ...playing, status: "question_results" }} currentSlide={slide} currentIndex={0} players={players} responses={[
      { player_id: "p1", question_index: 0, score: 1000, answer: { correctCount: 1, totalCount: 1, itemResults: [{ index: 0, correct: true }] } },
      { player_id: "p2", question_index: 0, score: 0, answer: { correctCount: 0, totalCount: 1, itemResults: [{ index: 0, correct: false }] } },
    ]} />);
    expect(screen.getByText("50 %")).toBeInTheDocument();
    expect(screen.getAllByText(/Praha/).length).toBeGreaterThan(0);
    expect(screen.getByText("+1000")).toBeInTheDocument();
    expect(screen.getByText("Správné řešení")).toBeInTheDocument();
  });
});
