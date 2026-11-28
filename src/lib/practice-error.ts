const MESSAGES: Record<string, string> = {
  UNREADABLE_PHOTO: "Fotka je rozmazaná nebo moc tmavá, zkus ji vyfotit znovu zblízka a při lepším světle.",
  PHOTO_TEXT_TOO_LONG: "Na fotce je moc textu, vyfoť jen část nebo ji rozděl na více fotek.",
  INSUFFICIENT_TEXT: "Textu je málo, přidej další zdroj nebo text doplň ručně.",
  AI_PAYMENT_REQUIRED: "AI nemá dostatek kreditu. Požádejte správce o doplnění kreditu nebo text vložte ručně.",
  AI_RATE_LIMITED: "AI je právě přetížená. Zkuste to znovu za chvíli; váš materiál zůstává zachovaný.",
  AUDIO_VIDEO_NOT_SUPPORTED: "Audio a video AI zatím nečte, přilož je jako přílohu",
};

/** Known codes never escape into the UI; unknown machine codes use a safe fallback. */
export function readablePracticeMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Zdroj se nepodařilo zpracovat. Zkus to znovu nebo vlož text ručně.";
  for (const [code, message] of Object.entries(MESSAGES)) if (value.includes(code)) return message;
  if (/^[A-Z][A-Z0-9_]+$/.test(value) || /Edge Function|Failed to fetch|Load failed|non-2xx/i.test(value))
    return "Zdroj se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.";
  return value;
}

/** Logs contain only a machine code/status, never a response body, filename or transcription. */
export async function practiceErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object") {
    const record = error as { context?: unknown; message?: unknown };
    if (record.context instanceof Response) {
      try {
        const body = await record.context.clone().json();
        const code = typeof body?.error === "string" && /^[A-Z][A-Z0-9_]+$/.test(body.error) ? body.error : "SOURCE_REQUEST_FAILED";
        console.warn("[source]", { code, reason: "edge_response", status: record.context.status });
        if (MESSAGES[code]) return MESSAGES[code];
        if (record.context.status === 402) return MESSAGES.AI_PAYMENT_REQUIRED;
        if (record.context.status === 429) return readablePracticeMessage(body?.message ?? body?.error ?? MESSAGES.AI_RATE_LIMITED);
        return readablePracticeMessage(body?.message ?? body?.error);
      } catch { /* Keep the original error if the response is not JSON. */ }
    }
    if (typeof record.message === "string") {
      const code = Object.keys(MESSAGES).find((key) => String(record.message).includes(key)) ?? "SOURCE_CLIENT_FAILED";
      console.warn("[source]", { code, reason: "client_error" });
      return readablePracticeMessage(record.message);
    }
  }
  return "Nepodařilo se vygenerovat cvičení.";
}