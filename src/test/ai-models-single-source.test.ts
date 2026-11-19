import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "supabase/functions";
const ALLOWED = join(ROOT, "_shared", "ai-models.ts");
const MODEL_LITERAL = /["'`](google|openai|anthropic)\/[a-z0-9.\-]+["'`]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|js)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

describe("AI modely jen ze sdílené konstanty", () => {
  it("žádná serverová funkce nemá model natvrdo", () => {
    const offenders = files(ROOT).filter((f) => f !== ALLOWED && MODEL_LITERAL.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("sdílený soubor definuje rychlý a kvalitní model", () => {
    const s = readFileSync(ALLOWED, "utf8");
    expect(s).toMatch(/export const AI_MODEL_FAST = "google\/gemini-3\.1-flash-lite"/);
    expect(s).toMatch(/export const AI_MODEL_QUALITY = "google\/gemini-3\.8-flash"/);
  });
});
