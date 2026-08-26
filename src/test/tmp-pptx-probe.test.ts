import { it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePptxFileToSlides } from "@/lib/pptx-import";
it("probe", async () => {
  const b = readFileSync("/tmp/pptx-fixture/test-3-slides.pptx");
  const f = new File([new Uint8Array(b)], "a.pptx");
  try { console.log(JSON.stringify(await parsePptxFileToSlides(f, "nature"), null, 1)); }
  catch (e) { console.log("ERR", e); }
});
