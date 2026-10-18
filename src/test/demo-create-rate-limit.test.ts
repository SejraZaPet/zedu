import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { transpileModule, ScriptTarget, ModuleKind } from "typescript";

const mocks = vi.hoisted(() => ({ countRecent: vi.fn(), recordEvent: vi.fn(), serve: vi.fn(), schoolLookup: vi.fn() }));
const dependencies = {
  Deno: { serve: mocks.serve }, corsHeaders: {},
  adminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.schoolLookup }) }) }) }) }),
  countRecent: mocks.countRecent,
  recordEvent: mocks.recordEvent,
  ipHash: async () => "test-ip-hash",
  DEMO_EMAIL_DOMAIN: "unused", DEMO_SCHOOL_NAME: "unused",
  generateReturnCode: vi.fn(), issueSession: vi.fn(), randomToken: vi.fn(),
};
// Compile the actual Deno handler, injecting only local stubs for its imports.
// Avoid pulling Deno/npm: modules into the browser's TypeScript dependency graph.
const source = readFileSync("supabase/functions/create-demo-session/index.ts", "utf8")
  .replace(/^import[\s\S]*?;\r?\n/gm, "");
const { outputText } = transpileModule(source, {
  compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.None },
});
const register = new Function(...Object.keys(dependencies), outputText);

async function request(eventTag: unknown, hourlyCount: number, dailyCount = 0) {
  mocks.serve.mockClear();
  mocks.countRecent.mockReset();
  mocks.countRecent.mockResolvedValueOnce(hourlyCount).mockResolvedValueOnce(dailyCount);
  register(...Object.values(dependencies));
  const handler = mocks.serve.mock.calls[0]?.[0];
  if (!handler) throw new Error("Demo handler not registered");
  return handler(new Request("https://example.test", {
    method: "POST", body: JSON.stringify({ role: "teacher", event_tag: eventTag }),
  })) as Promise<Response>;
}

describe("demo creation limits without real accounts or database calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stop after rate checks; never reach account creation.
    mocks.schoolLookup.mockResolvedValue({ data: null });
  });

  it("allows approved event at 79 creations and blocks at 80", async () => {
    expect((await request("dalkove-ucitele", 79)).status).toBe(503);
    expect((await request("dalkove-ucitele", 80)).status).toBe(429);
  });
  it.each([null, "other-event", "DALKOVE-UCITELE", "dalkove-ucitele-extra"])("keeps 20/hour for %s", async (tag) => {
    expect((await request(tag, 19)).status).toBe(503);
    expect((await request(tag, 20)).status).toBe(429);
  });
  it("matches after cleanTag trims whitespace", async () => {
    expect((await request("  dalkove-ucitele  ", 20)).status).toBe(503);
  });
  it("keeps global daily cap at 500 for the approved event", async () => {
    expect((await request("dalkove-ucitele", 0, 499)).status).toBe(503);
    expect((await request("dalkove-ucitele", 0, 500)).status).toBe(429);
    expect(mocks.countRecent).toHaveBeenLastCalledWith(expect.anything(), "create", 24 * 60 * 60 * 1000);
  });
});