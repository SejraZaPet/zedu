import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Název místa „Studio“ (dřív „Moje aktivity“) hlídaný ze zdrojových souborů.
 * Cesta /aktivity zůstává beze změny – test ji proto jen potvrzuje, nemění.
 */
const SRC = resolve(__dirname, "..");

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const dashboard = read("pages/TeacherDashboard.tsx");
const header = read("components/SiteHeader.tsx");
const activitiesPage = read("pages/ActivitiesPage.tsx");
const app = read("App.tsx");

/** Blok dlaždice `activities` v učitelském panelu. */
const activitiesTile = dashboard.slice(
  dashboard.indexOf("    activities: {"),
  dashboard.indexOf("    assignments: {"),
);

/** Všechny zdrojové soubory v src (bez testů, které název zmiňují jako historii). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "test") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("název místa Studio (dřív Moje aktivity)", () => {
  it("dlaždice v učitelském panelu se jmenuje Studio s popisem „Aktivity a hry:“", () => {
    expect(activitiesTile).toContain('title: "Studio"');
    expect(activitiesTile).toContain('description: "Aktivity a hry:');
    expect(activitiesTile).toContain('to: "/aktivity"');
    expect(activitiesTile).not.toContain("Moje aktivity");
  });

  it("horní lišta i mobilní menu mají položku Studio s podtitulkem aktivity a hry", () => {
    expect(header).toContain('label: "Studio", href: "/aktivity"');
    expect(header).toContain('subtitle: "aktivity a hry"');
    expect(header).not.toContain('label: "Aktivity"');
  });

  it("nadpis stránky /aktivity je Studio s podtitulkem aktivity a hry", () => {
    expect(activitiesPage).toMatch(/<h1[^>]*>\s*Studio\s*<\/h1>/);
    expect(activitiesPage).toContain("aktivity a hry");
  });

  it("nikde v kódu appky už nezůstal starý název Moje aktivity", () => {
    const stale = sourceFiles(SRC).filter((f) => readFileSync(f, "utf8").includes("Moje aktivity"));
    expect(stale).toEqual([]);
  });

  it("cesta /aktivity zůstává beze změny", () => {
    expect(app).toContain('path="/aktivity"');
  });
});
