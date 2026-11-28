import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyMaterial, isUuid, loadMaterialFiles, parseMaterialRefs, selectMaterialFiles } from "./assignment-context.ts";
import { assignmentContextSnippets, buildTutorSystemPrompt, MAX_TUTOR_SNIPPET_CHARS } from "../ask-zedai-tutor/tutor.ts";

Deno.test("materiály: jen bezpečné cesty a odkazy", () => {
  const refs = parseMaterialRefs([
    { kind: "file", title: "a.pdf", path: "t/a.pdf" },
    { kind: "file", title: "x", path: "../etc" },
    { kind: "file", title: "y", path: "https://evil" },
    { kind: "link", title: "web", url: "https://example.org" },
    { kind: "library", title: "z" },
  ]);
  assertEquals(refs.map((r) => r.title), ["a.pdf", "web"]);
});

Deno.test("tutor bere nejvýše 2 textové soubory, obrázky ani video ne", () => {
  const refs = parseMaterialRefs([
    { kind: "file", title: "foto.jpg", path: "t/foto.jpg" },
    { kind: "file", title: "video.mp4", path: "t/v.mp4" },
    { kind: "file", title: "1.pdf", path: "t/1.pdf" },
    { kind: "file", title: "2.txt", path: "t/2.txt" },
    { kind: "file", title: "3.docx", path: "t/3.docx" },
  ]);
  assertEquals(selectMaterialFiles(refs, 2, true).map((r) => r.title), ["1.pdf", "2.txt"]);
  assertEquals(selectMaterialFiles(refs, 5, false).map((r) => r.title), ["foto.jpg", "1.pdf", "2.txt", "3.docx"]);
  assertEquals(classifyMaterial("v.mp4").kind, "unsupported");
});

Deno.test("isUuid", () => {
  assert(isUuid("11111111-1111-4111-8111-111111111111"));
  assert(!isUuid("x"));
});

Deno.test("audio/video se ani nestáhne a MIME má přednost před PDF", async () => {
  let downloads = 0;
  const db = { from: () => null, storage: { from: () => ({ download: async () => { downloads++; return { data: null, error: null }; } }) } };
  const refs = ["mp3", "mp4", "m4a", "wav", "mov", "webm"].map((ext) => ({ title: "[TEST]", kind: "file" as const, path: `owner/[TEST].${ext}` }));
  assertEquals(selectMaterialFiles(refs, 5, false), []);
  const loaded = await loadMaterialFiles(db, refs, { pdfAs: "file", textOnly: false });
  assertEquals(downloads, 0);
  assertEquals(loaded.materials, []);
  assertEquals(classifyMaterial("[TEST].pdf", "audio/mpeg").kind, "unsupported");
});

Deno.test("úryvky úkolu: max 5×800, záložně začátek dokumentu", () => {
  const docs = Array.from({ length: 7 }, (_, i) => ({ title: `L${i}`, kind: "Lekce k úkolu", text: "slovo ".repeat(400) }));
  const fallback = assignmentContextSnippets(docs, "nic");
  assertEquals(fallback.length, 5);
  assert(fallback.every((s) => s.text.length <= MAX_TUTOR_SNIPPET_CHARS));
  const hit = assignmentContextSnippets([{ title: "Archivace", kind: "Lekce k úkolu", text: "Skartace dokumentů" }, { title: "Jiné", kind: "x", text: "nic" }], "skartace");
  assertEquals(hit.map((s) => s.title), ["Archivace"]);
});

Deno.test("kontextový prompt s podklady zůstává sokratovský a nevymýšlí zdroje", () => {
  const prompt = buildTutorSystemPrompt({ mode: "context", question: "Úkol", snippets: [{ title: "Lekce 6", kind: "Lekce k úkolu", text: "Text" }] });
  assert(prompt.includes("NIKDY nedáváš přímou odpověď"));
  assert(prompt.includes("ani z nich nikdy neprozrazuj hotovou odpověď"));
  assert(prompt.includes("ZDROJ 1: Lekce 6"));
  assert(prompt.includes("Nevymýšlej názvy učebnic"));
  const plain = buildTutorSystemPrompt({ mode: "context", question: "Úkol" });
  assert(!plain.includes("PODKLADY K ÚKOLU"));
});
