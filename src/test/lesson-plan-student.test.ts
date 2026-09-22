import { describe, expect, it } from "vitest";
import { planSlotKey, planStartTime, studentPhasesFromInput } from "@/lib/lesson-plan-student";

describe("plán hodiny pro žáky", () => {
  it("spáruje plán s hodinou v rozvrhu podle data a začátku", () => {
    expect(planSlotKey("2026-09-22", "8:00-8:45")).toBe("2026-09-22|08:00");
    expect(planSlotKey("2026-09-22", "10:15")).toBe("2026-09-22|10:15");
  });

  it("bez termínu se plán nepáruje", () => {
    expect(planSlotKey(null, "8:00")).toBeNull();
    expect(planSlotKey("2026-09-22", null)).toBeNull();
    expect(planSlotKey("2026-09-22", "čas nesmysl")).toBeNull();
  });

  it("čas normalizuje na HH:mm", () => {
    expect(planStartTime("7:30-8:15")).toBe("07:30");
    expect(planStartTime(null)).toBeNull();
  });

  it("fáze pro žáka převede v původním pořadí a prázdné vynechá", () => {
    const phases = studentPhasesFromInput({
      reflexe: { timeMin: "5", description: "Zpětná vazba" },
      uvod: { timeMin: "", description: "" },
      hlavni: { timeMin: "20", description: "Výklad" },
    });
    expect(phases.map((p) => p.key)).toEqual(["hlavni", "reflexe"]);
    expect(phases[0]).toMatchObject({ title: "Hlavní část", timeMin: 20 });
    expect(phases[1]).toMatchObject({ title: "Reflexe", timeMin: 5 });
  });

  it("bez fází vrátí prázdný seznam", () => {
    expect(studentPhasesFromInput(null)).toEqual([]);
    expect(studentPhasesFromInput({ uvod: { timeMin: "", description: "" } })).toEqual([]);
  });
});
