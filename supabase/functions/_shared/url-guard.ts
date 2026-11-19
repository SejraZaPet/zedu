/**
 * Čisté kontroly pro fetch-source-url (bez Deno API, testováno ve vitest).
 * Chrání proti SSRF: jen http(s) na 80/443, bez přihlašovacích údajů v URL,
 * bez privátních/lokálních/metadata adres (IPv4 i IPv6).
 */
export const URL_FETCH_TIMEOUT_MS = 8000;
export const URL_FETCH_MAX_BYTES = 2 * 1024 * 1024;
export const URL_FETCH_MAX_REDIRECTS = 3;
export const URL_TEXT_MAX_CHARS = 60000;

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];

export function checkUrlShape(raw: unknown): { ok: true; url: URL } | { ok: false } {
  if (typeof raw !== "string" || raw.length > 2048) return { ok: false };
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
  if (u.username || u.password) return { ok: false };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false };
  if (!host.includes(".") && !host.includes(":") && !host.startsWith("[")) return { ok: false };
  const lit = ipLiteral(host);
  if (lit && isBlockedIp(lit)) return { ok: false };
  return { ok: true, url: u };
}

/** Vrátí IP, je-li hostname IP literál (včetně [v6]), jinak null. */
export function ipLiteral(host: string): string | null {
  const h = host.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;
  if (h.includes(":")) return h;
  // Číselné zápisy typu 2130706433 nebo 0x7f000001 – URL je normalizuje, ale pro jistotu blokovat.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(h)) return "0.0.0.0";
  return null;
}

function v4ToInt(ip: string): number | null {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true;
  return V4_BLOCKED.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  // vložená IPv4 na konci
  const m = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (m) {
    const n = v4ToInt(m[1]);
    if (n === null) return null;
    s = s.slice(0, -m[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const all = [...head, ...Array(fill).fill("0"), ...tail];
  if (all.length !== 8) return null;
  const nums = all.map((h) => parseInt(h, 16));
  return nums.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff) ? null : nums;
}

export function isBlockedIp(ip: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return v4Blocked(ip);
  const w = expandV6(ip);
  if (!w) return true;
  if (w.every((x) => x === 0)) return true;                               // ::
  if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return true;      // ::1
  const v4of = (a: number, b: number) => `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  if (w.slice(0, 5).every((x) => x === 0) && w[5] === 0xffff) return v4Blocked(v4of(w[6], w[7])); // ::ffff:a.b.c.d
  if (w[0] === 0x64 && w[1] === 0xff9b) return v4Blocked(v4of(w[6], w[7]));                       // NAT64
  if ((w[0] & 0xfe00) === 0xfc00) return true;   // fc00::/7
  if ((w[0] & 0xffc0) === 0xfe80) return true;   // fe80::/10
  if ((w[0] & 0xff00) === 0xff00) return true;   // multicast
  if (w[0] === 0x2001 && w[1] === 0x0db8) return true; // dokumentační
  if (w.slice(0, 6).every((x) => x === 0)) return true; // ::a.b.c.d (zastaralé)
  return false;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Čitelný text z HTML bez AI: bez skriptů, navigace a patiček; preferuje <article>/<main>. */
export function htmlToText(html: string): { title: string; text: string; loginForm: boolean } {
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? decodeEntities(titleM[1]).replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const loginForm = /<input[^>]+type=["']?password/i.test(html);
  let body = html.replace(/<!--[\s\S]*?-->/g, " ");
  body = body.replace(/<(script|style|noscript|template|svg|iframe|nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const main = body.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i);
  if (main && main[2].replace(/<[^>]+>/g, "").trim().length > 300) body = main[2];
  body = body
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t\u00a0]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text, loginForm };
}
