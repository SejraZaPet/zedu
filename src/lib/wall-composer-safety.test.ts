// @vitest-environment node
import { describe, it, expect } from "vitest";
import { vi } from "vitest";
vi.mock("@/lib/assignment-description", () => ({ assignmentDescriptionToText: (v: string) => v.replace(/<[^>]*>/g, ""), sanitizeAssignmentDescription: (v: string) => v }));
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

import { wallDraftRow } from "@/lib/wall-composer";
import { readFileSync } from "node:fs";
describe("wallDraftRow matches assignments schema", () => {
  const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
  const block = types.slice(types.indexOf("      assignments: {")).split("Insert: {")[1].split("}")[0];
  const columns = new Set([...block.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]));
  it("sends only existing columns", () => {
    expect(columns.has("subject_id")).toBe(true);
    const row = wallDraftRow({ classId: "c1", groupId: null, subjectId: null, subject: "Dějepis", targetName: "[TEST]" },
      { description: "Ahoj", materials: [], pinned: false, commentsEnabled: true, notifyEmail: false }, "t1");
    expect(Object.keys(row).filter((k) => !columns.has(k))).toEqual([]);
  });
  it("PGRST204 is not masked", () => {
    expect(wallErrorReason({ code: "PGRST204" })).toMatch(/chybí pole v databázi.*PGRST204/);
  });
});

import { canManageWallPost, wallEditPatch } from "@/lib/wall-composer";
describe("wall post edit/delete", () => {
  const draft = { description: "Opraveno", materials: [], pinned: true, commentsEnabled: false, notifyEmail: true };
  const own = { id: "p1", teacher_id: "t1", status: "published", settings: { kind: "announcement", wallPost: true, notifyEmail: true } };
  it("only own announcements in teacher view", () => {
    expect(canManageWallPost(own, "t1", true)).toBe(true);
    expect(canManageWallPost(own, "t2", true)).toBe(false);
    expect(canManageWallPost(own, "t1", false)).toBe(false);
    expect(canManageWallPost({ ...own, settings: { kind: "task" } }, "t1", true)).toBe(false);
  });
  it("edit never touches status (no notifications) and marks editedAt", () => {
    const p = wallEditPatch(own, draft, { now: new Date("2026-11-22T10:00:00Z") });
    expect("status" in p).toBe(false);
    expect(p.settings).toMatchObject({ kind: "announcement", wallPost: true, pinned: true, commentsEnabled: false, editedAt: "2026-11-22T10:00:00.000Z", notifyEmail: true });
    expect("scheduled_publish_at" in p).toBe(false);
  });
  it("scheduled post can change publish time, no editedAt", () => {
    const p = wallEditPatch({ ...own, status: "scheduled" }, draft, { publishAt: "2026-12-01T07:00:00.000Z" });
    expect(p.scheduled_publish_at).toBe("2026-12-01T07:00:00.000Z");
    expect((p.settings as any).editedAt).toBeUndefined();
  });
  it("edit patch keys exist in assignments", () => {
    const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
    const block = types.slice(types.indexOf("      assignments: {")).split("Update: {")[1].split("}")[0];
    const cols = new Set([...block.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]));
    const p = wallEditPatch({ ...own, status: "scheduled" }, draft, { publishAt: "2026-12-01T07:00:00.000Z" });
    expect(Object.keys(p).filter((k) => !cols.has(k))).toEqual([]);
  });
});
