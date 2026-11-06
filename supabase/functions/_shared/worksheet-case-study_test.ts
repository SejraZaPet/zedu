import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCaseStudy, caseStudyPromptBlock } from "./worksheet-case-study.ts";

Deno.test("parseCaseStudy: prázdné a neplatné vstupy", () => {
  assertEquals(parseCaseStudy(null), null);
  assertEquals(parseCaseStudy({ scenario: "  ", task: "" }), null);
  assertEquals(parseCaseStudy("x"), null);
});

Deno.test("caseStudyPromptBlock obsahuje doslovné zadání a úkol", () => {
  const cs = parseCaseStudy({ scenario: "Restaurace dostala hovězí zadní.", task: "Navrhněte dělení." })!;
  const block = caseStudyPromptBlock(cs);
  assert(block.includes("Restaurace dostala hovězí zadní."));
  assert(block.includes("Úkol pro žáky: Navrhněte dělení."));
  assertEquals(caseStudyPromptBlock(null), "");
});
