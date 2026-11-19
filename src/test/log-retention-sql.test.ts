import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/proposals/log_retention_cleanup.sql", "utf8");
const body = sql.split("CREATE OR REPLACE FUNCTION public.run_log_retention()")[1].split("$$;")[0];
const code = body.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("run_log_retention (návrh SQL)", () => {
  it("mění jen website_chat_logs a email_log", () => {
    const targets = [...code.matchAll(/\b(DELETE FROM|UPDATE|INSERT INTO|TRUNCATE)\s+public\.(\w+)/g)].map((m) => m[2]);
    expect(new Set(targets)).toEqual(new Set(["website_chat_logs", "email_log"]));
    expect(code).not.toMatch(/TRUNCATE|DROP|EXECUTE\s/i);
  });
  it("nikdy nemaže ani nečistí mladší než 90 dnů", () => {
    expect(code).toMatch(/greatest\(c\.website_chat_days, 90\)/);
    expect(code).toMatch(/greatest\(c\.email_content_days, 90\)/);
    expect(code).toMatch(/greatest\(c\.email_row_days, 365\)/);
    expect(sql).toMatch(/website_chat_days integer NOT NULL DEFAULT 90 CHECK \(website_chat_days >= 90\)/);
    expect(sql).toMatch(/email_row_days integer NOT NULL DEFAULT 365 CHECK \(email_row_days >= 365\)/);
  });
  it("po vyčištění e-mailu zůstává typ, stav, čas a příjemce", () => {
    const set = code.match(/SET (subject[^\n]+)\n/)![1];
    for (const kept of ["email_type", "status", "created_at", "recipient"]) expect(set).not.toContain(kept);
    for (const cleared of ["subject", "html", "body_text"]) expect(set).toContain(cleared);
  });
  it("je SECURITY DEFINER s pevným search_path a jen pro service_role", () => {
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = public, pg_temp/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.run_log_retention\(\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.run_log_retention\(\) TO service_role/);
  });
});
