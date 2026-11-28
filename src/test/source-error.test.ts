import { describe, expect, it, vi } from "vitest";
import { practiceErrorMessage } from "@/lib/practice-error";

describe("bezpečné chyby zdrojů", () => {
  it.each(["UNREADABLE_PHOTO", "INSUFFICIENT_TEXT", "PHOTO_TEXT_TOO_LONG"])("kód %s se nepředá žákovi", async (code) => {
    const error = { context: new Response(JSON.stringify({ error: code }), { status: 422 }) };
    const message = await practiceErrorMessage(error);
    expect(message).not.toContain(code);
    expect(message.length).toBeGreaterThan(20);
  });
  it.each([402, 429])("zachová rozlišitelnou chybu %s bez těla v logu", async (status) => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const message = await practiceErrorMessage({ context: new Response(JSON.stringify({ error: "AI_FAILED" }), { status }) });
    expect(message).not.toContain("AI_FAILED");
    expect(log).toHaveBeenCalledWith("[source]", { code: "AI_FAILED", reason: "edge_response", status });
    log.mockRestore();
  });
});