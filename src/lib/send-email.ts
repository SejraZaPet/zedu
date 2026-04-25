import { supabase } from "@/integrations/supabase/client";

const APP_URL = "https://www.zedu.cz";

export const sendWelcomeEmail = async (params: {
  to: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
}) => {
  const roleLabel =
    params.role === "teacher" ? "učitel" : params.role === "rodic" ? "rodič" : "žák";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="background: linear-gradient(135deg, #14b8a6, #6366f1); padding: 24px; border-radius: 8px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">ZEdu.cz</h1>
        <p style="margin: 4px 0 0; opacity: 0.9;">Moderní nástroje pro vzdělávání</p>
      </div>

      <h2 style="margin-top: 28px;">Vítejte v ZEdu, ${params.firstName}!</h2>
      <p>Byl vám vytvořen účet <strong>${roleLabel}</strong>. Níže najdete své přihlašovací údaje.</p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px;">Přihlašovací údaje</h3>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${params.email}</p>
        <p style="margin: 4px 0;"><strong>Heslo:</strong> ${params.password}</p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${APP_URL}/auth" style="background: #14b8a6; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600;">
          Přihlásit se do ZEdu
        </a>
      </div>

      <p style="font-size: 12px; color: #6b7280; text-align: center;">
        Po prvním přihlášení si doporučujeme změnit heslo v nastavení profilu.
      </p>
    </div>
  `;

  try {
    const result = await supabase.functions.invoke("send-email", {
      body: { to: params.to, subject: "Vítejte v ZEdu – vaše přihlašovací údaje", html },
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
