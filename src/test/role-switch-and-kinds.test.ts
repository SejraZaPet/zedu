import { describe, it, expect } from "vitest";
import { roleSwitchOptions, showFooterAdminLink } from "@/lib/role-switch";
import { countByKind, kindFromParam } from "@/lib/assignment-kind";

const base = { roles: [], viewAsRole: null, canSwitchSchoolView: false, preferredView: null, role: null, isPreviewSession: false };

describe("Přepnout roli", () => {
  it("admin vidí Admin, Admin školy, Učitel a testovacího žáka; aktuální je Admin", () => {
    const o = roleSwitchOptions({ ...base, realRole: "admin", role: "admin" });
    expect(o.map((x) => x.key)).toEqual(["admin", "school_admin", "teacher", "user"]);
    expect(o.find((x) => x.current)?.key).toBe("admin");
  });
  it("admin v náhledu učitele má označeného Učitele", () => {
    const o = roleSwitchOptions({ ...base, realRole: "admin", viewAsRole: "teacher" });
    expect(o.find((x) => x.current)?.key).toBe("teacher");
  });
  it("školní admin + učitel vidí jen Učitel a Admin školy", () => {
    const o = roleSwitchOptions({ ...base, realRole: "school_admin", canSwitchSchoolView: true, preferredView: "teacher" });
    expect(o.map((x) => x.key)).toEqual(["teacher", "school_admin"]);
    expect(o.find((x) => x.current)?.key).toBe("teacher");
  });
  it("běžný učitel, žák a rodič přepínač nevidí", () => {
    for (const r of ["teacher", "user", "rodic"]) expect(roleSwitchOptions({ ...base, realRole: r, role: r })).toEqual([]);
  });
  it("relace testovacího žáka nabízí jen Zpět na admina / učitele", () => {
    const o = roleSwitchOptions({ ...base, realRole: "user", isPreviewSession: true });
    expect(o).toHaveLength(1);
    expect(o[0].mode).toBe("return");
  });
  it("Administrace v patičce jen pro admina mimo testovacího žáka", () => {
    expect(showFooterAdminLink("admin", false)).toBe(true);
    expect(showFooterAdminLink("admin", true)).toBe(false);
    expect(showFooterAdminLink("user", false)).toBe(false);
    expect(showFooterAdminLink("rodic", false)).toBe(false);
    expect(showFooterAdminLink(null, false)).toBe(false);
  });
});

describe("Úkol / Materiál / Oznámení", () => {
  it("počítá položky podle druhu; bez kind = úkol", () => {
    expect(countByKind([{ settings: null }, { settings: { kind: "material" } }, { settings: { kind: "announcement" } }, { settings: { kind: "task" } }]))
      .toEqual({ task: 2, material: 1, announcement: 1 });
  });
  it("předvyplní druh z ?kind=, neznámá hodnota = null", () => {
    expect(kindFromParam("material")).toBe("material");
    expect(kindFromParam("announcement")).toBe("announcement");
    expect(kindFromParam("hack")).toBeNull();
    expect(kindFromParam(null)).toBeNull();
  });
});
