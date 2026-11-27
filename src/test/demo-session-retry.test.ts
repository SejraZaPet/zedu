import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const setSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { setSession: (...a: unknown[]) => setSession(...a) } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));

import { startDemo, restoreDemo, DemoCallError, DEMO_NETWORK_FAILED_MSG } from "@/lib/demo";

const ok = { data: { session: { access_token: "a", refresh_token: "r" }, role: "teacher", return_code: "KOD" }, error: null };
const netErr = () => ({ data: null, error: Object.assign(new Error("Load failed"), { name: "FunctionsFetchError", context: new TypeError("Load failed") }) });
const httpErr = (status: number, body: unknown) => ({
  data: null,
  error: Object.assign(new Error("non-2xx"), { name: "FunctionsHttpError", context: new Response(JSON.stringify(body), { status }) }),
});

beforeEach(() => { invoke.mockReset(); setSession.mockReset(); setSession.mockResolvedValue({ error: null }); vi.spyOn(console, "warn").mockImplementation(() => {}); });

describe("vstup do dema – odolnost proti výpadku spojení", () => {
  it("po chybě spojení zkusí znovu a přihlásí", async () => {
    invoke.mockResolvedValueOnce(netErr()).mockResolvedValueOnce(ok);
    const onRetry = vi.fn();
    await expect(startDemo("teacher", null, { delays: [0, 0], onRetry })).resolves.toBe("teacher");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith(ok.data.session);
  });

  it("429 neopakuje a ukáže text serveru", async () => {
    invoke.mockResolvedValue(httpErr(429, { error: "Z tohoto připojení už vzniklo hodně dem. Zkuste to prosím za hodinu." }));
    const p = startDemo("teacher", null, { delays: [0, 0] });
    await expect(p).rejects.toMatchObject({ kind: "server", status: 429, message: "Z tohoto připojení už vzniklo hodně dem. Zkuste to prosím za hodinu." });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("po vyčerpání pokusů (3 volání) vrátí chybu spojení", async () => {
    invoke.mockResolvedValue(netErr());
    const e = await restoreDemo("KOD", { delays: [0, 0] }).catch((x) => x);
    expect(e).toBeInstanceOf(DemoCallError);
    expect(e.kind).toBe("network");
    expect(e.message).toBe(DEMO_NETWORK_FAILED_MSG);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("504 z brány bez JSON zopakuje", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("x"), { name: "FunctionsHttpError", context: new Response("<html>", { status: 504 }) }) }).mockResolvedValueOnce(ok);
    await expect(startDemo("teacher", null, { delays: [0, 0] })).resolves.toBe("teacher");
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
