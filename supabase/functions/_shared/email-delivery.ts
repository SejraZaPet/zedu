// Sdílená logika spolehlivého odesílání e-mailů (rate limit + retry).

export const SEND_INTERVAL_MS = 500; // ~2 e-maily za sekundu
export const RETRY_DELAYS_MS = [1000, 3000, 8000];
export const MAX_NOTIFICATION_AGE_MS = 6 * 60 * 60 * 1000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isTooOld(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t > MAX_NOTIFICATION_AGE_MS;
}

/** Retry-After v sekundách nebo HTTP datum → ms (null pokud chybí/nečitelné). */
export function parseRetryAfter(v: string | null, now = Date.now()): number | null {
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, n * 1000);
  const d = Date.parse(v);
  return Number.isFinite(d) ? Math.max(0, d - now) : null;
}

export interface SendDeps {
  /** Vrací, kolik ms počkat na vlastní slot (sdílený v DB). */
  reserveSlot: () => Promise<number>;
  doFetch: () => Promise<Response>;
  sleepFn?: (ms: number) => Promise<void>;
}

/** Odešle s rate limitem; při 429/5xx opakuje (1 s, 3 s, 8 s nebo Retry-After). */
export async function sendWithRetry(deps: SendDeps): Promise<Response> {
  const zz = deps.sleepFn ?? sleep;
  let res: Response | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const wait = await deps.reserveSlot().catch(() => SEND_INTERVAL_MS);
    if (wait > 0) await zz(wait);
    res = await deps.doFetch();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === RETRY_DELAYS_MS.length) return res;
    const ra = parseRetryAfter(res.headers.get("Retry-After"));
    await res.body?.cancel().catch(() => {});
    await zz(Math.max(RETRY_DELAYS_MS[attempt], ra ?? 0));
  }
  return res!;
}
