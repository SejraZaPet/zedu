import { assert, assertEquals, assertRejects, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildTutorSystemPrompt,
  findTutorSnippets,
  lessonTextForTutor,
  normalizeTutorSearch,
} from "./tutor.ts";
import { searchStudentMaterialSnippets } from "./search.ts";

Deno.test("hledání bez diakritiky najde hovězí i při dotazu hovezi", () => {
  assertEquals(normalizeTutorSearch("Hovězí ŽĎÁR"), "hovezi zdar");
  const snippets = findTutorSnippets([
    { title: "Mediální výchova", kind: "Lekce", text: "Práce s médii a reklamou." },
    { title: "Hovězí maso", kind: "Lekce", text: "Hovězí maso dělíme podle částí zvířete a způsobu tepelné úpravy." },
  ], "hovezi");
  assertEquals(snippets.length, 1);
  assertEquals(snippets[0].title, "Hovězí maso");
});

Deno.test("hledání předá nejvýše pět úryvků po 800 znacích", () => {
  const snippets = findTutorSnippets(Array.from({ length: 8 }, (_, index) => ({
    title: `Maso ${index}`,
    kind: "Lekce",
    text: `maso ${"x".repeat(1000)}`,
  })), "maso");
  assertEquals(snippets.length, 5);
  assert(snippets.every((snippet) => snippet.text.length <= 800));
});

Deno.test("volný prompt neobsahuje vnucenou poslední lekci ani návrat k tématu", () => {
  const prompt = buildTutorSystemPrompt({ mode: "free", question: "Tajná poslední lekce", snippets: [] });
  assert(!prompt.includes("Tajná poslední lekce"));
  assert(!prompt.includes("vrať k tématu"));
  assertStringIncludes(prompt, "V tvých materiálech jsem to nenašla");
  assertStringIncludes(prompt, "Obecné vysvětlení (ne z tvých materiálů):");
  assertStringIncludes(prompt, "zpětnou otázku");
});

Deno.test("kontextový prompt zůstane bez přímé odpovědi a drží zadání", () => {
  const prompt = buildTutorSystemPrompt({ mode: "context", question: "Vypočítej příklad", snippets: [] });
  assertStringIncludes(prompt, "NIKDY nedáváš přímou odpověď");
  assertStringIncludes(prompt, "Vypočítej příklad");
  assertStringIncludes(prompt, "vrať k tématu");
});

Deno.test("zdrojový prompt pojmenuje lekci a skryté bloky neprohledává", () => {
  const prompt = buildTutorSystemPrompt({
    mode: "free",
    snippets: [{ title: "Hovězí maso", kind: "Lekce od učitele", text: "Druhy masa" }],
  });
  assertStringIncludes(prompt, "Hovězí maso (Lekce od učitele)");
  assertStringIncludes(prompt, "U faktů z nich uveď název zdroje");
  assert(!lessonTextForTutor([
    { visible: false, props: { text: "Skryté hovězí" } },
    { props: { text: "Viditelné hovězí" } },
  ]).includes("Skryté"));
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

Deno.test("žákovský datový scope čte jen publikované lekce a sešity s owner_id přihlášeného žáka", async () => {
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
  assertEquals(snippets.map((snippet) => snippet.title), ["Hovězí globální", "Hovězí učitel", "Můj sešit – Maso"]);
  assert(!snippets.some((snippet) => snippet.title.includes("Cizí")));
  assertEquals(calls.find((call) => call.table === "textbook_lessons")!.filters, [{ field: "status", value: "published" }]);
  assertEquals(calls.find((call) => call.table === "teacher_textbook_lessons")!.filters, [{ field: "status", value: "published" }]);
  assertEquals(calls.find((call) => call.table === "notebooks")!.filters, [{ field: "owner_id", value: "student-1" }]);
  assertEquals(calls.find((call) => call.table === "notebook_pages")!.inFilters, [{ field: "notebook_id", values: ["own"] }]);
});

Deno.test("chybu kandidátního čtení nahlásí volajícímu bez vymyšlených úryvků", async () => {
  const db = fakeDb({ textbook_lessons: [], teacher_textbook_lessons: [], notebooks: [] }, [], "textbook_lessons");
  await assertRejects(
    () => searchStudentMaterialSnippets(db, "student-1", "hovezi"),
    Error,
    "Material candidate query failed",
  );
});
