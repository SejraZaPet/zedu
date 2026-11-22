// @vitest-environment node
import { describe, it, expect } from "vitest";
import { wallErrorReason, isWallAuthError, wallDraftKey, loadWallDraft, saveWallDraft, wallScheduleIso } from "@/lib/wall-composer";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("wall composer safety", () => {
  it("maps RLS, auth and network errors", () => {
    expect(wallErrorReason({ code: "42501" })).toMatch(/oprávnění/);
    expect(wallErrorReason({ message: "JWT expired" })).toMatch(/Přihlášení vypršelo/);
    expect(wallErrorReason({ message: "Failed to fetch" })).toMatch(/připojeni/);
    expect(wallErrorReason({ code: "23502" })).toContain("23502");
    expect(isWallAuthError({ code: "PGRST301" })).toBe(true);
    expect(isWallAuthError({ code: "42501" })).toBe(false);
  });
  it("saves, restores and discards a draft per class/group", () => {
    const s = mem(); const k = wallDraftKey("t1", { classId: "c1", groupId: null });
    expect(k).not.toBe(wallDraftKey("t1", { classId: null, groupId: "c1" }));
    saveWallDraft(s, k, { description: "Ahoj", materials: [{ type: "link", url: "https://example.org", title: "[TEST]" } as any], pinned: true, commentsEnabled: false, notifyEmail: false });
    expect(loadWallDraft(s, k)).toMatchObject({ description: "Ahoj", pinned: true, commentsEnabled: false });
    saveWallDraft(s, k, { description: "", materials: [], pinned: false, commentsEnabled: true, notifyEmail: false });
    expect(loadWallDraft(s, k)).toBeNull();
  });
  it("accepts only future schedule times", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(() => wallScheduleIso("2026-11-22T10:00", now)).toThrow();
    expect(() => wallScheduleIso("", now)).toThrow();
    expect(wallScheduleIso("2026-12-01T08:00", now)).toMatch(/^2026-12-01T/);
  });
});
