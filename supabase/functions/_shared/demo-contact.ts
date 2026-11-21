// Demo kontakt: znění souhlasu, validace e-mailu a texty připomínek (čisté funkce, testované).
// Sdílí klient (dialog) i serverové funkce, aby se znění nikdy nerozešlo.

export const DEMO_CONSENT_VERSION = "2026-11-19.v1";
export const DEMO_CONSENT_TEXT =
  "Souhlasím, aby Bezli použilo můj e-mail jen k připomenutí smazání ukázkového účtu a k převodu mé práce do ostrého účtu. Žádné novinky ani reklamu. Souhlas mohu kdykoli odvolat; e-mail smažeme nejpozději se smazáním dema.";

export const DEMO_APP_URL = "https://www.bezli.cz";
export const DEMO_REMINDER_FROM = "Bezli <noreply@bezli.cz>";
export const DEMO_REMINDER_REPLY_TO = "info@bezli.cz";
export const DEMO_REMINDER_EMAIL_TYPE = "demo_reminder";
/** Závěrečná zpráva je povolena až pro budoucí, zatím neschválené znění souhlasu. */
export const DEMO_FINAL_NOTICE_CONSENT_VERSION = "2026-11-21.v2";
export const DEMO_FINAL_CLAIM_TTL_MS = 60 * 60 * 1000;
/** Od kolika připomínek v jednom běhu se použije dávkové API (max 100 na požadavek). */
export const DEMO_BATCH_THRESHOLD = 20;
export const DEMO_BATCH_SIZE = 100;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function normalizeDemoEmail(v: unknown): string | null {
  const e = String(v ?? "").trim().toLowerCase();
  if (e.length < 6 || e.length > 254 || !EMAIL_RE.test(e)) return null;
  if (e.endsWith("@demo.bezli.cz")) return null;
  return e;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Odpočet v pruhu se ukazuje jen od 3 dnů před smazáním. */
export function showCountdown(daysLeft: number | null | undefined): boolean {
  return typeof daysLeft === "number" && daysLeft <= 3;
}

export function formatPragueDay(iso: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" })
    .format(new Date(iso));
}

/** deletes_at je 00:00 v Praze v D+1; poslední den dema D je o hodinu dříve (bezpečné i při změně času). */
export function formatDemoLastDay(deletesAt: string): string {
  return formatPragueDay(new Date(Date.parse(deletesAt) - 60 * 60 * 1000).toISOString());
}

export function isDemoFinalNoticeAllowed(consentVersion: string | null | undefined): boolean {
  return consentVersion === DEMO_FINAL_NOTICE_CONSENT_VERSION;
}

export function isDemoFinalClaimStale(claimedAt: string, now = Date.now()): boolean {
  const claimed = Date.parse(claimedAt);
  return Number.isFinite(claimed) && now - claimed >= DEMO_FINAL_CLAIM_TTL_MS;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildDemoReminderEmail(o: { kind: "0d" | "1d" | "3d"; deletesAt: string; unsubscribeUrl: string }) {
  // 1d je pouze přechodná podpora starých rezervací; nové SQL už vybírá výhradně 0d.
  const when = o.kind === "0d" ? "dnes o půlnoci" : o.kind === "1d" ? "zítra" : "za 3 dny";
  const date = o.kind === "1d" ? formatPragueDay(o.deletesAt) : formatDemoLastDay(o.deletesAt);
  const subject = `Váš ukázkový účet Bezli se smaže ${when}`;
  const lines = [
    `Dobrý den, váš ukázkový účet Bezli se ${when} (${date}) smaže i s vytvořenou prací.`,
    "Máte tři možnosti:",
    `1) Převést práci do ostrého účtu – napište nám přes ${DEMO_APP_URL}/licence a domluvíme převod.`,
    `2) Stáhnout ji – přihlaste se na ${DEMO_APP_URL}/demo svým návratovým kódem a v horním pruhu zvolte „Stáhnout moji práci“.`,
    "3) Nedělat nic – účet i e-mail smažeme.",
    "Stačí se do dema znovu přihlásit a smazání se posune o 14 dní.",
  ];
  const text = `${lines.join("\n\n")}\n\nOdhlásit připomínky a smazat e-mail: ${o.unsubscribeUrl}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1F2C;line-height:1.5">
${lines.map((l) => `<p>${esc(l)}</p>`).join("\n")}
<p style="font-size:12px;color:#64748B">E-mail jste nám dali jen pro připomínky dema. <a href="${esc(o.unsubscribeUrl)}">Odhlásit a smazat e-mail</a></p></div>`;
  return { subject, text, html };
}

export function buildDemoFinalEmail() {
  const subject = "Vaše ukázková data Bezli byla smazána";
  const message = "Vaše ukázková data i e-mail byly z Bezli smazány.";
  const text = `Dobrý den,\n\n${message}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1F2C;line-height:1.5"><p>Dobrý den,</p><p>${esc(message)}</p></div>`;
  return { subject, text, html };
}

/** Text odpočtu v demo pruhu (vykání, české tvary). */
export function demoCountdownText(daysLeft: number, day: string | null): string {
  const d = day ? ` (${day})` : "";
  if (daysLeft <= 0) return `Vaše práce se smaže dnes o půlnoci${d}.`;
  if (daysLeft === 1) return `Vaše práce se smaže zítra${d}.`;
  const unit = daysLeft <= 4 ? "dny" : "dní";
  return `Vaše práce se smaže za ${daysLeft} ${unit}${d}.`;
}
export const demoExtendedText = (day: string) => `Prodlouženo do ${day.replace(/\.$/, "")}.`;
