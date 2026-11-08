import { describe, it, expect } from "vitest";
import { buildWallFeed, wallAnnouncements, canEditComment, canDeleteComment, commentsEnabled, threadFor, type WallComment } from "./class-wall";

const now = new Date("2026-11-06T12:00:00Z");
const items = [
  { id: "t", status: "published", created_at: "2026-11-01T10:00:00Z", settings: {} },
  { id: "d", status: "draft", created_at: "2026-11-05T10:00:00Z", settings: {} },
  { id: "m", status: "published", created_at: "2026-11-03T10:00:00Z", settings: { kind: "material" } },
  { id: "a1", status: "published", created_at: "2026-11-04T10:00:00Z", settings: { kind: "announcement" } },
  { id: "a2", status: "published", created_at: "2026-10-01T10:00:00Z", settings: { kind: "announcement", pinned: true } },
  { id: "old", status: "published", created_at: "2026-11-02T10:00:00Z", settings: { kind: "announcement", visibleUntil: "2026-11-05T00:00:00Z" } },
];

describe("class wall feed", () => {
  it("shows only published, hides expired announcements, newest first", () => {
    expect(buildWallFeed(items, now).map((i) => i.id)).toEqual(["a1", "m", "t", "a2"]);
  });
  it("announcement block: pinned first, max 3", () => {
    expect(wallAnnouncements(items, 3, now).map((i) => i.id)).toEqual(["a2", "a1"]);
    expect(wallAnnouncements(items, 1, now).map((i) => i.id)).toEqual(["a2"]);
  });
  it("comments default off for tasks, on for material/announcement, explicit wins", () => {
    expect(commentsEnabled({})).toBe(false);
    expect(commentsEnabled({ kind: "material" })).toBe(true);
    expect(commentsEnabled({ kind: "announcement" })).toBe(true);
    expect(commentsEnabled({ commentsEnabled: true })).toBe(true);
    expect(commentsEnabled({ kind: "announcement", commentsEnabled: false })).toBe(false);
  });
});

describe("comment rules", () => {
  const c = (id: string, author: string, at: string, deleted?: string): WallComment => ({ id, assignment_id: "a", author_id: author, body: "x", created_at: at, deleted_at: deleted ?? null });
  const mine = c("1", "me", "2026-11-06T10:00:00Z");
  it("author can edit when nobody else replied later", () => {
    expect(canEditComment(mine, [mine, c("2", "me", "2026-11-06T11:00:00Z")], "me")).toBe(true);
  });
  it("author cannot edit after a newer comment from someone else", () => {
    expect(canEditComment(mine, [mine, c("2", "other", "2026-11-06T11:00:00Z")], "me")).toBe(false);
  });
  it("others and deleted comments cannot be edited", () => {
    expect(canEditComment(mine, [mine], "other")).toBe(false);
    expect(canEditComment(c("3", "me", "2026-11-06T10:00:00Z", "2026-11-06T10:30:00Z"), [], "me")).toBe(false);
  });
  it("author deletes own, moderator any", () => {
    expect(canDeleteComment(mine, "me", false)).toBe(true);
    expect(canDeleteComment(mine, "other", false)).toBe(false);
    expect(canDeleteComment(mine, "teacher", true)).toBe(true);
  });
  it("thread shows last 3 and counts hidden", () => {
    const list = ["1", "2", "3", "4", "5"].map((i) => c(i, "me", `2026-11-06T0${i}:00:00Z`));
    expect(threadFor(list, "a", false)).toMatchObject({ hidden: 2 });
    expect(threadFor(list, "a", false).shown.map((x) => x.id)).toEqual(["3", "4", "5"]);
    expect(threadFor(list, "a", true).shown).toHaveLength(5);
  });
});

import { wallVisible, wallOrdered } from "./class-wall";
describe("wall preview max 5", () => {
  const mk = (n: number, pinnedIdx = -1) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, settings: i === pinnedIdx ? { pinned: true } : {} }));
  it("collapsed shows max 5 with expand when more", () => {
    const r = wallVisible(mk(8), false, 10);
    expect(r.shown).toHaveLength(5); expect(r.canExpand).toBe(true);
  });
  it("no expand button with 5 or fewer", () => {
    expect(wallVisible(mk(5), false, 10).canExpand).toBe(false);
  });
  it("pinned first", () => {
    expect(wallOrdered(mk(8, 7))[0].id).toBe("p7");
    expect(wallVisible(mk(8, 7), false, 10).shown[0].id).toBe("p7");
  });
  it("expanded pages by limit", () => {
    const r = wallVisible(mk(12), true, 10);
    expect(r.shown).toHaveLength(10); expect(r.hasMore).toBe(true); expect(r.canExpand).toBe(false);
  });
});
