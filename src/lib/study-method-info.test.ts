import { describe, expect, it } from "vitest";
import { methodHumanInfo, STUDY_TECHNIQUES } from "@/lib/study-method-info";

describe("Lidské názvy studijních technik", () => {
  it("zachová všechny techniky a původní názvy jako nápovědu", () => {
    for (const technique of STUDY_TECHNIQUES) {
      const info = methodHumanInfo(technique.slug);
      expect(info, technique.slug).not.toBeNull();
      expect(info!.originalName).toBe(technique.name);
      expect(info!.title.length).toBeGreaterThan(3);
      expect(info!.description.length).toBeGreaterThan(15);
    }
  });

  it("použije schválené vysvětlení bez zkratek v hlavním názvu", () => {
    expect(methodHumanInfo("pomodoro")).toMatchObject({ title: "Soustředění s pauzami", description: "25 minut soustředění, pak pauza.", originalName: "Pomodoro" });
    expect(methodHumanInfo("akrostika")).toMatchObject({ title: "Zapamatování větou", description: "Věta, která ti pomůže zapamatovat.", originalName: "Akrostika" });
    expect(methodHumanInfo("loci")).toMatchObject({ title: "Paměťový palác", description: "Pojmy rozložíš po známých místech.", originalName: "Loci" });
    expect(methodHumanInfo("sq4r")?.title).toBe("Čtení krok za krokem");
    expect(methodHumanInfo("pqrst")?.title).toBe("Čtení s otázkami");
    expect(methodHumanInfo("sq4r")?.title).not.toContain("SQ4R");
    expect(methodHumanInfo("pqrst")?.title).not.toContain("PQRST");
  });
});
