// Načte čitelný text z veřejného webového odkazu (jednotný vstup zdrojů).
// Bez AI. Do logu jen kód výsledku a doba – nikdy URL ani obsah.
import { requireAuth } from "../_shared/auth.ts";
import {
  checkUrlShape, htmlToText, ipLiteral, isBlockedIp,
  URL_FETCH_MAX_BYTES, URL_FETCH_MAX_REDIRECTS, URL_FETCH_TIMEOUT_MS, URL_TEXT_MAX_CHARS,
} from "../_shared/url-guard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function hostAllowed(host: string): Promise<boolean> {
  const lit = ipLiteral(host);
  if (lit) return !isBlockedIp(lit);
  const ips: string[] = [];
  for (const t of ["A", "AAAA"] as const) {
    try { ips.push(...(await Deno.resolveDns(host, t))); } catch { /* žádné záznamy */ }
  }
  return ips.length > 0 && ips.every((ip) => !isBlockedIp(ip));
}

async function readLimited(res: Response): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > URL_FETCH_MAX_BYTES) { try { await reader.cancel(); } catch { /* */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const started = Date.now();
  const done = (code: string, body: unknown, status = 200) => {
    console.log("fetch-source-url", code, `${Date.now() - started}ms`);
    return json(body, status);
  };
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const block = await demoAiGuard(auth, "fetch-source-url");
    if (block) return block;
  }
  let body: any;
  try { body = await req.json(); } catch { return done("BAD_REQUEST", { error: "BLOCKED_URL" }, 400); }
  const shape = checkUrlShape(body?.url);
  if (!shape.ok) return done("BLOCKED_URL", { error: "BLOCKED_URL" }, 400);

  let url = shape.url;
  try {
    for (let hop = 0; hop <= URL_FETCH_MAX_REDIRECTS; hop++) {
      if (!(await hostAllowed(url.hostname))) return done("BLOCKED_URL", { error: "BLOCKED_URL" }, 400);
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "BezliSourceFetcher/1.0", Accept: "text/html,text/plain,application/pdf" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        try { await res.body?.cancel(); } catch { /* */ }
        if (!loc) return done("FETCH_FAILED", { error: "FETCH_FAILED" }, 502);
        const next = checkUrlShape(new URL(loc, url).toString());
        if (!next.ok) return done("BLOCKED_URL", { error: "BLOCKED_URL" }, 400);
        url = next.url;
        continue;
      }
      if (res.status === 401 || res.status === 403) return done("AUTH_REQUIRED", { error: "AUTH_REQUIRED" }, 422);
      if (!res.ok) return done("FETCH_FAILED", { error: "FETCH_FAILED" }, 502);
      const type = (res.headers.get("content-type") || "").toLowerCase();
      const bytes = await readLimited(res);
      if (!bytes) return done("TOO_LARGE", { error: "TOO_LARGE" }, 413);
      const origin = url.hostname;
      if (type.includes("application/pdf")) {
        return done("OK_PDF", { kind: "pdf", origin, fileName: `${origin}.pdf`, base64: toBase64(bytes) });
      }
      if (!type.includes("text/html") && !type.includes("text/plain") && !type.includes("xhtml")) {
        return done("UNSUPPORTED_TYPE", { error: "UNSUPPORTED_TYPE" }, 415);
      }
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const parsed = type.includes("text/plain") ? { title: "", text: raw.trim(), loginForm: false } : htmlToText(raw);
      if (parsed.text.length < 150) {
        return done(parsed.loginForm ? "AUTH_REQUIRED" : "JS_ONLY", { error: parsed.loginForm ? "AUTH_REQUIRED" : "JS_ONLY" }, 422);
      }
      const truncated = parsed.text.length > URL_TEXT_MAX_CHARS;
      return done("OK", {
        kind: "text", origin, title: parsed.title,
        text: truncated ? parsed.text.slice(0, URL_TEXT_MAX_CHARS) : parsed.text, truncated,
      });
    }
    return done("FETCH_FAILED", { error: "FETCH_FAILED" }, 502);
  } catch {
    return done("FETCH_FAILED", { error: "FETCH_FAILED" }, 502);
  }
});
