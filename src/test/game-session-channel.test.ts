import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { shouldAnnounceRestore } from "@/lib/connection-notice";

const channelSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  const q = () => new Proxy(chain, { get: (_t, p) => (p === "then" ? (r: any) => r({ data: null, error: null }) : q) });
  const channel = () => {
    channelSpy();
    const ch: any = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: null } }) },
      realtime: { setAuth: async () => {} },
      channel,
      removeChannel: () => {},
      from: () => q(),
      rpc: () => q(),
    },
  };
});

describe("hláška o obnovení spojení", () => {
  it("krátký výpadek (do 3 s) se neohlásí, delší ano", () => {
    expect(shouldAnnounceRestore(1000, 3500)).toBe(false);
    expect(shouldAnnounceRestore(1000, 4000)).toBe(true);
    expect(shouldAnnounceRestore(null, 99999)).toBe(false);
  });
});

describe("useGameSession kanál", () => {
  it("změna refetchTrigger nezaloží nový kanál", async () => {
    const { useGameSession } = await import("@/hooks/useGameSession");
    const { rerender } = renderHook(({ t }) => useGameSession("s1", t), { initialProps: { t: 0 } });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const before = channelSpy.mock.calls.length;
    expect(before).toBe(1);
    rerender({ t: 1 });
    rerender({ t: 2 });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(channelSpy.mock.calls.length).toBe(before);
  });
});
