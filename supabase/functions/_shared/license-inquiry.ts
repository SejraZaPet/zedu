// Čisté části send-license-inquiry (testováno ve vitest). Musí odpovídat src/lib/terms.ts.
export const CURRENT_TERMS_VERSION = "1.0";
const SOURCES = ["demo", "form", "license", "other"] as const;

export type InquiryRow = {
  source: string; name: string; email: string; phone: string | null; organization: string | null;
  role: string | null; plan: string; student_count: string | null; message: string | null;
  consent_accepted_at: string; consent_terms_version: string;
};

const opt = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/** Ověří odeslání a sestaví řádek. Čas souhlasu určuje server, ne prohlížeč. */
export function buildInquiryRow(body: any, nowIso: string): { row: InquiryRow } | { error: string; status: number } {
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const plan = String(body?.plan ?? "").trim();
  if (!name || !email || !plan) return { error: "Chybí povinná pole", status: 400 };
  if (name.length > 200 || email.length > 255 || plan.length > 100 || String(body?.message ?? "").length > 5000)
    return { error: "Vstup je příliš dlouhý", status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Neplatný e-mail", status: 400 };
  if (body?.termsVersion !== CURRENT_TERMS_VERSION || !body?.termsAcceptedAt)
    return { error: "Je potřeba souhlasit s obchodními podmínkami.", status: 400 };
  const src = String(body?.source ?? "form");
  return {
    row: {
      source: (SOURCES as readonly string[]).includes(src) && src !== "demo" ? src : "form",
      name, email, plan,
      phone: opt(body?.phone, 50), organization: opt(body?.organization, 300), role: opt(body?.role, 100),
      student_count: opt(body?.studentCount, 20), message: opt(body?.message, 5000),
      consent_accepted_at: nowIso, consent_terms_version: CURRENT_TERMS_VERSION,
    },
  };
}
