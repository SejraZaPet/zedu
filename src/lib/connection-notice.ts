/** Krátké výpadky realtime kanálu hráč nepozná – hlásí se jen delší. */
export const RECONNECTING_NOTICE_DELAY_MS = 2500;
export const RESTORED_NOTICE_MIN_OUTAGE_MS = 3000;

export function shouldAnnounceRestore(
  outageStartedAtMs: number | null,
  nowMs: number,
  minOutageMs = RESTORED_NOTICE_MIN_OUTAGE_MS,
): boolean {
  if (outageStartedAtMs == null) return false;
  return nowMs - outageStartedAtMs >= minOutageMs;
}
