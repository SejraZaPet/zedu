import { describe, expect, it } from "vitest";
import {
  buildCurriculumBlocks,
  curriculumBlocksToText,
  legacyContentToBlocks,
  CURRICULUM_TABLE_HEADERS,
} from "@/lib/curriculum-template";
import { buildCurriculumPdfHtml } from "@/lib/curriculum-pdf-export";

describe("ŠVP blokový model", () => {
  it("šablona obsahuje všechny sekce a 3 tabulky ročníků", () => {
    const blocks = buildCurriculumBlocks();
    const headings = blocks.filter((b) => b.type === "heading").map((b) => b.props.text);
    expect(headings).toContain("Pojetí a cíl předmětu");
    expect(headings).toContain("Strategie výuky – Metody ověřování");
    expect(headings).toContain("Rozpis učiva a výsledků vzdělávání");
    expect(headings).toContain("1. ročník");

    const tables = blocks.filter((b) => b.type === "table");
    expect(tables).toHaveLength(3);
    expect(tables[0].props.headers).toEqual(CURRICULUM_TABLE_HEADERS);
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
  });

  it("starý textový obsah se převede na jeden odstavcový blok", () => {
    const blocks = legacyContentToBlocks("Starý ŠVP text");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect(legacyContentToBlocks(null)).toHaveLength(0);
  });

  it("textový souhrn zachovává pořadí a přeskočí skryté bloky", () => {
    const blocks = buildCurriculumBlocks(1);
    blocks[1].props.text = "Cílem je naučit základy.";
    blocks[3].visible = false;
    blocks[3].props.text = "Skrytý text";
    const text = curriculumBlocksToText(blocks);
    expect(text.indexOf("Pojetí a cíl předmětu")).toBeLessThan(
      text.indexOf("Cílem je naučit základy."),
    );
    expect(text).not.toContain("Skrytý text");
    expect(text).toContain("Výsledky vzdělávání | Učivo | Časové rozvržení");
  });

  it("PDF HTML obsahuje nadpisy, odstavce a tabulku ve správném pořadí", () => {
    const blocks = buildCurriculumBlocks(1);
    blocks[1].props.text = "<p>Obsah <b>sekce</b></p>";
    const table = blocks.find((b) => b.type === "table")!;
    table.props.rows[0] = ["Žák popíše…", "Úvod do předmětu", "8 h"];
    const html = buildCurriculumPdfHtml({ title: "ŠVP – ICT", subject: "ICT", blocks });

    expect(html).toContain("<h2>Pojetí a cíl předmětu</h2>");
    expect(html).toContain("Obsah sekce");
    expect(html).toContain("<th>Časové rozvržení</th>");
    expect(html).toContain("<td>Žák popíše…</td>");
    expect(html.indexOf("Pojetí a cíl předmětu")).toBeLessThan(html.indexOf("1. ročník"));
    expect(html.indexOf("1. ročník")).toBeLessThan(html.indexOf("<table>"));
  });

  it("přeuspořádání bloků se projeví v PDF i souhrnu", () => {
    const blocks = buildCurriculumBlocks(1);
    const reordered = [blocks[10], blocks[11], ...blocks.slice(0, 10), ...blocks.slice(12)];
    const html = buildCurriculumPdfHtml({ title: "T", subject: "S", blocks: reordered });
    expect(html.indexOf("Přínos ke klíčovým kompetencím")).toBeLessThan(
      html.indexOf("Pojetí a cíl předmětu"),
    );
  });
});
