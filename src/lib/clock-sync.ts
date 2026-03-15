/**
 * Estimates the offset between the client clock and the Supabase server clock.
 *
 * offset = serverTime - clientTime
 *   → positive means client is behind server
 *   → to convert a server timestamp to client-relative: new Date(ts).getTime() - offset
 *
 * We use the Supabase REST endpoint (lightweight SELECT now()) and measure
 * round-trip to approximate one-way latency.
 */

import { supabase } from "@/integrations/supabase/client";

let cachedOffset: number = 0;
let lastSyncAt: number = 0;
const SYNC_INTERVAL_MS = 60_000; // re-sync at most once per minute

/**
 * Returns the estimated clock offset in ms (serverTime − clientTime).
 * First call performs a network request; subsequent calls return cached value
 * until SYNC_INTERVAL_MS has elapsed.
 */
export async function syncClock(force = false): Promise<number> {
  if (!force && lastSyncAt > 0 && Date.now() - lastSyncAt < SYNC_INTERVAL_MS) {
    return cachedOffset;
  }

  try {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("is_admin"); // lightweight RPC
    const t1 = Date.now();

    if (error) {
      console.warn("[clock-sync] RPC failed, keeping cached offset", error.message);
      return cachedOffset;
    }

    // We can't easily get server time from rpc, so use the Date header
    // from a raw fetch instead.
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/?select=1`,
      {
        method: "HEAD",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );
    const t2 = Date.now();
    const serverDateStr = res.headers.get("date");

    if (serverDateStr) {
      const serverTime = new Date(serverDateStr).getTime();
      const rtt = t2 - t0;
      const estimatedServerNow = serverTime + rtt / 2;
      cachedOffset = estimatedServerNow - t2;
    }

    lastSyncAt = Date.now();
  } catch (e) {
    console.warn("[clock-sync] sync failed, using cached offset", e);
  }

  return cachedOffset;
}

/**
 * Returns a synchronous getter for the current offset.
 * Safe to call in render/interval — returns last known offset.
 */
export function getClockOffset(): number {
  return cachedOffset;
}

/**
 * Converts a server ISO timestamp to a client-relative epoch ms.
 * Use this everywhere instead of `new Date(serverTs).getTime()`.
 */
export function serverTsToClientMs(serverIso: string): number {
  return new Date(serverIso).getTime() - cachedOffset;
}

/**
 * Returns current "server time" estimated from client clock + offset.
 */
export function estimatedServerNow(): number {
  return Date.now() + cachedOffset;
}
