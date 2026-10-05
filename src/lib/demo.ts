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

async function applyDemoSession(res: DemoResponse) {
  if (!res.session) throw new Error(res.error || "Nepodařilo se přihlásit.");
  const { error } = await supabase.auth.setSession(res.session);
  if (error) throw new Error("Nepodařilo se přihlásit.");
  if (res.return_code) {
    try { window.localStorage.setItem(DEMO_CODE_KEY, res.return_code); } catch { /* ignore */ }
  }
  return res.role ?? "teacher";
}

async function call(name: string, body: Record<string, unknown>): Promise<DemoResponse> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = "Něco se nepovedlo. Zkuste to prosím znovu.";
    try {
      const j = await (error as any).context?.json?.();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data as DemoResponse;
}

export async function startDemo(role: "teacher" | "student", eventTag: string | null) {
  return applyDemoSession(await call("create-demo-session", { role, event_tag: eventTag }));
}

export async function restoreDemo(code: string) {
  return applyDemoSession(await call("demo-restore", { code }));
}

export async function switchDemo() {
  return applyDemoSession(await call("demo-switch", {}));
}
