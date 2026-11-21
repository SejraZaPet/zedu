import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { transpileModule, ScriptTarget, ModuleKind } from "typescript";
import { DEMO_CREATION_DEFAULTS, resolveDemoCreationOverride } from "../../supabase/functions/_shared/demo-event-overrides";

const mocks = vi.hoisted(() => ({ countRecent: vi.fn(), recordEvent: vi.fn(), serve: vi.fn(), schoolLookup: vi.fn(), eventOverride: vi.fn() }));
const dependencies = {
  Deno: { serve: mocks.serve }, corsHeaders: {},
  adminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.schoolLookup }) }) }) }),
    rpc: mocks.eventOverride,
  }),
  countRecent: mocks.countRecent,
  recordEvent: mocks.recordEvent,
  ipHash: async () => "test-ip-hash",
  DEMO_EMAIL_DOMAIN: "unused", DEMO_SCHOOL_NAME: "unused",
  generateReturnCode: vi.fn(), issueSession: vi.fn(), randomToken: vi.fn(),
  DEMO_CREATION_DEFAULTS, resolveDemoCreationOverride,
};
// Compile the actual Deno handler, injecting only local stubs for its imports.
// Avoid pulling Deno/npm: modules into the browser's TypeScript dependency graph.
const source = readFileSync("supabase/functions/create-demo-session/index.ts", "utf8")
  .replace(/^import[\s\S]*?;\r?\n/gm, "");
const { outputText } = transpileModule(source, {
  compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.None },
});
const register = new Function(...Object.keys(dependencies), outputText);
const activeEventRow = {
  tag: "dalkove-ucitele",
  active_from: "2020-01-01T00:00:00.000Z",
  active_until: "2030-01-01T00:00:00.000Z",
  create_per_ip_hour: 150,
  create_global_day: 1000,
  ai_per_account: 15,
  ai_daily_global: 1000,
  materials_max: 50,
  live_players_max: 100,
  upload_max_files: 50,
  upload_max_bytes: 5 * 1024 * 1024,
};

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
    mocks.eventOverride.mockResolvedValue({ data: [], error: null });
    // Stop after rate checks; never reach account creation.
    mocks.schoolLookup.mockResolvedValue({ data: null });
  });

  it("allows an active approved event at 149 creations and blocks at 150", async () => {
    mocks.eventOverride.mockResolvedValue({ data: [activeEventRow], error: null });
    expect((await request("dalkove-ucitele", 149)).status).toBe(503);
    expect((await request("dalkove-ucitele", 150)).status).toBe(429);
  });
  it.each([null, "other-event", "DALKOVE-UCITELE", "dalkove-ucitele-extra"])("keeps 20/hour for %s", async (tag) => {
    expect((await request(tag, 19)).status).toBe(503);
    expect((await request(tag, 20)).status).toBe(429);
  });
  it("matches after cleanTag trims whitespace", async () => {
    mocks.eventOverride.mockResolvedValue({ data: [activeEventRow], error: null });
    expect((await request("  dalkove-ucitele  ", 149)).status).toBe(503);
  });
  it("raises the global daily cap to 1000 only for the active event", async () => {
    mocks.eventOverride.mockResolvedValue({ data: [activeEventRow], error: null });
    expect((await request("dalkove-ucitele", 0, 999)).status).toBe(503);
    expect((await request("dalkove-ucitele", 0, 1000)).status).toBe(429);
    expect(mocks.countRecent).toHaveBeenLastCalledWith(expect.anything(), "create", 24 * 60 * 60 * 1000);
  });
  it("ignores an expired row and an override lookup error", async () => {
    mocks.eventOverride.mockResolvedValueOnce({ data: [{ ...activeEventRow, active_until: "2020-01-02T00:00:00.000Z" }], error: null });
    expect((await request("dalkove-ucitele", 20)).status).toBe(429);
    mocks.eventOverride.mockResolvedValueOnce({ data: null, error: { message: "missing" } });
    expect((await request("dalkove-ucitele", 20)).status).toBe(429);
  });
});