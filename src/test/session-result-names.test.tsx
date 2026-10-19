import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionExports from "@/components/live/SessionExports";

const calls = vi.hoisted(() => ({ invoke: vi.fn(), exportFetch: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { access_token: "test-local-token" } } }) },
  functions: { invoke: calls.invoke },
} }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

describe("teacher report and file name choices", () => {
  it("requests nicknames for the screen but keeps CSV pseudonymous by default", async () => {
    calls.invoke.mockResolvedValue({ data: {
      sessionOverview: { totalParticipants: 1, totalSlides: 1, totalResponses: 1 },
      participationSummary: { participationRate: 100 },
      classStatistics: { mean: 100, min: 100, median: 100, max: 100 },
      perSlideResults: [], commonMistakes: [], recommendations: [],
      participants: [{ playerId: "p", name: "[TEST] Přezdívka", correct: 1, graded: 1, successRate: 100, score: 100, avgTimeMs: 500 }],
    }, error: null });
    calls.exportFetch.mockResolvedValue({ ok: true, blob: async () => new Blob(["test"]) });
    vi.stubGlobal("fetch", calls.exportFetch);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<SessionExports sessionId="s" sessionTitle="[TEST]" />);
    await screen.findByText("[TEST] Přezdívka");
    expect(calls.invoke).toHaveBeenCalledWith("export-session-report", { body: { sessionId: "s", anonymizationMode: "nickname", includeAnswerKey: true } });
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(() => expect(calls.exportFetch).toHaveBeenCalled());
    const request = calls.exportFetch.mock.calls[0][1];
    expect(JSON.parse(request.body).anonymizationMode).toBe("pseudonymous");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});