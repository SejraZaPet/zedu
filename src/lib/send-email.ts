import { supabase } from "@/integrations/supabase/client";

const APP_URL = "https://www.zedu.cz";

/**
 * Brand palette for e-mail HTML.
 * E-mail clients don't reliably support CSS custom properties, so brand hex
 * values live here as named constants — update these to rebrand e-mails.
 * Keep in sync with `--primary`, `--secondary`, and gradient tokens in
 * `src/index.css`.
 */
const BRAND_PRIMARY = "${BRAND_PRIMARY}";          // teal — CTA background, links
const BRAND_SECONDARY = "${BRAND_SECONDARY}";        // lavender — accents
const BRAND_GRADIENT_FROM = "${BRAND_PRIMARY}";    // header gradient start
const BRAND_GRADIENT_TO = "${BRAND_SECONDARY}";      // header gradient end
const BRAND_ACCENT_LIGHT = "${BRAND_ACCENT_LIGHT}";     // ".cz" highlight in header
const NEUTRAL_TEXT = "${NEUTRAL_TEXT}";
const NEUTRAL_MUTED = "${NEUTRAL_MUTED}";
const NEUTRAL_SURFACE = "${NEUTRAL_SURFACE}";


export const sendWelcomeEmail = async (params: {
  to: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  username?: string;
  studentCode?: string;
}) => {
  const roleLabel =
    params.role === "teacher" ? "učitel" : params.role === "rodic" ? "rodič" : "žák";

  const html = `
    <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: ${NEUTRAL_TEXT}; background: ${NEUTRAL_SURFACE};">
      <div style="background: linear-gradient(135deg, ${BRAND_GRADIENT_FROM} 0%, ${BRAND_GRADIENT_TO} 100%); padding: 32px 24px; border-radius: 14px 14px 0 0; text-align: center;">
        <img src="https://www.zedu.cz/zedu-logo-new.png" alt="ZEdu" style="height: 48px; width: auto; margin-bottom: 12px;" onerror="this.style.display='none'" />
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; font-family: Lato, Arial, sans-serif;">ZEdu<span style="color: ${BRAND_ACCENT_LIGHT};">.cz</span></h1>
        <p style="margin: 8px 0 0; opacity: 0.95; color: #ffffff; font-size: 14px; font-family: Lato, Arial, sans-serif;">Moderní nástroje pro vzdělávání</p>
      </div>

      <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 14px 14px;">
        <h2 style="margin-top: 0; color: ${NEUTRAL_TEXT};">Vítejte v ZEdu, ${params.firstName}!</h2>
        <p style="color: ${NEUTRAL_TEXT};">Byl vám vytvořen účet <strong>${roleLabel}</strong>. Níže najdete své přihlašovací údaje.</p>

        <div style="background: ${NEUTRAL_SURFACE}; padding: 16px; border-radius: 14px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px; color: ${NEUTRAL_TEXT};">Přihlašovací údaje</h3>
          ${params.username ? `<p style="margin: 4px 0;"><strong>Uživatelské jméno:</strong> ${params.username}</p>` : ""}
          ${params.studentCode ? `<p style="margin: 4px 0;"><strong>Kód žáka:</strong> ${params.studentCode}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Email:</strong> ${params.email}</p>
          <p style="margin: 4px 0;"><strong>Heslo:</strong> ${params.password}</p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/auth" style="background: ${BRAND_PRIMARY}; color: #ffffff; padding: 12px 24px; border-radius: 14px; text-decoration: none; display: inline-block; font-weight: 600; font-family: Lato, Arial, sans-serif;">
            Přihlásit se do ZEdu
          </a>
        </div>

        <p style="font-size: 12px; color: ${NEUTRAL_MUTED}; text-align: center; margin: 0;">
          Po prvním přihlášení si doporučujeme změnit heslo v nastavení profilu.
        </p>
      </div>

      <div style="text-align: center; padding: 16px; font-size: 12px; color: ${NEUTRAL_MUTED}; font-family: Lato, Arial, sans-serif;">
        <p style="margin: 0 0 4px;">Tento email byl odeslán automaticky z platformy <a href="${APP_URL}" style="color: ${BRAND_PRIMARY}; text-decoration: none;">ZEdu.cz</a></p>
        <p style="margin: 0;"><a href="${APP_URL}" style="color: ${BRAND_PRIMARY}; text-decoration: none;">www.zedu.cz</a></p>
      </div>
    </div>
  `;

  const text = `Vítejte v ZEdu, ${params.firstName}!

Byl vám vytvořen účet ${roleLabel}. Níže najdete své přihlašovací údaje:

${params.username ? `Uživatelské jméno: ${params.username}\n` : ""}${params.studentCode ? `Kód žáka: ${params.studentCode}\n` : ""}Email: ${params.email}
Heslo: ${params.password}

Přihlaste se na: ${APP_URL}/auth

Po prvním přihlášení si doporučujeme změnit heslo v nastavení profilu.

—
Tento email byl odeslán automaticky z platformy ZEdu.cz
${APP_URL}`;

  try {
    const result = await supabase.functions.invoke("send-email", {
      body: { to: params.to, subject: "Vítejte v ZEdu – vaše přihlašovací údaje", html, text },
    });
    if (result.error) {
      console.warn("Email se nepodařilo odeslat:", result.error);
    }
    return result;
  } catch (err) {
    console.warn("Email service nedostupný:", err);
    return { data: null, error: err };
  }
};
