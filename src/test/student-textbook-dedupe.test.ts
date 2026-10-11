import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { globalTextbooksCoveredByTeacher, type StudentTextbookLink } from "@/lib/student-class-textbooks";

const L = (p: Partial<StudentTextbookLink>): StudentTextbookLink => ({
  textbook_id: "x", textbook_type: "teacher", class_id: "c1", subject_id: null, source: "class_subject", ...p,
});

describe("jedna učebnice na předmět u žáka", () => {
  it("1) přiřazená učitelská učebnice skryje globální stejného předmětu", () => {
    const links = [L({ textbook_id: "t1", subject_id: "mv" }), L({ textbook_id: "g1", textbook_type: "global", subject_id: "mv" })];
    expect(globalTextbooksCoveredByTeacher(links, new Map([["t1", "mv"]]))).toEqual(new Set(["g1"]));
  });

  it("1) skupina: subject_group_textbooks pokryje globální", () => {
    const links = [
      L({ textbook_id: "t2", source: "group", class_id: null, subject_id: "sg" }),
      L({ textbook_id: "g2", textbook_type: "global", source: "group", class_id: null, subject_id: "sg" }),
    ];
    expect(globalTextbooksCoveredByTeacher(links, new Map([["t2", null]])).has("g2")).toBe(true);
  });

  it("1) bez oprávnění k učitelské učebnici se globální neskryje", () => {
    const links = [L({ textbook_id: "t1", subject_id: "mv" }), L({ textbook_id: "g1", textbook_type: "global", subject_id: "mv" })];
    expect(globalTextbooksCoveredByTeacher(links, new Map()).size).toBe(0);
  });

  it("2) předmět bez učitelské učebnice ukáže globální", () => {
    const links = [L({ textbook_id: "t1", subject_id: "mv" }), L({ textbook_id: "g9", textbook_type: "global", subject_id: "jiny" })];
    expect(globalTextbooksCoveredByTeacher(links, new Map([["t1", "mv"]])).size).toBe(0);
  });

  it("3) umístění lekce nebo zápis kódem globální neskrývá", () => {
    const links = [
      L({ textbook_id: "t1", source: "placement", subject_id: "mv" }),
      L({ textbook_id: "g1", textbook_type: "global", subject_id: "mv" }),
    ];
    expect(globalTextbooksCoveredByTeacher(links, new Map([["t1", "mv"]])).size).toBe(0);
  });

  it("4) nespárovatelný předmět (bez subject_id) nic neskryje", () => {
    const links = [
      L({ textbook_id: "t1", source: "class", subject_id: null }),
      L({ textbook_id: "g1", textbook_type: "global", source: "class", subject_id: null }),
    ];
    expect(globalTextbooksCoveredByTeacher(links, new Map([["t1", "mv"]])).size).toBe(0);
    // stejná globální je i u jiného, nepokrytého kurzu → zůstane
    const mixed = [L({ textbook_id: "t1", subject_id: "mv" }), L({ textbook_id: "g1", textbook_type: "global", subject_id: "mv" }), L({ textbook_id: "g1", textbook_type: "global", subject_id: null })];
    expect(globalTextbooksCoveredByTeacher(mixed, new Map([["t1", "mv"]])).size).toBe(0);
  });

  it("5) víc učitelských učebnic: všechny zůstanou, globální se skryje", () => {
    const links = [
      L({ textbook_id: "t1", subject_id: "mv" }),
      L({ textbook_id: "t2", subject_id: "mv", source: "schedule" }),
      L({ textbook_id: "g1", textbook_type: "global", subject_id: "mv" }),
    ];
    const hidden = globalTextbooksCoveredByTeacher(links, new Map([["t1", "mv"], ["t2", "mv"]]));
    expect(hidden).toEqual(new Set(["g1"]));
    expect(hidden.has("t1") || hidden.has("t2")).toBe(false);
  });
});
