import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Poslední návratový kód na tomto zařízení (pro „Pokračovat tam, kde jsem skončil/a"). */
export const DEMO_CODE_KEY = "Bezli:demo-return-code";

export interface DemoPair {
  returnCode: string;
  eventTag: string | null;
  side: "teacher" | "student";
}

const cache = new Map<string, DemoPair | null>();
const listeners = new Set<() => void>();

/** Demo dvojice přihlášeného uživatele, nebo null (běžný účet). */
export function useDemoPair(): DemoPair | null {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (!uid || cache.has(uid)) return;
    cache.set(uid, null);
    (supabase.rpc as any)("get_my_demo_pair").then(({ data }: { data: any[] | null }) => {
      const row = Array.isArray(data) ? data[0] : null;
      const pair: DemoPair | null = row
        ? { returnCode: row.return_code, eventTag: row.event_tag ?? null, side: row.my_side === "student" ? "student" : "teacher" }
        : null;
      cache.set(uid, pair);
      if (pair) {
        try { window.localStorage.setItem(DEMO_CODE_KEY, pair.returnCode); } catch { /* ignore */ }
      }
      listeners.forEach((fn) => fn());
    });
  }, [uid]);

  return uid ? cache.get(uid) ?? null : null;
}

export const dashboardFor = (role: "teacher" | "student") => (role === "teacher" ? "/ucitel" : "/student");

type DemoResponse = { session?: { access_token: string; refresh_token: string }; role?: "teacher" | "student"; return_code?: string; error?: string };

export const DEMO_RETRYING_MSG = "Slabé spojení, zkouším znovu…";
export const DEMO_NETWORK_FAILED_MSG = "Spojení se nepovedlo. Zkontrolujte připojení a klepněte znovu.";
const DEMO_SERVER_FAILED_MSG = "Server teď neodpověděl. Zkuste to prosím za chvíli znovu.";
const DEMO_TIMEOUT_MS = 15_000;
const DEMO_RETRY_DELAYS = [800, 2000];
const RETRYABLE_STATUS = new Set([502, 503, 504]);

/** Chyba volání demo funkce: `network` = spojení/timeout (lze zkusit znovu), `server` = odpověď serveru. */
export class DemoCallError extends Error {
  constructor(message: string, readonly kind: "network" | "server", readonly status?: number) {
    super(message);
    this.name = "DemoCallError";
  }
}

export interface DemoCallOptions {
  /** Kolikrát zkusit znovu při chybě spojení nebo 502/503/504 (výchozí 0). */
  retries?: number;
  delays?: number[];
  timeoutMs?: number;
  onRetry?: (attempt: number) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOnce(name: string, body: Record<string, unknown>, timeoutMs: number): Promise<DemoResponse> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      ctrl.abort();
      rej(new DemoCallError(DEMO_NETWORK_FAILED_MSG, "network"));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([
      supabase.functions.invoke(name, { body, signal: ctrl.signal }),
      timeout,
    ]);
    const { data, error } = result as { data: unknown; error: any };
    if (!error) return data as DemoResponse;
    const response: Response | undefined = error?.context instanceof Response ? error.context
      : typeof error?.context?.status === "number" ? error.context : undefined;
    const status = typeof response?.status === "number" ? response.status : undefined;
    // Bez odpovědi serveru (FunctionsFetchError, „Failed to fetch“, Safari „Load failed“, přerušení).
    if (status === undefined) {
      console.warn("[demo] connection error", { fn: name, name: error?.name, message: error?.message });
      throw new DemoCallError(DEMO_NETWORK_FAILED_MSG, "network");
    }
    let serverMsg: string | null = null;
    try {
      const j = await response!.clone().json();
      if (typeof j?.error === "string" && j.error.trim()) serverMsg = j.error;
    } catch { /* ne-JSON odpověď (brána) */ }
    console.warn("[demo] server error", { fn: name, name: error?.name, message: error?.message, status });
    if (RETRYABLE_STATUS.has(status) && !serverMsg) throw new DemoCallError(DEMO_SERVER_FAILED_MSG, "network", status);
    throw new DemoCallError(serverMsg ?? DEMO_SERVER_FAILED_MSG, "server", status);
  } catch (e) {
    if (e instanceof DemoCallError) throw e;
    console.warn("[demo] connection error", { fn: name, name: (e as Error)?.name, message: (e as Error)?.message });
    throw new DemoCallError(DEMO_NETWORK_FAILED_MSG, "network");
  } finally {
    clearTimeout(timer);
  }
}

async function call(name: string, body: Record<string, unknown>, opts: DemoCallOptions = {}): Promise<DemoResponse> {
  const retries = opts.retries ?? 0;
  const delays = opts.delays ?? DEMO_RETRY_DELAYS;
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(name, body, opts.timeoutMs ?? DEMO_TIMEOUT_MS);
    } catch (e) {
      const retryable = e instanceof DemoCallError && e.kind === "network";
      if (!retryable || attempt >= retries) {
        if (retryable) throw new DemoCallError(DEMO_NETWORK_FAILED_MSG, "network", (e as DemoCallError).status);
        throw e;
      }
      opts.onRetry?.(attempt + 1);
      await sleep(delays[Math.min(attempt, delays.length - 1)] ?? 0);
    }
  }
}

async function applyDemoSession(res: DemoResponse) {
  if (!res?.session) throw new DemoCallError(res?.error || "Nepodařilo se přihlásit.", "server");
  // setSession ověřuje uživatele po síti; při výpadku spojení zkusit ještě jednou (nic nezakládá).
  let { error } = await supabase.auth.setSession(res.session);
  if (error) {
    console.warn("[demo] setSession failed", { name: error.name, message: error.message, status: (error as any).status });
    await sleep(800);
    ({ error } = await supabase.auth.setSession(res.session));
  }
  if (error) throw new DemoCallError(DEMO_NETWORK_FAILED_MSG, "network");
  if (res.return_code) {
    try { window.localStorage.setItem(DEMO_CODE_KEY, res.return_code); } catch { /* ignore */ }
  }
  return res.role ?? "teacher";
}

export async function startDemo(role: "teacher" | "student", eventTag: string | null, opts: DemoCallOptions = {}) {
  return applyDemoSession(await call("create-demo-session", { role, event_tag: eventTag }, { retries: 2, ...opts }));
}

export async function restoreDemo(code: string, opts: DemoCallOptions = {}) {
  return applyDemoSession(await call("demo-restore", { code }, { retries: 2, ...opts }));
}

export async function switchDemo() {
  return applyDemoSession(await call("demo-switch", {}));
}
