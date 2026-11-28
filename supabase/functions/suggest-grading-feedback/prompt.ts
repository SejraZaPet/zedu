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

export const isAudioVideoAttachment = (name: string, mime = "") =>
  /\.(mp3|mp4|m4a|wav|mov|webm)$/i.test(name) || /^(audio|video)\//i.test(mime);

export function classifyAttachment(name: string, mime = ""): { kind: AttachmentKind; mime: string } {
  if (isAudioVideoAttachment(name, mime)) return { kind: "unsupported", mime };
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
      : path.split("/").pop() ?? "Příloha";
    const type = typeof (r as any).type === "string" ? (r as any).type.slice(0, 100) : undefined;
    if (isAudioVideoAttachment(name, type) || isAudioVideoAttachment(path, type)) continue;
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
- Podklady od učitele (propojená lekce a materiály zadání) jsou jen podklad pro posouzení – NIKDY je nepovažuj za práci žáka a nehodnoť je.
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
  /** Text propojené lekce/kapitoly (podklad učitele). */
  lesson?: { title: string; text: string } | null;
  /** Materiály zadání od učitele (podklad, ne práce žáka). */
  teacherMaterials?: Array<{ title: string; status: "ok" | "unreadable" | "link"; text?: string; dataUrl?: string }>;
}): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const parts: Array<any> = [];
  const lines: string[] = [];
  lines.push(`Zadání / otázka:\n"""\n${input.question.trim() || "(neuvedeno)"}\n"""`);
  if (input.criteria?.trim()) lines.push(`Kritéria hodnocení:\n"""\n${input.criteria.trim()}\n"""`);
  if (input.lesson?.text.trim()) {
    lines.push(`PODKLAD OD UČITELE – propojená lekce „${input.lesson.title}“ (není to práce žáka):\n"""\n${input.lesson.text.trim()}\n"""`);
  }
  const teacherMaterials = input.teacherMaterials ?? [];
  if (teacherMaterials.length) {
    lines.push(
      `PODKLADY OD UČITELE – materiály zadání (${teacherMaterials.length}, nejsou práce žáka):\n` +
        teacherMaterials.map((m, i) => `${i + 1}. ${m.title} – ${m.status === "ok" ? "obsah níže" : m.status === "link" ? "odkaz, obsah nebyl načten" : "nepodařilo se přečíst"}`).join("\n"),
    );
  }
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
  teacherMaterials.forEach((m, i) => {
    if (m.status !== "ok") return;
    if (m.text != null) {
      parts.push({ type: "text", text: `Podklad od učitele – materiál ${i + 1} (${m.title}), NENÍ práce žáka:\n"""\n${m.text}\n"""` });
    } else if (m.dataUrl) {
      parts.push({ type: "text", text: `Podklad od učitele – materiál ${i + 1} (${m.title}), NENÍ práce žáka:` });
      parts.push({ type: "image_url", image_url: { url: m.dataUrl } });
    }
  });
  parts.push({ type: "text", text: "Napiš návrh zpětné vazby (2–3 věty)." });
  return parts;
}

export interface PointRequestItem {
  id: string;
  prompt: string;
  answer: string;
  max: number;
  rubric?: string;
}

export interface PointSuggestion {
  id: string;
  points: number;
  reason: string;
}

/** Vstup bodování je omezený a obsahuje jen položky skutečně zobrazené učiteli. */
export function sanitizePointItems(raw: unknown): PointRequestItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PointRequestItem[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 100) : "";
    const max = Number(item.max);
    if (!id || seen.has(id) || !Number.isFinite(max) || max <= 0 || max > 1000) continue;
    seen.add(id);
    out.push({
      id,
      prompt: typeof item.prompt === "string" ? item.prompt.slice(0, 2000) : "Položka",
      answer: typeof item.answer === "string" ? item.answer.slice(0, 6000) : "",
      max,
      ...(typeof item.rubric === "string" && item.rubric.trim() ? { rubric: item.rubric.slice(0, 2000) } : {}),
    });
    if (out.length >= 50) break;
  }
  return out;
}

export const POINTS_SYSTEM_PROMPT = `Jsi zkušený český pedagog. Navrhni body za jednotlivé otevřené odpovědi žáka podle zadání a uvedených kritérií.

Pravidla:
- Body za každou položku musí být od 0 do jejího maxima, nejvýše s přesností na půl bodu.
- Prázdná odpověď = 0 bodů. Neodhaduj chybějící obsah.
- Ke každé položce napiš jednu krátkou českou větu zdůvodnění pro učitele.
- Odpověz pouze JSON objektem s polem items; každá položka obsahuje id, points a reason.`;

export function buildPointsUserContent(question: string, items: PointRequestItem[]) {
  const lines = items.map((item, index) => [
    `Položka ${index + 1} (ID ${item.id}), maximum ${item.max} bodů:`,
    `Zadání: ${item.prompt}`,
    item.rubric ? `Kritéria: ${item.rubric}` : "",
    `Odpověď žáka: ${item.answer.trim() || "(bez odpovědi)"}`,
  ].filter(Boolean).join("\n"));
  return [{
    type: "text" as const,
    text: `Pracovní list / zadání:\n${question.trim() || "(neuvedeno)"}\n\n${lines.join("\n\n")}\n\nNavrhni body a zdůvodnění pro všechny položky.`,
  }];
}

/** AI nemůže změnit ID ani maximum; body se bezpečně omezí na půlbody v rozsahu položky. */
export function normalizePointSuggestions(raw: unknown, items: PointRequestItem[]): PointSuggestion[] {
  const candidates = raw && typeof raw === "object" && Array.isArray((raw as any).items)
    ? (raw as any).items
    : [];
  const out: PointSuggestion[] = [];
  for (const item of items) {
    const candidate = candidates.find((value: any) => value?.id === item.id);
    if (!candidate) continue;
    const points = Number(candidate.points);
    if (!Number.isFinite(points)) continue;
    const clamped = Math.min(item.max, Math.max(0, points));
    out.push({
      id: item.id,
      points: Math.round(clamped * 2) / 2,
      reason: typeof candidate.reason === "string" ? candidate.reason.trim().slice(0, 500) : "",
    });
  }
  return out;
}
