// Generates a certificate PDF for a completed Academy enrollment.
// - Auth: user who owns the enrollment, or admin/service role.
// - Uses pdf-lib to draw a branded one-page PDF.
// - Uploads to `generated-pdfs` bucket, stores the storage path in `pdf_url`.
// - Sends an email with a signed download link via existing send-email fn.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { Bezli_LOGO_PNG_BASE64 } from "../_shared/Bezli-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// IMPORTANT: use FULL font files. The previous fontsource "latin-ext" files are
// unicode-range subsets that contain ONLY extended latin glyphs (no basic ASCII),
// which made every plain letter render as an empty box.
const FONT_REGULAR_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/Lato-Regular.ttf";
const FONT_BOLD_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/Lato-Bold.ttf";


// Brand tokens (must stay in sync with src/index.css)
const TEAL = { r: 0x63 / 255, g: 0xc7 / 255, b: 0xcf / 255 };
const LAVENDER = { r: 0xa0 / 255, g: 0x65 / 255, b: 0xd7 / 255 };
const INK = { r: 0.13, g: 0.13, b: 0.16 };
const MUTED = { r: 0.42, g: 0.42, b: 0.48 };

async function buildCertificatePdf(params: {
  userName: string;
  courseTitle: string;
  courseAccredited: boolean;
  accreditationNumber?: string | null;
  certificateNumber: string;
  issuedAt: Date;
}): Promise<Uint8Array> {
  const [rRes, bRes] = await Promise.all([fetch(FONT_REGULAR_URL), fetch(FONT_BOLD_URL)]);
  if (!rRes.ok || !bRes.ok) {
    throw new Error(`Font download failed (${rRes.status}/${bRes.status})`);
  }
  const regular = new Uint8Array(await rRes.arrayBuffer());
  const bold = new Uint8Array(await bRes.arrayBuffer());

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // subset: false — subsetting these files breaks glyph mapping in several viewers.
  const font = await doc.embedFont(regular, { subset: false });
  const fontBold = await doc.embedFont(bold, { subset: false });


  // A4 landscape
  const width = 842, height = 595;
  const page = doc.addPage([width, height]);

  // Outer ivory background
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.99, 0.995) });

  // Gradient-like top band (two strips) + bottom band
  page.drawRectangle({ x: 0, y: height - 12, width: width * 0.55, height: 12, color: rgb(TEAL.r, TEAL.g, TEAL.b) });
  page.drawRectangle({ x: width * 0.55, y: height - 12, width: width * 0.45, height: 12, color: rgb(LAVENDER.r, LAVENDER.g, LAVENDER.b) });
  page.drawRectangle({ x: 0, y: 0, width: width * 0.45, height: 12, color: rgb(LAVENDER.r, LAVENDER.g, LAVENDER.b) });
  page.drawRectangle({ x: width * 0.45, y: 0, width: width * 0.55, height: 12, color: rgb(TEAL.r, TEAL.g, TEAL.b) });

  // Inner double frame
  const inset = 36;
  page.drawRectangle({
    x: inset, y: inset, width: width - inset * 2, height: height - inset * 2,
    borderColor: rgb(TEAL.r, TEAL.g, TEAL.b), borderWidth: 1.5,
  });
  page.drawRectangle({
    x: inset + 8, y: inset + 8, width: width - (inset + 8) * 2, height: height - (inset + 8) * 2,
    borderColor: rgb(LAVENDER.r, LAVENDER.g, LAVENDER.b), borderWidth: 0.6,
  });

  const centerX = width / 2;
  const drawCentered = (text: string, y: number, size: number, boldFont = false, color = INK) => {
    const f = boldFont ? fontBold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: centerX - w / 2, y, size, font: f, color: rgb(color.r, color.g, color.b) });
  };

  // Brand mark: logo image + wordmark
  try {
    const logoBytes = Uint8Array.from(atob(Bezli_LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
    const logo = await doc.embedPng(logoBytes);
    const logoW = 120;
    const logoH = (logo.height / logo.width) * logoW;
    page.drawImage(logo, { x: centerX - logoW / 2, y: height - 60 - logoH, width: logoW, height: logoH });
    drawCentered("Bezli Akademie", height - 72 - logoH, 12, true, TEAL);
  } catch (e) {
    console.warn("Logo embed failed, falling back to text:", e);
    drawCentered("Bezli Akademie", height - 90, 14, true, TEAL);
  }


  // Title
  drawCentered("CERTIFIKÁT", height - 168, 40, true, INK);
  drawCentered("o absolvování kurzu", height - 192, 12, false, MUTED);

  // Recipient
  drawCentered("Tímto se osvědčuje, že", height - 235, 12, false, MUTED);
  drawCentered(params.userName || "Účastník kurzu", height - 275, 30, true, INK);

  drawCentered("úspěšně absolvoval(a) kurz", height - 315, 12, false, MUTED);
  drawCentered("„" + params.courseTitle + "“", height - 350, 20, true, LAVENDER);

  if (params.courseAccredited && params.accreditationNumber) {
    drawCentered(
      "Akreditovaný kurz DVPP – č. akreditace " + params.accreditationNumber,
      height - 380, 10, false, MUTED,
    );
  }

  // Footer meta line
  const dateStr = params.issuedAt.toLocaleDateString("cs-CZ", {
    day: "numeric", month: "long", year: "numeric",
  });
  const timeStr = params.issuedAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });

  // Left block: date; right block: certificate number
  const footerY = 110;
  const boxLabelSize = 9;
  const boxValueSize = 12;
  const leftX = 120;
  const rightX = width - 120;

  page.drawText("DATUM VYDÁNÍ", { x: leftX, y: footerY + 22, size: boxLabelSize, font: fontBold, color: rgb(MUTED.r, MUTED.g, MUTED.b) });
  page.drawText(`${dateStr} · ${timeStr}`, { x: leftX, y: footerY, size: boxValueSize, font, color: rgb(INK.r, INK.g, INK.b) });

  const numLabel = "ČÍSLO CERTIFIKÁTU";
  const numLabelW = fontBold.widthOfTextAtSize(numLabel, boxLabelSize);
  const numValW = font.widthOfTextAtSize(params.certificateNumber, boxValueSize);
  page.drawText(numLabel, { x: rightX - numLabelW, y: footerY + 22, size: boxLabelSize, font: fontBold, color: rgb(MUTED.r, MUTED.g, MUTED.b) });
  page.drawText(params.certificateNumber, { x: rightX - numValW, y: footerY, size: boxValueSize, font, color: rgb(INK.r, INK.g, INK.b) });

  // Bottom signature line label (issuer)
  const issuer = "Bezli.cz · www.Bezli.cz";
  const iw = font.widthOfTextAtSize(issuer, 10);
  page.drawText(issuer, { x: centerX - iw / 2, y: 60, size: 10, font, color: rgb(MUTED.r, MUTED.g, MUTED.b) });

  return await doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user || null;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { enrollment_id, certificate_id } = await req.json();
    if (!enrollment_id && !certificate_id) {
      return new Response(JSON.stringify({ error: "Missing enrollment_id or certificate_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch certificate row + related enrollment/course/user
    let certQuery = admin
      .from("academy_certificates")
      .select("id, enrollment_id, certificate_number, issued_at, pdf_url, academy_enrollments!inner(id, teacher_id, course_id, completed_at, academy_courses!inner(id, title, is_accredited, accreditation_number))")
      .limit(1);
    if (certificate_id) certQuery = certQuery.eq("id", certificate_id);
    else certQuery = certQuery.eq("enrollment_id", enrollment_id);
    const { data: certRows, error: certErr } = await certQuery;
    if (certErr) throw certErr;
    const cert: any = certRows?.[0];
    if (!cert) {
      return new Response(JSON.stringify({ error: "Certificate not found (course may not issue certificates or enrollment not yet completed)" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enrollment = cert.academy_enrollments;
    const course = enrollment.academy_courses;

    // Auth: owner or admin
    let isAdmin = false;
    if (enrollment.teacher_id !== user.id) {
      const { data: adminRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!adminRow;
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch profile for name + email
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, last_name, academic_title, email")
      .eq("id", enrollment.teacher_id)
      .maybeSingle();
    const userName = [profile?.academic_title, profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
      || profile?.email
      || "Účastník kurzu";


    const bucket = "generated-pdfs";
    const storagePath = `academy-certificates/${cert.id}.pdf`;

    let didGenerate = false;
    if (!cert.pdf_url) {
      const pdfBytes = await buildCertificatePdf({
        userName,
        courseTitle: course.title,
        courseAccredited: !!course.is_accredited,
        accreditationNumber: course.accreditation_number,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
      });

      const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) throw upErr;

      await admin.from("academy_certificates").update({ pdf_url: storagePath }).eq("id", cert.id);
      didGenerate = true;
    }

    // Create signed URL (7 days)
    const { data: signed } = await admin.storage.from(bucket).createSignedUrl(cert.pdf_url || storagePath, 60 * 60 * 24 * 7);
    const downloadUrl = signed?.signedUrl || null;

    // Fire-and-forget email on first generation
    if (didGenerate && profile?.email && downloadUrl) {
      const html = `
        <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #222; background: #f8f9fb;">
          <div style="background: linear-gradient(135deg, #63C7CF 0%, #A065D7 100%); padding: 28px 24px; border-radius: 14px 14px 0 0; text-align: center; color: #fff;">
            <h1 style="margin:0; font-size: 22px;">🎓 Gratulujeme k dokončení kurzu!</h1>
          </div>
          <div style="background:#fff; padding: 24px; border-radius: 0 0 14px 14px;">
            <p>Vážený/á ${userName},</p>
            <p>úspěšně jste dokončil(a) kurz <strong>${course.title}</strong> v Bezli Akademii. V příloze / na odkazu níže najdete svůj osobní certifikát.</p>
            <p><strong>Číslo certifikátu:</strong> ${cert.certificate_number}</p>
            <div style="text-align:center; margin: 24px 0;">
              <a href="${downloadUrl}" style="background:#63C7CF; color:#fff; padding: 12px 24px; border-radius: 12px; text-decoration:none; font-weight:600; display:inline-block;">Stáhnout certifikát (PDF)</a>
            </div>
            <p style="font-size:12px; color:#666;">Odkaz je platný 7 dní. Certifikát můžete kdykoli znovu stáhnout v Bezli Akademii v sekci „Moje certifikáty“.</p>
          </div>
        </div>`;
      try {
        await admin.functions.invoke("send-email", {
          body: {
            to: profile.email,
            subject: `Certifikát – ${course.title}`,
            html,
            text: `Gratulujeme k dokončení kurzu ${course.title}. Certifikát č. ${cert.certificate_number} si stáhněte zde: ${downloadUrl}`,
          },
          headers: { Authorization: `Bearer ${SERVICE_KEY}` },
        });
      } catch (e) {
        console.warn("Email send failed (non-fatal):", e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        certificate_id: cert.id,
        certificate_number: cert.certificate_number,
        pdf_url: cert.pdf_url || storagePath,
        download_url: downloadUrl,
        generated: didGenerate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    console.error("generate-certificate error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
