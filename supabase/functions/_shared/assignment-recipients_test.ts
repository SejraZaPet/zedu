import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { filterToRecipients } from "./assignment-recipients.ts";

Deno.test("bez výběru zůstává celá třída", () => {
  assertEquals(filterToRecipients(["a", "b"], null), ["a", "b"]);
});
Deno.test("s výběrem jen vybraní", () => {
  assertEquals(filterToRecipients(["a", "b", "c"], ["c"]), ["c"]);
});
