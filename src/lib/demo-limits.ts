import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Jeden limit dema ze serveru (RPC get_my_demo_limits). */
export interface DemoLimit { key: string; label: string; used: number; limit: number }

export const DEMO_BANNER_COLLAPSED_KEY = "Bezli:demo-banner-collapsed";
export const DEMO_LIMIT_EVENT = "bezli:demo-limit-exhausted";
export const DEMO_AI_EXHAUSTED_TEXT =
  "AI generování je vyčerpané. Tvoje práce zůstává uložená. Uložte si ji nebo si vytvořte účet.";
/** Shodné se serverovou hláškou v _shared/demo-ai-guard.ts. */
export const DEMO_AI_LIMIT_SERVER_MESSAGE = "Testovací účet má limit AI generování";

export const remaining = (l: DemoLimit) => Math.max(0, l.limit - l.used);
export const isExhausted = (l: DemoLimit) => remaining(l) <= 0;

/** Pruh se nesmí schovat, když smazání hrozí do 3 dnů nebo je limit vyčerpán. */
export function mustStayExpanded(daysLeft: number | null | undefined, exhausted: boolean): boolean {
  return exhausted || (typeof daysLeft === "number" && daysLeft <= 3);
}

export function readCollapsed(): boolean {
  try { return window.localStorage.getItem(DEMO_BANNER_COLLAPSED_KEY) === "1"; } catch { return false; }
}
/** Vrátí, zda se stav podařilo uložit; při selhání má být pruh rozbalený. */
export function writeCollapsed(v: boolean): boolean {
  try {
    if (v) window.localStorage.setItem(DEMO_BANNER_COLLAPSED_KEY, "1");
    else window.localStorage.removeItem(DEMO_BANNER_COLLAPSED_KEY);
    return true;
  } catch { return false; }
}

/** Rozpozná 429 odpověď demo AI limitu z edge funkce. */
export function isDemoAiLimitBody(status: number, body: string): boolean {
  return status === 429 && body.includes(DEMO_AI_LIMIT_SERVER_MESSAGE);
}

/**
 * Jen pro demo uživatele: sleduje odpovědi funkcí a při vyčerpaném AI limitu
 * vyšle událost, aby pruh ukázal čitelnou hlášku – bez úprav jednotlivých AI míst.
 */
export function installDemoLimitWatcher(): () => void {
  const orig = window.fetch;
  const wrapped: typeof fetch = async (...args) => {
    const res = await orig(args[0], args[1]);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request).url;
      if (res.status === 429 && url.includes("/functions/v1/")) {
        const text = await res.clone().text();
        if (isDemoAiLimitBody(res.status, text)) window.dispatchEvent(new CustomEvent(DEMO_LIMIT_EVENT, { detail: { key: "ai" } }));
      }
    } catch { /* ignore */ }
    return res;
  };
  window.fetch = wrapped;
  return () => { if (window.fetch === wrapped) window.fetch = orig; };
}

/** Limity vlastního dema; bez schválené RPC vrací prázdný seznam (čipy se neukážou). */
export function useDemoLimits(enabled: boolean) {
  const [limits, setLimits] = useState<DemoLimit[]>([]);
  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data, error } = await (supabase.rpc as any)("get_my_demo_limits");
      if (error || !Array.isArray(data)) { setLimits([]); return; }
      setLimits(data
        .filter((r: any) => r && typeof r.key === "string" && Number.isFinite(Number(r.limit)))
        .map((r: any) => ({ key: r.key, label: String(r.label ?? r.key), used: Number(r.used) || 0, limit: Number(r.limit) })));
    } catch { setLimits([]); }
  }, [enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return { limits, reload };
}
