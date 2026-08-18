// Uvítací e-mail se stejnou strukturou jako `sendWelcomeEmail` v src/lib/send-email.ts,
// jen renderovaný na serveru (správce školy nemá práva na send-email volat přímo).

const APP_URL = "https://www.zedu.cz";
const BRAND_PRIMARY = "#6EC6D9";
const BRAND_SECONDARY = "#9B6CFF";
const BRAND_ACCENT_LIGHT = "#E8FBFF";
const NEUTRAL_TEXT = "#1F2937";
const NEUTRAL_MUTED = "#6B7280";
const NEUTRAL_SURFACE = "#F5F7FA";

export const buildWelcomeEmail = (params: {
  firstName: string;
  email: string;
  password: string;
  role: string;
  username?: string;
  studentCode?: string;
}) => {
  const roleLabel = params.role === "teacher" ? "učitel" : "žák";

  const html = `
    <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: ${NEUTRAL_TEXT}; background: ${NEUTRAL_SURFACE};">
      <div style="background: linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_SECONDARY} 100%); padding: 32px 24px; border-radius: 14px 14px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">ZEdu<span style="color: ${BRAND_ACCENT_LIGHT};">.cz</span></h1>
        <p style="margin: 8px 0 0; opacity: 0.95; color: #ffffff; font-size: 14px;">Moderní nástroje pro vzdělávání</p>
      </div>

      <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 14px 14px;">
        <h2 style="margin-top: 0; color: ${NEUTRAL_TEXT};">Vítejte v ZEdu, ${params.firstName}!</h2>
        <p style="color: ${NEUTRAL_TEXT};">Vaše škola vám vytvořila účet <strong>${roleLabel}</strong>. Níže najdete své přihlašovací údaje.</p>

        <div style="background: ${NEUTRAL_SURFACE}; padding: 16px; border-radius: 14px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px; color: ${NEUTRAL_TEXT};">Přihlašovací údaje</h3>
          ${params.username ? `<p style="margin: 4px 0;"><strong>Uživatelské jméno:</strong> ${params.username}</p>` : ""}
          ${params.studentCode ? `<p style="margin: 4px 0;"><strong>Kód žáka:</strong> ${params.studentCode}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Email:</strong> ${params.email}</p>
          <p style="margin: 4px 0;"><strong>Heslo:</strong> ${params.password}</p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/auth" style="background: ${BRAND_PRIMARY}; color: #ffffff; padding: 12px 24px; border-radius: 14px; text-decoration: none; display: inline-block; font-weight: 600;">
            Přihlásit se do ZEdu
          </a>
        </div>

        <p style="font-size: 12px; color: ${NEUTRAL_MUTED}; text-align: center; margin: 0;">
          Po prvním přihlášení si doporučujeme změnit heslo v nastavení profilu.
        </p>
      </div>
    </div>
  `;

  const text = `Vítejte v ZEdu, ${params.firstName}!

Vaše škola vám vytvořila účet ${roleLabel}. Přihlašovací údaje:

${params.username ? `Uživatelské jméno: ${params.username}\n` : ""}${params.studentCode ? `Kód žáka: ${params.studentCode}\n` : ""}Email: ${params.email}
Heslo: ${params.password}

Přihlaste se na: ${APP_URL}/auth`;

  return { subject: "Vítejte v ZEdu – vaše přihlašovací údaje", html, text };
};
