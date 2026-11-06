import { describe, it, expect } from "vitest";
import {
  buildCaseStudyItemPatch,
  enrichPhases,
  inferWorkForm,
  suggestionToExportData,
} from "./method-suggestion";
import { resolveModelSituation, buildLessonPlanHtml } from "./lesson-plan-pdf-export";

const ms = { scenario: "Restaurace dostala hovězí zadní čtvrt.", task: "Navrhněte dělení a využití partií." };

describe("method-suggestion", () => {
  it("případová studie obsahuje doslovné zadání i úkol", () => {
    const p = buildCaseStudyItemPatch(ms)!;
    expect(p.type).toBe("instruction_box");
    expect(p.prompt).toContain(ms.scenario);
    expect(p.prompt).toContain(`Úkol: ${ms.task}`);
    expect(buildCaseStudyItemPatch({ scenario: " ", task: "" })).toBeNull();
  });

  it("odvodí formu práce z textu fáze", () => {
    expect(inferWorkForm("Žáci pracují ve dvojicích na zadání")).toBe("práce ve dvojicích");
    expect(inferWorkForm("Práce ve skupinách po 4")).toBe("skupinová práce");
    expect(inferWorkForm("Každý samostatně vyplní")).toBe("individuální práce");
    expect(inferWorkForm("Učitel ukáže video")).toBe("");
  });

  it("hlavní část dostane cíl s odkazem na zadání, ruční hodnoty se nepřepíší", () => {
    const out = enrichPhases(
      {
        main: { timeMin: "20", description: "Žáci pracují ve dvojicích na zadání případové studie" },
        intro: { timeMin: "5", description: "Pozdrav", goal: "Vlastní cíl" },
      } as Record<string, any>,
      ms,
    );
    expect(out.main.goal).toMatch(/případové studie/);
    expect(out.main.workForm).toBe("práce ve dvojicích");
    expect(out.intro.goal).toBe("Vlastní cíl");
    expect(enrichPhases({ main: { description: "x" } } as Record<string, any>, null).main.goal).toBeUndefined();
  });

  it("detailní tisk z návrhu obsahuje situaci, úkol, instrukce a vyplněná pole fází", () => {
    const data = suggestionToExportData({
      title: "Hovězí maso",
      modelSituation: ms,
      teacherInstructions: "Hlídejte hygienu.",
      methodRationale: "• Případová studie: praxe",
      phaseLabels: { main: "Hlavní část" },
      phases: { main: { timeMin: "20", description: "Ve dvojicích řeší zadání", activities: [{ kind: "worksheet", title: "List A" }] } },
    });
    const html = buildLessonPlanHtml("detailed", data);
    expect(html).toContain("Modelová situace");
    expect(html).toContain(ms.task);
    expect(html).toContain("Instrukce pro učitele");
    expect(html).toContain("Proč tyto metody sedí");
    expect(html).toContain("práce ve dvojicích");
    expect(html).toContain("Pracovní list:");
  });

  it("starý plán bez strukturovaných dat použije zadání pro žáky", () => {
    expect(resolveModelSituation({ studentDescription: "Situace A\n\nÚkol: Udělej B" })).toEqual({
      scenario: "Situace A",
      task: "Udělej B",
    });
    expect(resolveModelSituation({})).toBeNull();
  });
});
