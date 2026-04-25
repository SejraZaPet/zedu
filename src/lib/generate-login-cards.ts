import logoUrl from "@/assets/zedu-logo-new.png";

export interface LoginCardData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: string;
  username?: string;
  studentCode?: string;
  childCodes?: string[];
}

const APP_URL = "https://www.zedu.cz";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStrip(user: LoginCardData): string {
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=" +
    encodeURIComponent(APP_URL + "/auth");
  const roleLabel =
    user.role === "teacher" ? "Učitel" : user.role === "rodic" ? "Rodič" : "Žák";

  return [
    '<div class="strip">',
    '<div class="strip-left">',
    '<img class="logo-img" src="' + logoUrl + '" alt="ZEdu" />',
    '<div class="role-badge">' + escHtml(roleLabel) + "</div>",
    "</div>",
    '<div class="strip-center">',
    '<div class="student-name">' +
      escHtml(user.firstName) +
      " " +
      escHtml(user.lastName) +
      "</div>",
    '<div class="cred-row"><div class="cred-label">Uživ. jméno:</div><div class="cred-value">' +
      escHtml(user.username || "–") +
      "</div></div>",
    '<div class="cred-row"><div class="cred-label">Přihlášení:</div><div class="cred-value">' +
      escHtml(user.email) +
      "</div></div>",
    (!user.password || user.password === "–" || user.password === "viz heslo při vytvoření")
      ? '<div class="cred-row"><div class="cred-label">Heslo:</div><div class="cred-value cred-password-note">Heslo nebylo uloženo – použijte reset hesla</div></div>'
      : '<div class="cred-row"><div class="cred-label">Heslo:</div><div class="cred-value cred-password">' +
        escHtml(user.password) +
        "</div></div>",
    ...(user.role === "rodic"
      ? [
          ...(user.childCodes && user.childCodes.length > 0
            ? ['<div class="cred-row"><div class="cred-label">Kód dítěte:</div><div class="cred-value cred-password">' + escHtml(user.childCodes.join(", ")) + '</div></div>']
            : []),
          '<div class="cred-row"><div class="cred-value cred-password-note">Další děti přidáte v profilu na zedu.cz zadáním jejich kódu ZAK-XXXX</div></div>',
        ]
      : (user.studentCode
          ? ['<div class="cred-row"><div class="cred-label">Kód žáka:</div><div class="cred-value cred-password">' + escHtml(user.studentCode) + "</div></div>"]
          : [])),
    "</div>",
    '<div class="strip-right">',
    '<img class="qr" src="' + qrUrl + '" alt="QR" />',
    '<div class="qr-label">zedu.cz</div>',
    "</div>",
    "</div>",
    '<div class="cut-line"><span class="scissors">✂</span></div>',
  ].join("");
}

const CSS = [
  "* { box-sizing: border-box; margin: 0; padding: 0; }",
  "@page { size: A4 portrait; margin: 10mm 12mm; }",
  "body { font-family: Arial, sans-serif; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
  ".strip { display: flex; align-items: center; gap: 10pt; padding: 7pt 10pt; border: 1pt solid #e2e8f0; min-height: 28mm; }",
  ".strip-left { display: flex; flex-direction: column; align-items: center; min-width: 44pt; gap: 4pt; }",
  ".logo-img { width: 40pt; height: auto; object-fit: contain; }",
  ".role-badge { font-size: 6pt; font-weight: 700; color: #fff; background: #6366f1; padding: 2pt 5pt; border-radius: 8pt; }",
  ".strip-center { flex: 1; display: flex; flex-direction: column; gap: 4pt; }",
  ".student-name { font-size: 14pt; font-weight: 700; color: #0f172a; }",
  ".cred-row { display: flex; gap: 5pt; align-items: baseline; }",
  ".cred-label { font-size: 7pt; font-weight: 600; text-transform: uppercase; color: #94a3b8; min-width: 48pt; }",
  ".cred-value { font-size: 9pt; font-family: monospace; color: #334155; }",
  ".cred-password { font-size: 11pt; font-weight: 700; font-family: monospace; color: #0f172a; letter-spacing: 0.04em; }",
  ".cred-password-note { font-size: 9pt; font-style: italic; color: #94a3b8; font-family: Arial, sans-serif; }",
  ".strip-right { display: flex; flex-direction: column; align-items: center; gap: 2pt; }",
  ".qr { width: 55pt; height: 55pt; }",
  ".qr-label { font-size: 6pt; color: #94a3b8; }",
  ".cut-line { border-top: 1pt dashed #cbd5e1; margin: 2pt 0; padding-left: 4pt; position: relative; }",
  ".scissors { position: absolute; top: -7pt; left: 2pt; font-size: 9pt; color: #94a3b8; background: #fff; padding: 0 2pt; }",
  "@media print { .no-print { display: none !important; } }",
].join(" ");

export function generateLoginCardsHtml(users: LoginCardData[]): string {
  const strips = users.map(buildStrip).join("");
  const head =
    "<!DOCTYPE html><html lang=\"cs\"><head><meta charset=\"UTF-8\"><title>Přihlašovací lístky ZEdu</title><style>" +
    CSS +
    "</style></head><body>";
  const foot =
    "<script>window.onload=function(){setTimeout(function(){window.print();},800);};<\/script></body></html>";
  return head + strips + foot;
}

export function printLoginCards(users: LoginCardData[]): void {
  const html = generateLoginCardsHtml(users);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Povolte vyskakovací okna pro tisk lístků.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
