import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEMO_CREATION_DEFAULTS, resolveDemoEventOverride } from "../../supabase/functions/_shared/demo-event-overrides";

const row = {
  tag: "dalkove-ucitele",
  active_from: "2026-11-20T23:00:00.000Z",
  active_until: "2026-12-14T23:00:00.000Z",
  create_per_ip_hour: 150,
  create_global_day: 1000,
  ai_per_account: 15,
  ai_daily_global: 1000,
  materials_max: 50,
  live_players_max: 100,
  upload_max_files: 50,
  upload_max_bytes: 5 * 1024 * 1024,
};
const during = new Date("2026-11-28T12:00:00.000Z");

describe("časově omezené výjimky demo události", () => {
  it("přesný aktivní štítek získá všechny schválené limity", () => {
    expect(resolveDemoEventOverride("dalkove-ucitele", row, during)).toEqual(row);
    expect(DEMO_CREATION_DEFAULTS).toEqual({ perIpHour: 20, globalDay: 500 });
  });

  it.each([null, "other-event", "DALKOVE-UCITELE", "dalkove-ucitele-extra"])("neznámý nebo změněný štítek %s nemá výjimku", (tag) => {
    expect(resolveDemoEventOverride(tag, row, during)).toBeNull();
  });

  it("před začátkem a po 14. 12. 2026 se použije běžný režim", () => {
    expect(resolveDemoEventOverride(row.tag, row, new Date("2026-11-20T22:59:59.999Z"))).toBeNull();
    expect(resolveDemoEventOverride(row.tag, row, new Date("2026-12-14T22:59:59.999Z"))).not.toBeNull();
    expect(resolveDemoEventOverride(row.tag, row, new Date("2026-12-14T23:00:00.000Z"))).toBeNull();
  });

  it("řádek pod jiným štítkem nebo neplatný limit nepoužije", () => {
    expect(resolveDemoEventOverride("other-event", row, during)).toBeNull();
    expect(resolveDemoEventOverride(row.tag, { ...row, ai_per_account: 0 }, during)).toBeNull();
  });

  it("AI rezervace nemá vstup pro limit ani štítek od klienta a SQL čte uložený event_tag", () => {
    const guard = readFileSync("supabase/functions/_shared/demo-ai-guard.ts", "utf8");
    const sql = readFileSync("supabase/proposals/demo_event_overrides.sql", "utf8");
    expect(guard).toContain('{ _user_id: auth.userId, _fn: fnName }');
    expect(guard).not.toContain("event_tag");
    expect(sql).toContain("dp.event_tag");
    expect(sql).not.toContain("_event_tag");
  });
});
