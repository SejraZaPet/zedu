import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildEvaluationRepetitionPrompt,
  normalizeEvaluationSuggestions,
  sanitizeEvaluationCandidates,
  type EvaluationCandidate,
} from "./prompt.ts";

const candidates: EvaluationCandidate[] = [
  { key: "lesson:11111111-1111-4111-8111-111111111111", label: "Adresy", successPct: 42, evidenceCount: 4, attemptCount: 5, trendDelta: -8 },
  { key: "lesson:22222222-2222-4222-8222-222222222222", label: "Archivace", successPct: 55, evidenceCount: 3, attemptCount: 3, trendDelta: 2 },
  { key: "lesson:33333333-3333-4333-8333-333333333333", label: "Skartace", successPct: 61, evidenceCount: 2, attemptCount: 2, trendDelta: 12 },
  { key: "subject:id:44444444-4444-4444-8444-444444444444", label: "Úkoly bez navázané lekce", successPct: 68, evidenceCount: 1, attemptCount: 1, trendDelta: null },
];

Deno.test("prompt obsahuje jen pseudonym a čísla, nikdy extra osobní údaje", () => {
  const raw = candidates.map((candidate) => ({
    ...candidate,
    studentName: "Tajné Jméno",
    email: "tajne@example.invalid",
    className: "Tajná třída",
    answers: "Doslovná odpověď",
  }));
  const sanitized = sanitizeEvaluationCandidates(raw);
  const prompt = buildEvaluationRepetitionPrompt("Administrativa", sanitized);
  assert(prompt.includes("Žák A"));
  assert(prompt.includes("Adresy"));
  for (const forbidden of ["Tajné Jméno", "tajne@example.invalid", "Tajná třída", "Doslovná odpověď", "studentName", "answers"]) {
    assert(!prompt.includes(forbidden), forbidden);
  }
});

Deno.test("odpověď AI nemůže přidat vymyšlené téma a názvy přebírá server", () => {
  const result = normalizeEvaluationSuggestions({ suggestions: [
    { id: candidates[0].key, reason: "Slabá úspěšnost." },
    { id: "lesson:00000000-0000-4000-8000-000000000000", reason: "Vymyšlené." },
    { id: candidates[1].key, reason: "Ověřit znalosti." },
    { id: candidates[2].key, reason: "Procvičit znovu." },
  ] }, candidates);
  assertEquals(result.length, 3);
  assertEquals(result.some((item) => item.reason === "Vymyšlené."), false);
  assertEquals(result[0].title, "Adresy");
});

Deno.test("neúplnou odpověď doplní jen další dodaná témata do počtu tří", () => {
  const result = normalizeEvaluationSuggestions({ suggestions: [{ id: candidates[0].key, reason: "Opakovat." }] }, candidates);
  assertEquals(result.length, 3);
  assertEquals(new Set(result.map((item) => item.key)).size, 3);
  assert(result.every((item) => candidates.some((candidate) => candidate.key === item.key)));
});

Deno.test("návrh nikdy nepřesáhne pět témat", () => {
  const many = Array.from({ length: 8 }, (_, index) => ({ ...candidates[0], key: `lesson:${index}`, label: `Téma ${index}` }));
  const result = normalizeEvaluationSuggestions({ suggestions: many.map((candidate) => ({ id: candidate.key, reason: "Důvod" })) }, many);
  assertEquals(result.length, 5);
});

Deno.test("neplatná témata a nekonečná čísla se nepředají", () => {
  const result = sanitizeEvaluationCandidates([
    { key: "other:x", label: "Cizí", successPct: 50 },
    { key: "lesson:x", label: "Bez čísel", successPct: "NaN", evidenceCount: "Infinity" },
  ]);
  assertEquals(result.length, 1);
  assertEquals(result[0].successPct, null);
  assertEquals(result[0].evidenceCount, 0);
});
