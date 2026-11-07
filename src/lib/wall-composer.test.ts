import { describe, it, expect } from "vitest";
import { wallDraftRow, wallCreateUrl, isWallPost, safeWallReturn, type WallDraft } from "./wall-composer";
import { buildWallFeed } from "./class-wall";
import { filterByKind, notifyEmailEnabled } from "./assignment-kind";
const context = { classId: "c", groupId: null, subjectId: "s", subject: "Matematika", targetName: "[TEST]" };
const draft: WallDraft = {description:"[TEST] Příspěvek", materials:[], pinned:false, commentsEnabled:true, notifyEmail:false};
describe("teacher wall post", () => {
  it("stores one announcement draft with post flag and email explicitly off", () => {
    const row = wallDraftRow(context,draft,"teacher");
    expect(row.status).toBe("draft"); expect(row.settings.kind).toBe("announcement");
    expect(row.settings.wallPost).toBe(true); expect(row.settings.commentsEnabled).toBe(true);
    expect(notifyEmailEnabled(row.settings)).toBe(false);
  });
  it("only sends email when explicitly chosen", () => expect(wallDraftRow(context,{...draft,notifyEmail:true},"teacher").settings.notifyEmail).toBe(true));
  it("group target clears class, keeps subject and attachments", () => {
    const material = {id:"m",kind:"link" as const,title:"[TEST]",url:"https://example.org"};
    expect(wallDraftRow({...context,groupId:"g"},{...draft,materials:[material]},"teacher")).toMatchObject({class_id:null,group_id:"g",subject_id:"s",materials:[material]});
  });
  it("enforces existing announcement maximum 500", () => {
    expect(() => wallDraftRow(context,{...draft,description:"a".repeat(500)},"teacher")).not.toThrow();
    expect(() => wallDraftRow(context,{...draft,description:"a".repeat(501)},"teacher")).toThrow();
  });
  it("draft hidden, same published ID in wall and announcements", () => {
    const item = {id:"one", ...wallDraftRow(context,draft,"teacher")};
    expect(buildWallFeed([item])).toHaveLength(0);
    const published = {...item,status:"published"};
    expect(buildWallFeed([published]).map(i=>i.id)).toEqual(["one"]);
    expect(filterByKind([published],"announcement").map(i=>i.id)).toEqual(["one"]);
    expect(isWallPost(published.settings)).toBe(true); expect(isWallPost({kind:"announcement"})).toBe(false);
  });
  it("prefills kind, class/group, subject and safe return", () => {
    const url = new URL(wallCreateUrl({...context,groupId:"g"},"material","/ucitel/predmet/x"),"https://example.org");
    expect(url.searchParams.get("kind")).toBe("material"); expect(url.searchParams.get("classId")).toBeNull();
    expect(url.searchParams.get("groupId")).toBe("g"); expect(url.searchParams.get("subjectId")).toBe("s");
    expect(url.searchParams.get("fromWall")).toBe("1"); expect(safeWallReturn(url.searchParams.get("return_to"))).toBe("/ucitel/predmet/x");
    expect(safeWallReturn("//evil.example")).toBeNull(); expect(safeWallReturn("/ucitel/\\evil")).toBeNull();
  });
});