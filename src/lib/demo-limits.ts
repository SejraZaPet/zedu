import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Jeden limit dema ze serveru (RPC get_my_demo_limits). */
export interface DemoLimit { key: string; label: string; used: number; limit: number }

export const DEMO_BANNER_COLLAPSED_KEY = "Bezli:demo-banner-collapsed";
export const DEMO_LIMIT_EVENT = "bezli:demo-limit-exhausted";
export const DEMO_AI_EXHAUSTED_TEXT =
  "AI generování je vyčerpané. Tvoje práce zůstává uložená. Uložte si ji nebo si vytvořte účet.";
/** Shodné se serverovou hláškou v _shared/demo-ai-guard.ts. */
export const DEMO_AI_LIMIT_SERVER_MESSAGE = "Demo má limit AI generování";

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

/** Kvóty počtu položek v demu (klíče shodné se supabase/proposals/demo_item_quotas.sql). */
export const DEMO_QUOTA_NOUNS: Record<string, string> = {
  textbooks: "učebnic", lessons: "lekcí", presentations: "prezentací", worksheets: "pracovních listů",
  activities: "aktivit", assignments: "úkolů", classes: "tříd a skupin",
  live_active: "současně běžících živých her", live_total: "živých her",
};

/** Hláška při dosažení kvóty (vykání – demo používá učitel). */
export function demoQuotaMessage(key: string, limit: number): string {
  const noun = DEMO_QUOTA_NOUNS[key] ?? "položek";
  return `Počet ${noun} je v ukázce omezen na ${limit}. V plném účtu bez omezení.`;
}

/** Najde serverový kód DEMO_QUOTA:<klíč>:<limit> v textu chyby. */
export function parseDemoQuotaError(text: string): { key: string; limit: number } | null {
  const m = /DEMO_QUOTA:([a-z_]+):(\d+)/.exec(text || "");
  return m ? { key: m[1], limit: Number(m[2]) } : null;
}

/** Krátký čip: AI zůstává „zbývají X z N“, kvóty jako „Učebnice 1/2“. */
export function limitChipText(l: DemoLimit, out: boolean): string {
  if (l.key === "ai") return `${l.label}: zbývají ${out ? 0 : remaining(l)} z ${l.limit}`;
  return `${l.label} ${Math.min(l.used, l.limit)}/${l.limit}`;
}

/** Na úzkém displeji jen AI a kvóty od 80 % využití; ostatní pod „Další limity“. */
export function isNearLimit(l: DemoLimit): boolean {
  return l.key === "ai" || l.limit <= 0 || l.used / l.limit >= 0.8;
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
      if (res.status >= 400 && (url.includes("/rest/v1/") || url.includes("/functions/v1/"))) {
        const quota = parseDemoQuotaError(await res.clone().text());
        if (quota) window.dispatchEvent(new CustomEvent(DEMO_LIMIT_EVENT, { detail: { key: quota.key, limit: quota.limit } }));
      }
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
