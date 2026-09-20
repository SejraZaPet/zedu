import { supabase } from "@/integrations/supabase/client";
import { extractPdfText } from "@/lib/pdf-page-renderer";

/** Max délka textu, kterou posíláme AI (stejný limit má edge funkce). */
export const CURRICULUM_AI_MAX_CHARS = 20000;

function fileToBase64Raw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function blocksToText(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      const p = b?.props ?? {};
      const vals = [p.text, p.title, p.content, p.caption].filter(Boolean).map(String);
      if (Array.isArray(p.items)) vals.push(p.items.map((i: any) => String(i?.text ?? i)).join("\n"));
      if (Array.isArray(p.rows))
        vals.push(p.rows.map((r: any) => (Array.isArray(r) ? r.join(" | ") : String(r))).join("\n"));
      return vals.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Starý binární formát .doc (Word 97-2003) AI jako soubor nepřijímá,
 * proto z něj text vytáhneme hrubou heuristikou v prohlížeči.
 */
async function extractLegacyDocText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let decoded = "";
  try {
    decoded = new TextDecoder("windows-1250").decode(buf);
  } catch {
    decoded = new TextDecoder("latin1").decode(buf);
  }
  const runs = decoded.match(/[\p{L}\p{N} .,;:!?()\-–—/%"'\r\n\t]{25,}/gu) ?? [];
  return runs
    .map((r) => r.replace(/[\r\t]+/g, "\n").replace(/[ ]{2,}/g, " ").trim())
    .filter((r) => /\p{L}{3,}/u.test(r))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extrahuje text z dokumentu na klientovi (PDF přes pdf.js, ostatní přes
 * edge funkci `process-file-content`) – stejný mechanismus jako FromMaterialView.
 */
export async function extractDocumentText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  let text = "";

  if (lower.endsWith(".doc")) {
    text = await extractLegacyDocText(file);
    if (text.length < 100) {
      throw new Error(
        "Starý formát .doc se nepodařilo přečíst. Otevřete dokument ve Wordu a uložte ho jako .docx nebo PDF, pak ho nahrajte znovu.",
      );
    }
    return text;
  }

  if (lower.endsWith(".pdf")) {
    try {
      const res = await extractPdfText(file);
      text = res.text ?? "";
    } catch {
      text = "";
    }
  }

  if (!text || text.length < 50) {
    const fileBase64 = await fileToBase64Raw(file);
    const { data, error } = await supabase.functions.invoke("process-file-content", {
      body: {
        fileBase64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        mode: "single",
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    const lessons = (data as any)?.lessons ?? [];
    text = lessons
      .map((l: any) => `${l.title || ""}\n${blocksToText(l.blocks || [])}`)
      .join("\n\n");
  }

  const clean = (text || "").trim();
  if (clean.length < 100) {
    throw new Error(
      "Ze souboru se nepodařilo extrahovat dostatek textu. Zkuste jiný soubor (např. PDF s textovou vrstvou) nebo obsah vložte ručně.",
    );
  }
  return clean;
}
