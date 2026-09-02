import { describe, it, expect } from "vitest";
import { splitFullName, parseClassCode, summarizeClasses } from "@/lib/import-users";

describe("splitFullName", () => {
  it("dělí podle posledního mezerníku", () => {
    expect(splitFullName("Balogová Natálie")).toEqual({ prijmeni: "Balogová", jmeno: "Natálie" });
    expect(splitFullName("Dobreva Dora")).toEqual({ prijmeni: "Dobreva", jmeno: "Dora" });
    expect(splitFullName("Novák Dvořák Jan")).toEqual({ prijmeni: "Novák Dvořák", jmeno: "Jan" });
  });
  it("označí jedno slovo k ruční kontrole", () => {
    const r = splitFullName("Novák");
    expect(r.prijmeni).toBe("Novák");
    expect(r.jmeno).toBe("");
    expect(r.problem).toBeTruthy();
  });
});

describe("parseClassCode", () => {
  it("odvodí ročník ze zkratky", () => {
    expect(parseClassCode("Č1.A")).toEqual({ rocnik: 1, obor_zkratka: "Č", skupina: "A" });
    expect(parseClassCode("H4.A").rocnik).toBe(4);
    expect(parseClassCode("P1.B")).toEqual({ rocnik: 1, obor_zkratka: "P", skupina: "B" });
  });
  it("vrátí null u neznámého formátu", () => {
    expect(parseClassCode("prima").rocnik).toBeNull();
  });
});

describe("summarizeClasses", () => {
  it("spočítá žáky na třídu", () => {
    const s = summarizeClasses([{ trida: "Č1.A" }, { trida: "Č1.A" }, { trida: "H4.A" }]);
    expect(s).toHaveLength(2);
    expect(s.find((c) => c.trida === "Č1.A")).toMatchObject({ rocnik: 1, count: 2 });
  });
});
