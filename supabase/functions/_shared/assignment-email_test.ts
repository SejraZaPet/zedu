import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildAssignmentEmail, formatPragueDate, shortText, shouldEmail } from "./assignment-email.ts";

Deno.test("datum v pražském čase ve tvaru čtvrtek 12. 11. 2026, 23:59", () => {
  assertEquals(formatPragueDate("2026-11-12T22:59:00Z"), "čtvrtek 12. 11. 2026, 23:59");
});

Deno.test("popis se zkrátí na 300 znaků a zbaví HTML", () => {
  const t = shortText(`<p>${"a".repeat(400)}</p>`);
  assertEquals(t.length, 300);
  assert(!t.includes("<"));
});

Deno.test("úkol: termín, pozdní odevzdání, tlačítko", () => {
  const e = buildAssignmentEmail({
    title: "Zlomky", subject: "Matematika", teacher: "Jana Nová", target: "7.B",
    deadline: "2026-11-12T22:59:00Z", settings: { lateUntil: "2026-11-15T22:59:00Z" }, url: "x",
  });
  assertEquals(e.subject, "Nový úkol: Zlomky (Matematika)");
  assertEquals(e.button, "Otevřít úkol");
  assert(e.lines.includes("Termín odevzdání: čtvrtek 12. 11. 2026, 23:59"));
  assert(e.lines.includes("Odevzdat můžeš i po termínu, nejpozději do neděle 15. 11. 2026, 23:59."));
});

Deno.test("materiál a oznámení mají vlastní texty", () => {
  assertEquals(buildAssignmentEmail({ title: "A", settings: { kind: "material" }, url: "x" }).button, "Otevřít materiál");
  assertEquals(buildAssignmentEmail({ title: "A", teacher: "T", settings: { kind: "announcement" }, url: "x" }).subject, "Oznámení od T: A");
});

Deno.test("materiál se posílá jen při notifyEmail=true", () => {
  assertEquals(shouldEmail({ kind: "material" }), false);
  assertEquals(shouldEmail({ kind: "material", notifyEmail: true }), true);
  assertEquals(shouldEmail({}), true);
  assertEquals(shouldEmail({ notifyEmail: false }), false);
  assertEquals(shouldEmail({ kind: "announcement" }), true);
});
