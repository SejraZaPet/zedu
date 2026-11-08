import { duplexIndex, validCheatsheet, type CheatsheetData } from "./cheatsheet";
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
export function cheatsheetPrintHtml(cards: CheatsheetData[], repeat = false): string {
  if (!cards.length || cards.some(c => !validCheatsheet(c))) throw new Error("Tahák překračuje povolené limity.");
  const selected = repeat ? Array.from({ length: 10 }, () => cards[0]) : cards;
  const pages: string[] = [];
  for (let offset = 0; offset < selected.length; offset += 10) {
    const batch = selected.slice(offset, offset + 10);
    for (const side of ["front", "back"] as const) {
      const cells = Array.from({ length: 10 }, (_, i) => {
        const card = batch[side === "back" ? duplexIndex(i) : i];
        return `<div class="slot">${card ? `<article><header>${escape(card.title)}${card.subject ? ` · ${escape(card.subject)}` : ""}</header><div class="text" style="font-size:${card.fontPt}pt">${escape(card[side])}</div></article>` : ""}<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>`;
      }).join("");
      pages.push(`<section class="page">${cells}</section>`);
    }
  }
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Tahák – Bezli</title><style>
  :root{--paper:white;--ink:black;--cut:#777}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,sans-serif}.page{width:210mm;height:297mm;padding:11mm 15mm;display:grid;grid-template-columns:90mm 90mm;grid-template-rows:repeat(5,55mm);break-after:page}.page:last-child{break-after:auto}.slot{position:relative;width:90mm;height:55mm}article{width:90mm;height:55mm;padding:3mm;overflow:hidden}header{font-size:7pt;font-weight:bold;line-height:1.2;height:7mm;overflow-wrap:anywhere;overflow:hidden}.text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.15;max-height:42mm;overflow:hidden}i{position:absolute;width:2mm;height:2mm;border-color:var(--cut);border-style:solid;border-width:0}.tl{top:0;left:0;border-top-width:.2mm;border-left-width:.2mm}.tr{top:0;right:0;border-top-width:.2mm;border-right-width:.2mm}.bl{bottom:0;left:0;border-bottom-width:.2mm;border-left-width:.2mm}.br{bottom:0;right:0;border-bottom-width:.2mm;border-right-width:.2mm}@page{size:A4;margin:0}@media screen{.page{outline:1px solid var(--cut);margin:10px auto}}
  </style></head><body>${pages.join("")}</body></html>`;
}
export async function printCheatsheets(cards: CheatsheetData[], repeat = false) {
  const html = cheatsheetPrintHtml(cards, repeat);
  const frame = document.createElement("iframe");
  frame.title = "Tisk taháků";
  frame.className = "cheatsheet-print-frame";
  document.body.append(frame);
  await new Promise<void>(resolve => { frame.onload = () => resolve(); frame.srcdoc = html; });
  const win = frame.contentWindow;
  if (!win) { frame.remove(); throw new Error("Tisk není dostupný. Zkus to znovu."); }
  await win.document.fonts.ready;
  const overflow = Array.from(win.document.querySelectorAll<HTMLElement>(".text, header")).some(el => el.scrollHeight > el.clientHeight + 1);
  if (overflow) { frame.remove(); throw new Error("Text se nevejde na kartu. Zkrať ho nebo zvol menší písmo (nejméně 7 pt)."); }
  win.onafterprint = () => frame.remove();
  win.focus();
  win.print();
}