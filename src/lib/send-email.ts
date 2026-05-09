import { supabase } from "@/integrations/supabase/client";

const APP_URL = "https://www.zedu.cz";

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
    <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1A1F2C; background: #F8FAFC;">
      <div style="background: linear-gradient(135deg, #3FB8AF 0%, #9B87C9 100%); padding: 32px 24px; border-radius: 14px 14px 0 0; text-align: center;">
        <img src="https://www.zedu.cz/zedu-logo-new.png" alt="ZEdu" style="height: 48px; width: auto; margin-bottom: 12px;" onerror="this.style.display='none'" />
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; font-family: Lato, Arial, sans-serif;">ZEdu<span style="color: #a5f3fc;">.cz</span></h1>
        <p style="margin: 8px 0 0; opacity: 0.95; color: #ffffff; font-size: 14px; font-family: Lato, Arial, sans-serif;">Moderní nástroje pro vzdělávání</p>
      </div>

      <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 14px 14px;">
        <h2 style="margin-top: 0; color: #1A1F2C;">Vítejte v ZEdu, ${params.firstName}!</h2>
        <p style="color: #1A1F2C;">Byl vám vytvořen účet <strong>${roleLabel}</strong>. Níže najdete své přihlašovací údaje.</p>

        <div style="background: #F8FAFC; padding: 16px; border-radius: 14px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px; color: #1A1F2C;">Přihlašovací údaje</h3>
          ${params.username ? `<p style="margin: 4px 0;"><strong>Uživatelské jméno:</strong> ${params.username}</p>` : ""}
          ${params.studentCode ? `<p style="margin: 4px 0;"><strong>Kód žáka:</strong> ${params.studentCode}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Email:</strong> ${params.email}</p>
          <p style="margin: 4px 0;"><strong>Heslo:</strong> ${params.password}</p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/auth" style="background: #0F9A8B; color: #ffffff; padding: 12px 24px; border-radius: 14px; text-decoration: none; display: inline-block; font-weight: 600; font-family: Lato, Arial, sans-serif;">
            Přihlásit se do ZEdu
          </a>
        </div>

        <p style="font-size: 12px; color: #64748B; text-align: center; margin: 0;">
          Po prvním přihlášení si doporučujeme změnit heslo v nastavení profilu.
        </p>
      </div>

      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748B; font-family: Lato, Arial, sans-serif;">
        <p style="margin: 0 0 4px;">Tento email byl odeslán automaticky z platformy <a href="${APP_URL}" style="color: #0F9A8B; text-decoration: none;">ZEdu.cz</a></p>
        <p style="margin: 0;"><a href="${APP_URL}" style="color: #0F9A8B; text-decoration: none;">www.zedu.cz</a></p>
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

export const sendParentWelcomeEmail = async (params: {
  to: string;
  parentFirstName: string;
  parentEmail: string;
  parentPassword: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  studentPassword: string;
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="background: linear-gradient(135deg, #14b8a6, #6366f1); padding: 24px; border-radius: 8px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">ZEdu.cz</h1>
        <p style="margin: 4px 0 0; opacity: 0.9;">Moderní nástroje pro vzdělávání</p>
      </div>

      <h2 style="margin-top: 28px;">Vítejte v ZEdu, ${params.parentFirstName}!</h2>
      <p>Byl vám vytvořen rodičovský účet pro sledování pokroku vašeho dítěte <strong>${params.studentFirstName} ${params.studentLastName}</strong>.</p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px;">Vaše přihlašovací údaje (rodič)</h3>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${params.parentEmail}</p>
        <p style="margin: 4px 0;"><strong>Heslo:</strong> ${params.parentPassword}</p>
      </div>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px;">Přihlašovací údaje žáka – ${params.studentFirstName} ${params.studentLastName}</h3>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${params.studentEmail}</p>
        <p style="margin: 4px 0;"><strong>Heslo:</strong> ${params.studentPassword}</p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${APP_URL}/auth" style="background: #14b8a6; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600;">
          Přihlásit se do ZEdu
        </a>
      </div>
    </div>
  `;

  try {
    const result = await supabase.functions.invoke("send-email", {
      body: {
        to: params.to,
        subject: "Vítejte v ZEdu – přihlašovací údaje pro vás a vašeho žáka",
        html,
      },
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
