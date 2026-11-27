import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { academyModuleText } from "./academy-module-text.ts";

Deno.test("převede cíl, kroky snímku a tip", () => {
  const t = academyModuleText([
    { type: "callout", props: { variant: "goal", text: "Zadat rozvrh." } },
    { type: "image", props: { caption: "Rozvrh", callouts: [{ n: 1, text: "Tisk" }] } },
    { type: "callout", visible: false, props: { variant: "tip", text: "skryté" } },
  ]);
  assertEquals(t, "Cíl: Zadat rozvrh.\nSnímek: Rozvrh\nKrok 1: Tisk");
});
