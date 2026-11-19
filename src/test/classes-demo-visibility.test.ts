import { describe, expect, it } from "vitest";
import {
  countHiddenDemoClasses,
  filterClassesForDisplay,
  hiddenDemoClassesLabel,
} from "@/lib/class-demo-visibility";

const TYNA = "tyna-id";
const base = {
  archived: false,
  description: "",
  school: "Škola",
  field_of_study: "",
  year: 1,
  created_at: "2026-01-01T00:00:00Z",
};

const classes = [
  { ...base, id: "normal", name: "Běžná třída", is_demo_school: false, created_by: "někdo-jiný" },
  { ...base, id: "unused-demo", name: "Demo třída", school: "Demo škola Bezli", is_demo_school: true, created_by: "demo-učitel" },
  { ...base, id: "taught-demo", name: "Týnina vyučovaná", school: "Demo škola Bezli", is_demo_school: true, created_by: "demo-učitel", taught_by_current_user: true },
  { ...base, id: "owned-demo", name: "Týnina vlastní", school: "Demo škola Bezli", is_demo_school: true, created_by: TYNA },
];

const filter = (showDemoClasses = false, search = "") => filterClassesForDisplay(classes, {
  userId: TYNA,
  showArchived: false,
  showDemoClasses,
  search,
});

describe("výchozí viditelnost demo tříd", () => {
  it("skryje třídu demo školy bez vztahu k přihlášenému uživateli", () => {
    expect(filter().map((item) => item.id)).not.toContain("unused-demo");
  });

  it("ponechá třídu demo školy, kterou přihlášený uživatel učí", () => {
    expect(filter().map((item) => item.id)).toContain("taught-demo");
  });

  it("ponechá třídu demo školy vytvořenou přihlášeným uživatelem", () => {
    expect(filter().map((item) => item.id)).toContain("owned-demo");
  });

  it("přepínač zobrazí všechny dříve skryté demo třídy", () => {
    expect(filter(true).map((item) => item.id)).toEqual(["normal", "unused-demo", "taught-demo", "owned-demo"]);
  });

  it("běžnou školu neskryje", () => {
    expect(filter().map((item) => item.id)).toContain("normal");
  });

  it("počet skrytých a hledání pracují jen s viditelnými třídami", () => {
    expect(countHiddenDemoClasses(classes, TYNA, false)).toBe(1);
    expect(filter(false, "Demo třída")).toHaveLength(0);
    expect(filter(true, "Demo třída").map((item) => item.id)).toEqual(["unused-demo"]);
    expect(hiddenDemoClassesLabel(3)).toBe("3 demo třídy skryty");
  });
});
