import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHEATSHEET_STORAGE_MARKER, emptyCheatsheet } from "@/lib/cheatsheet";
const mock = vi.hoisted(() => ({ calls: [] as Array<{ table: string; method: string; args: unknown[] }>, responses: [] as unknown[], userId: "test-owner" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: mock.userId } }, error: null }) },
  from: (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "insert", "update", "delete", "eq", "order"]) chain[method] = (...args: unknown[]) => { mock.calls.push({ table, method, args }); return chain; };
    chain.single = async () => mock.responses.shift();
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(mock.responses.shift()).then(resolve);
    return chain;
  },
} }));
import { loadCheatsheets, saveCheatsheet } from "@/lib/cheatsheet-store";
describe("private standalone cheat-sheet persistence", () => {
  beforeEach(() => { mock.calls = []; mock.responses = []; mock.userId = "test-owner"; });
  it("reads only owner-tagged cards and ignores ordinary notebook pages", async () => {
    mock.responses.push({ data: [{ id: "container", notebook_pages: [{ id: "card", content: { kind: "cheatsheet", cheatsheet: emptyCheatsheet() } }, { id: "ordinary", content: { textBoxes: [] } }] }], error: null });
    expect(await loadCheatsheets("test-owner")).toEqual([{ ...emptyCheatsheet(), id: "card", notebookId: "container" }]);
    expect(mock.calls).toContainEqual({ table: "notebooks", method: "eq", args: ["owner_id", "test-owner"] });
    expect(mock.calls).toContainEqual({ table: "notebooks", method: "eq", args: ["cover_color", CHEATSHEET_STORAGE_MARKER] });
  });
  it("saves a separate tagged container with no class, subject or lesson binding", async () => {
    mock.responses.push({ data: { id: "container" }, error: null }, { data: { id: "card" }, error: null });
    const sheet = { ...emptyCheatsheet(), subject: "Fyzika / Matematika", front: "[TEST] → x" };
    expect(await saveCheatsheet("test-owner", sheet)).toEqual({ ...sheet, id: "card", notebookId: "container" });
    expect(mock.calls).toContainEqual({ table: "notebooks", method: "insert", args: [{ owner_id: "test-owner", title: "Tahák", cover_color: CHEATSHEET_STORAGE_MARKER }] });
    expect(mock.calls.find(c => c.table === "notebook_pages" && c.method === "insert")?.args).toEqual([{ notebook_id: "container", page_order: 0, content: { kind: "cheatsheet", cheatsheet: sheet } }]);
  });
  it("refuses to save under a different authenticated owner", async () => {
    await expect(saveCheatsheet("other-owner", emptyCheatsheet())).rejects.toThrow("Přihlášení se změnilo");
    expect(mock.calls).toHaveLength(0);
  });
  it("rejects excessive content before any request", async () => {
    await expect(saveCheatsheet("test-owner", { ...emptyCheatsheet(), back: "x".repeat(221) })).rejects.toThrow("220");
    expect(mock.calls).toHaveLength(0);
  });
  it("updates only the exact page in an owned tagged container", async () => {
    mock.responses.push({ data: { id: "container" }, error: null }, { data: { id: "card" }, error: null });
    await saveCheatsheet("test-owner", emptyCheatsheet(), { ...emptyCheatsheet(), id: "card", notebookId: "container" });
    expect(mock.calls).toContainEqual({ table: "notebooks", method: "eq", args: ["owner_id", "test-owner"] });
    expect(mock.calls).toContainEqual({ table: "notebook_pages", method: "eq", args: ["id", "card"] });
    expect(mock.calls).toContainEqual({ table: "notebook_pages", method: "eq", args: ["notebook_id", "container"] });
  });
});