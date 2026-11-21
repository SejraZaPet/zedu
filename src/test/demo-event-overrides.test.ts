import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEMO_CREATION_DEFAULTS, resolveDemoCreationOverride, resolveStoredDemoEventOverride,
} from "../../supabase/functions/_shared/demo-event-overrides";

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
const after = new Date("2026-12-14T23:00:00.000Z");

describe("časově omezené výjimky demo události", () => {
  it("přesný aktivní štítek získá všechny schválené limity", () => {
    expect(resolveDemoCreationOverride("dalkove-ucitele", row, during)).toEqual(row);
    expect(DEMO_CREATION_DEFAULTS).toEqual({ perIpHour: 20, globalDay: 500 });
  });

  it.each([null, "other-event", "DALKOVE-UCITELE", "dalkove-ucitele-extra"])("neznámý nebo změněný štítek %s nemá výjimku", (tag) => {
    expect(resolveDemoCreationOverride(tag, row, during)).toBeNull();
    expect(resolveStoredDemoEventOverride(tag, row, during)).toBeNull();
  });

  it("před začátkem a po 14. 12. 2026 dostane nové demo běžný režim", () => {
    expect(resolveDemoCreationOverride(row.tag, row, new Date("2026-11-20T22:59:59.999Z"))).toBeNull();
    expect(resolveDemoCreationOverride(row.tag, row, new Date("2026-12-14T22:59:59.999Z"))).not.toBeNull();
    expect(resolveDemoCreationOverride(row.tag, row, after)).toBeNull();
    expect(resolveStoredDemoEventOverride(row.tag, row, after)).toBeNull();
  });

  it("demo vytvořené před koncem platnosti si drží limity i po ní", () => {
    const stored = resolveStoredDemoEventOverride(row.tag, row, during);
    expect(stored?.ai_per_account).toBe(15);
    expect(stored?.materials_max).toBe(50);
    expect(stored?.upload_max_files).toBe(50);
    expect(stored?.live_players_max).toBe(100);
    // Pro uložené demo není vstupním údajem aktuální čas; created_at zůstává během platnosti.
    expect(resolveDemoCreationOverride(row.tag, row, after)).toBeNull();
  });

  it("řádek pod jiným štítkem nebo neplatný limit nepoužije", () => {
    expect(resolveDemoCreationOverride("other-event", row, during)).toBeNull();
    expect(resolveStoredDemoEventOverride(row.tag, { ...row, ai_per_account: 0 }, during)).toBeNull();
  });

  it("SQL určí doživotní nárok z created_at a AI nepřijímá limit ani štítek od klienta", () => {
    const guard = readFileSync("supabase/functions/_shared/demo-ai-guard.ts", "utf8");
    const sql = readFileSync("supabase/proposals/demo_event_overrides.sql", "utf8");
    const storedHelper = sql.split("FUNCTION public.demo_event_override_for_user")[1]?.split("REVOKE")[0] ?? "";
    expect(storedHelper).toContain("dp.created_at >= c.active_from");
    expect(storedHelper).toContain("dp.created_at < c.active_until");
    expect(storedHelper).not.toContain("now()");
    expect(guard).toContain('{ _user_id: auth.userId, _fn: fnName }');
    expect(guard).not.toContain("event_tag");
    expect(sql).not.toContain("_event_tag");
  });
});
