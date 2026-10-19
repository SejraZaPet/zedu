import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFinalGameResults } from "@/hooks/useFinalGameResults";
import type { GamePlayer } from "@/lib/game-types";

const own: GamePlayer = { id: "own", session_id: "s", nickname: "[TEST] Já", user_id: null, total_score: 50, created_at: "2026-10-19" };
describe("post-finish result snapshot", () => {
  it("waits for a new fetch after finished, never showing stale players", async () => {
    let resolve: (players: GamePlayer[]) => void = () => {};
    const fetch = vi.fn(() => new Promise<GamePlayer[]>((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ status }) => useFinalGameResults("s", status, "own", fetch), { initialProps: { status: "playing" } });
    expect(fetch).not.toHaveBeenCalled();
    rerender({ status: "finished" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.result).toEqual({ sessionId: "s", state: "loading", players: [] });
    await act(async () => resolve([own]));
    expect(result.current.result?.players[0].total_score).toBe(50);
    expect(result.current.result?.state).toBe("ready");
  });
  it("failure keeps no speculative result; retry fetches a fresh snapshot", async () => {
    const fetch = vi.fn<() => Promise<GamePlayer[]>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([own]);
    const { result } = renderHook(() => useFinalGameResults("s", "finished", "own", fetch));
    await waitFor(() => expect(result.current.result?.state).toBe("error"));
    expect(result.current.result?.players).toEqual([]);
    await act(async () => { await result.current.retry(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.result?.state).toBe("ready");
  });
  it("a filtered or empty view cannot invent first place for the missing player", async () => {
    const fetch = vi.fn().mockResolvedValue([{ ...own, id: "other" }]);
    const { result } = renderHook(() => useFinalGameResults("s", "finished", "own", fetch));
    await waitFor(() => expect(result.current.result?.state).toBe("error"));
    expect(result.current.result?.players).toEqual([]);
  });
  it("ignores an old request after a new session is opened", async () => {
    let resolveOld: (players: GamePlayer[]) => void = () => {};
    const fetch = vi.fn<() => Promise<GamePlayer[]>>()
      .mockImplementationOnce(() => new Promise((done) => { resolveOld = done; }))
      .mockResolvedValueOnce([{ ...own, session_id: "new", total_score: 10 }]);
    const { result, rerender } = renderHook(({ id }) => useFinalGameResults(id, "finished", "own", fetch), { initialProps: { id: "s" } });
    rerender({ id: "new" });
    await waitFor(() => expect(result.current.result?.state).toBe("ready"));
    await act(async () => resolveOld([own]));
    expect(result.current.result?.sessionId).toBe("new");
    expect(result.current.result?.players[0].total_score).toBe(10);
  });
});