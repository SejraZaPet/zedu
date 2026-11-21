import { describe, expect, it } from "vitest";
import {
  buildTutorSystemPrompt,
  findTutorSnippets,
  lessonTextForTutor,
  normalizeTutorSearch,
} from "./tutor";
import { searchStudentMaterialSnippets } from "./search";

describe("Bezlai tutor – prompt a úryvky", () => {
  it("hledání bez diakritiky najde hovězí i při dotazu hovezi", () => {
    expect(normalizeTutorSearch("Hovězí ŽĎÁR")).toBe("hovezi zdar");
    const snippets = findTutorSnippets([
      { title: "Mediální výchova", kind: "Lekce", text: "Práce s médii a reklamou." },
      { title: "Hovězí maso", kind: "Lekce", text: "Hovězí maso dělíme podle částí zvířete a způsobu tepelné úpravy." },
    ], "hovezi");
    expect(snippets).toHaveLength(1);
    expect(snippets[0].title).toBe("Hovězí maso");
  });

  it("předá nejvýše pět úryvků po 800 znacích", () => {
    const snippets = findTutorSnippets(Array.from({ length: 8 }, (_, index) => ({
      title: `Maso ${index}`,
      kind: "Lekce",
      text: `maso ${"x".repeat(1000)}`,
    })), "maso");
    expect(snippets).toHaveLength(5);
    expect(snippets.every((snippet) => snippet.text.length <= 800)).toBe(true);
  });

  it("volný prompt neobsahuje vnucenou poslední lekci ani návrat k tématu", () => {
    const prompt = buildTutorSystemPrompt({ mode: "free", question: "Tajná poslední lekce", snippets: [] });
    expect(prompt).not.toContain("Tajná poslední lekce");
    expect(prompt).not.toContain("vrať k tématu");
    expect(prompt).toContain("V tvých materiálech jsem to nenašla");
    expect(prompt).toContain("Obecné vysvětlení (ne z tvých materiálů):");
    expect(prompt).toContain("zpětnou otázku");
  });

  it("kontextový prompt zůstane bez přímé odpovědi a drží zadání", () => {
    const prompt = buildTutorSystemPrompt({ mode: "context", question: "Vypočítej příklad", snippets: [] });
    expect(prompt).toContain("NIKDY nedáváš přímou odpověď");
    expect(prompt).toContain("Vypočítej příklad");
    expect(prompt).toContain("vrať k tématu");
  });

  it("zdrojový prompt pojmenuje lekci a skryté bloky neprohledává", () => {
    const prompt = buildTutorSystemPrompt({
      mode: "free",
      snippets: [{ title: "Hovězí maso", kind: "Lekce od učitele", text: "Druhy masa" }],
    });
    expect(prompt).toContain("Hovězí maso (Lekce od učitele)");
    expect(prompt).toContain("U faktů z nich uveď název zdroje");
    expect(lessonTextForTutor([
      { visible: false, props: { text: "Skryté hovězí" } },
      { props: { text: "Viditelné hovězí" } },
    ])).not.toContain("Skryté");
  });
});

type Row = Record<string, any>;

class FakeQuery {
  private filters: Array<{ field: string; value: unknown }> = [];
  private inFilters: Array<{ field: string; values: unknown[] }> = [];
  constructor(private table: string, private rows: Row[], private calls: Row[], private fail = false) {}
  select() { return this; }
  eq(field: string, value: unknown) { this.filters.push({ field, value }); return this; }
  in(field: string, values: unknown[]) { this.inFilters.push({ field, values }); return this; }
  order() { return this; }
  async limit() {
    this.calls.push({ table: this.table, filters: this.filters, inFilters: this.inFilters });
    if (this.fail) return { data: null, error: new Error("blocked") };
    const data = this.rows.filter((row) =>
      this.filters.every((filter) => row[filter.field] === filter.value)
      && this.inFilters.every((filter) => filter.values.includes(row[filter.field]))
    );
    return { data, error: null };
  }
}

function fakeDb(tables: Record<string, Row[]>, calls: Row[], failTable = "") {
  return { from: (table: string) => new FakeQuery(table, tables[table] ?? [], calls, table === failTable) };
}

describe("Bezlai tutor – žákovský datový scope", () => {
  it("čte jen publikované lekce a sešity s owner_id přihlášeného žáka", async () => {
    const calls: Row[] = [];
    const db = fakeDb({
      textbook_lessons: [
        { id: "g1", title: "Hovězí globální", status: "published", blocks: [{ text: "Hovězí globální text" }] },
        { id: "draft", title: "Hovězí koncept", status: "draft", blocks: [{ text: "Cizí koncept" }] },
      ],
      teacher_textbook_lessons: [
        { id: "t1", title: "Hovězí učitel", status: "published", blocks: [{ text: "Hovězí učitelský text" }] },
      ],
      notebooks: [
        { id: "own", owner_id: "student-1", title: "Můj sešit" },
        { id: "foreign", owner_id: "someone-else", title: "Cizí sešit" },
      ],
      notebook_pages: [
        { notebook_id: "own", title: "Maso", content: { textBoxes: [{ text: "Hovězí z vlastních poznámek" }] } },
        { notebook_id: "foreign", title: "Cizí", content: { textBoxes: [{ text: "Hovězí cizí poznámka" }] } },
      ],
    }, calls);
    const snippets = await searchStudentMaterialSnippets(db, "student-1", "hovezi");
    expect(snippets.map((snippet) => snippet.title)).toEqual(expect.arrayContaining(["Hovězí globální", "Hovězí učitel", "Můj sešit – Maso"]));
    expect(snippets.some((snippet) => snippet.title.includes("Cizí"))).toBe(false);
    expect(calls.find((call) => call.table === "textbook_lessons").filters).toContainEqual({ field: "status", value: "published" });
    expect(calls.find((call) => call.table === "teacher_textbook_lessons").filters).toContainEqual({ field: "status", value: "published" });
    expect(calls.find((call) => call.table === "notebooks").filters).toContainEqual({ field: "owner_id", value: "student-1" });
    expect(calls.find((call) => call.table === "notebook_pages").inFilters).toEqual([{ field: "notebook_id", values: ["own"] }]);
  });

  it("chybu kandidátního čtení nahlásí volajícímu bez vymyšlených úryvků", async () => {
    const db = fakeDb({ textbook_lessons: [], teacher_textbook_lessons: [], notebooks: [] }, [], "textbook_lessons");
    await expect(searchStudentMaterialSnippets(db, "student-1", "hovezi")).rejects.toThrow("Material candidate query failed");
  });
});
