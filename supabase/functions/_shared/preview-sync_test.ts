import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { membershipDiff } from "./preview-sync.ts";

Deno.test("adds missing owner classes and removes foreign ones", () => {
  assertEquals(membershipDiff(["a", "b"], ["b", "x"]), { add: ["a"], remove: ["x"] });
});

Deno.test("no change when already in sync", () => {
  assertEquals(membershipDiff(["a"], ["a"]), { add: [], remove: [] });
});
