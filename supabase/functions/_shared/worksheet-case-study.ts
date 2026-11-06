/** Případová studie (modelová situace + úkol) z návrhu podle metody. */
export interface CaseStudy {
  scenario: string;
  task: string;
}

const MAX = 4000;

export function parseCaseStudy(raw: unknown): CaseStudy | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const scenario = typeof r.scenario === "string" ? r.scenario.trim().slice(0, MAX) : "";
  const task = typeof r.task === "string" ? r.task.trim().slice(0, MAX) : "";
  if (!scenario && !task) return null;
  return { scenario, task };
}

/** Blok do uživatelského promptu: otázky musí navazovat na zadání, text se neopisuje. */
export function caseStudyPromptBlock(cs: CaseStudy | null): string {
  if (!cs) return "";
  return `Pozor: na začátek listu se automaticky vloží blok „Případová studie“ s tímto zadáním (NEopisuj ho, negeneruj ho znovu):
${cs.scenario ? `Modelová situace: ${cs.scenario}\n` : ""}${cs.task ? `Úkol pro žáky: ${cs.task}\n` : ""}Úlohy pracovního listu MUSÍ navazovat na tuto případovou studii: aspoň polovina úloh se přímo ptá na situaci a úkol (rozbor případu, rozhodnutí, zdůvodnění, postup řešení), ostatní procvičují znalosti potřebné k jeho vyřešení. Nevytvářej obecné otázky bez vazby na zadání.

`;
}
