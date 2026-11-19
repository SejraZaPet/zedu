// Pure helpers for suggest-grading-feedback (no Deno/network imports → testable in vitest).

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export const MAX_DOC_TEXT_CHARS = 12000;

export type AttachmentKind = "image" | "pdf" | "docx" | "text" | "unsupported";

export interface AttachmentRef {
  path: string;
  name: string;
  type?: string;
}

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

export function classifyAttachment(name: string, mime = ""): { kind: AttachmentKind; mime: string } {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const m = mime.toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return { kind: "pdf", mime: "application/pdf" };
  if (IMAGE_MIME[ext] || /^image\/(jpeg|png|webp|gif)$/.test(m)) {
    return { kind: "image", mime: /^image\//.test(m) && !m.includes("heic") ? m : IMAGE_MIME[ext] || "image/jpeg" };
  }
  if (ext === "docx" || m.includes("wordprocessingml")) return { kind: "docx", mime: m };
  if (["txt", "md", "csv"].includes(ext) || m.startsWith("text/")) return { kind: "text", mime: "text/plain" };
  return { kind: "unsupported", mime: m };
}

/** Accepts only safe storage paths; dedupes; caps at MAX_FILES. */
export function sanitizeAttachmentRefs(raw: unknown): AttachmentRef[] {
  if (!Array.isArray(raw)) return [];
  const out: AttachmentRef[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const path = typeof (r as any).path === "string" ? (r as any).path.trim() : "";
    if (!path || path.length > 500 || path.includes("..") || path.startsWith("/") || /^https?:/i.test(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    const name = typeof (r as any).name === "string" && (r as any).name.trim()
      ? (r as any).name.trim().slice(0, 200)
      : path.split("/").pop()!;
    const type = typeof (r as any).type === "string" ? (r as any).type.slice(0, 100) : undefined;
    out.push({ path, name, type });
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

export interface LoadedAttachment {
  name: string;
  status: "ok" | "unreadable";
  /** For text/docx: extracted text. */
  text?: string;
  /** For image/pdf: data URL sent as multimodal part. */
  dataUrl?: string;
}

export const SYSTEM_PROMPT = `Jsi zkušený český pedagog. Napíšeš krátkou, konstruktivní zpětnou vazbu k práci žáka – 2 až 3 věty, česky, žákovi tykej, povzbudivě ale věcně.

ZÁSADY:
- Hodnoť podle zadání a kritérií, pokud jsou uvedena.
- Odevzdaná práce může být v textu odpovědi i v přílohách (PDF, obrázky, dokumenty). Přílohy jsou součást odevzdání – pokud nějaké přílohy existují, NIKDY netvrď, že výstup chybí nebo že je odevzdáno jen zadání.
- Pokud je u přílohy uvedeno, že ji nebylo možné přečíst, napiš, že přílohu se nepodařilo přečíst, a nehodnoť ji jako chybějící.
- Nejdřív krátce pochval, co je dobře, pak konkrétně navrhni zlepšení.
- Nikdy nediktuj správnou odpověď doslovně – navrhni směr.
- Odpověz pouze samotným textem zpětné vazby, bez uvozovek, úvodu a podpisu.`;

export function hasGradableContent(answerText: string, attachments: { length: number }): boolean {
  return answerText.trim().length > 0 || attachments.length > 0;
}

export function buildUserContent(input: {
  question: string;
  criteria?: string;
  answerText: string;
  scoreLine?: string;
  attachments: LoadedAttachment[];
}): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const parts: Array<any> = [];
  const lines: string[] = [];
  lines.push(`Zadání / otázka:\n"""\n${input.question.trim() || "(neuvedeno)"}\n"""`);
  if (input.criteria?.trim()) lines.push(`Kritéria hodnocení:\n"""\n${input.criteria.trim()}\n"""`);
  lines.push(`Textová odpověď žáka:\n"""\n${input.answerText.trim() || "(bez textové odpovědi)"}\n"""`);
  if (input.scoreLine) lines.push(input.scoreLine.trim());
  if (input.attachments.length) {
    lines.push(
      `Přílohy odevzdané žákem (${input.attachments.length}):\n` +
        input.attachments
          .map((a, i) =>
            `${i + 1}. ${a.name} – ${a.status === "ok" ? "obsah přiložen níže" : "PŘÍLOHU SE NEPODAŘILO PŘEČÍST"}`)
          .join("\n"),
    );
  } else {
    lines.push("Žák neodevzdal žádné přílohy.");
  }
  parts.push({ type: "text", text: lines.join("\n\n") });
  input.attachments.forEach((a, i) => {
    if (a.status !== "ok") return;
    if (a.text != null) {
      parts.push({ type: "text", text: `Obsah přílohy ${i + 1} (${a.name}):\n"""\n${a.text}\n"""` });
    } else if (a.dataUrl) {
      parts.push({ type: "text", text: `Příloha ${i + 1} (${a.name}):` });
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    }
  });
  parts.push({ type: "text", text: "Napiš návrh zpětné vazby (2–3 věty)." });
  return parts;
}
