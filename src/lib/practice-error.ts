/** Edge invocation errors carry the useful message in their response body. */
export async function practiceErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object") {
    const record = error as { context?: unknown; message?: unknown };
    if (record.context instanceof Response) {
      try {
        const body = await record.context.clone().json();
        if (typeof body?.error === "string") return body.error;
      } catch { /* Keep the original error if the response is not JSON. */ }
    }
    if (typeof record.message === "string") return record.message;
  }
  return "Nepodařilo se vygenerovat cvičení.";
}