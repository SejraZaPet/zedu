import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { excludePreviewIds, isPreviewEmail } from "./preview-students.ts";

Deno.test("blocks @preview.invalid addresses", () => {
  assertEquals(isPreviewEmail("preview-abc@preview.invalid"), true);
  assertEquals(isPreviewEmail(" X@PREVIEW.INVALID "), true);
  assertEquals(isPreviewEmail("zak@skola.cz"), false);
});

Deno.test("excludes preview students except for their owner", () => {
  const preview = new Map([["p1", "owner"]]);
  const rows = [{ id: "a" }, { id: "p1" }, { id: null }];
  assertEquals(excludePreviewIds(rows, (r) => r.id, preview).map((r) => r.id), ["a", null]);
  assertEquals(excludePreviewIds(rows, (r) => r.id, preview, "owner").length, 3);
  assertEquals(excludePreviewIds(rows, (r) => r.id, preview, "other").length, 2);
});
