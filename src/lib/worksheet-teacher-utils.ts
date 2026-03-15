/**
 * Worksheet Teacher Utilities — answer key separation, QA client, strip helpers.
 *
 * These utilities ensure answer keys NEVER leak into student-facing exports.
 */

import type {
  WorksheetSpec,
  WorksheetItem,
  AnswerKeyEntry,
  WorksheetVariant,
} from "./worksheet-spec";
import { supabase } from "@/integrations/supabase/client";

// ────────────────── Types ──────────────────

export interface TeacherAnswerKey {
  itemId: string;
  itemNumber: number;
  correctAnswer: string;
  explanation: string;
  partialCredit?: string;
  points: number;
}

export interface QaIssue {
  severity: "low" | "med" | "high";
  itemId: string;
  category: "ambiguity" | "grammar" | "missing_answer" | "duplicate" | "difficulty_balance" | "factual_error" | "other";
  message: string;
  suggestion: string;
}

export interface QaReport {
  overallQuality: "excellent" | "good" | "needs_review";
  issues: QaIssue[];
  summary: string;
}

export interface WorksheetQaResult {
  answerKey: TeacherAnswerKey[];
  teacherNotes: string[];
  qaReport: QaReport;
}

// ────────────────── Answer Key Stripping ──────────────────

/**
 * Strip ALL answer keys and teacher-only data from a WorksheetSpec.
 * Returns a safe copy for student distribution.
 */
export function stripForStudent(spec: WorksheetSpec): WorksheetSpec {
  return {
    ...spec,
    answerKeys: {}, // completely removed
    renderConfig: {
      ...spec.renderConfig,
      includeAnswerKey: false,
    },
    // Strip hints if they contain answer clues (configurable)
    variants: spec.variants.map((v) => ({
      ...v,
      items: v.items.map((it) => ({
        ...it,
        hints: [], // remove hints from student version
      })),
    })),
  };
}

/**
 * Extract teacher-only answer key from a WorksheetSpec for a specific variant.
 */
export function extractAnswerKey(spec: WorksheetSpec, variantId: string): AnswerKeyEntry[] {
  return spec.answerKeys[variantId] ?? [];
}

/**
 * Check if a WorksheetSpec has been properly stripped (no answer keys).
 */
export function isStripped(spec: WorksheetSpec): boolean {
  return Object.keys(spec.answerKeys).length === 0;
}

// ────────────────── Client-side QA (fast, no AI) ──────────────────

/**
 * Run basic local QA checks — fast, no network required.
 * Catches obvious issues before sending to AI for deeper review.
 */
export function runLocalQa(spec: WorksheetSpec): QaIssue[] {
  const issues: QaIssue[] = [];

  for (const variant of spec.variants) {
    const { items } = variant;
    const vid = variant.variantId;
    const keys = spec.answerKeys[vid] ?? [];
    const keyMap = new Map(keys.map((k) => [k.itemId, k]));

    for (const item of items) {
      // Missing answer key
      if (!keyMap.has(item.id)) {
        issues.push({
          severity: "high",
          itemId: item.id,
          category: "missing_answer",
          message: `Úloha ${item.itemNumber} (${vid}) nemá klíč odpovědí.`,
          suggestion: "Doplňte správnou odpověď do answerKeys.",
        });
      }

      // Empty prompt
      if (!item.prompt || item.prompt.trim().length < 5) {
        issues.push({
          severity: "high",
          itemId: item.id,
          category: "ambiguity",
          message: `Úloha ${item.itemNumber} má příliš krátké zadání.`,
          suggestion: "Rozšiřte zadání na alespoň jednu celou větu.",
        });
      }

      // MCQ with wrong number of choices
      if (item.type === "mcq" && (!item.choices || item.choices.length < 2)) {
        issues.push({
          severity: "high",
          itemId: item.id,
          category: "ambiguity",
          message: `MCQ úloha ${item.itemNumber} má méně než 2 možnosti.`,
          suggestion: "Přidejte alespoň 4 možnosti.",
        });
      }

      // Matching with < 2 pairs
      if (item.type === "matching" && (!item.matchPairs || item.matchPairs.length < 2)) {
        issues.push({
          severity: "med",
          itemId: item.id,
          category: "ambiguity",
          message: `Spojování ${item.itemNumber} má méně než 2 páry.`,
          suggestion: "Přidejte alespoň 3 páry.",
        });
      }

      // Fill blank without placeholders
      if (item.type === "fill_blank" && item.blankText && !item.blankText.includes("___")) {
        issues.push({
          severity: "high",
          itemId: item.id,
          category: "missing_answer",
          message: `Doplňovačka ${item.itemNumber} nemá ___ placeholder.`,
          suggestion: "Přidejte ___ na místo, kde má student doplnit odpověď.",
        });
      }

      // Zero points
      if (item.points <= 0) {
        issues.push({
          severity: "low",
          itemId: item.id,
          category: "other",
          message: `Úloha ${item.itemNumber} má 0 bodů.`,
          suggestion: "Nastavte kladné bodování.",
        });
      }
    }

    // Difficulty balance check
    const diffCounts = { easy: 0, medium: 0, hard: 0 };
    items.forEach((it) => { diffCounts[it.difficulty] = (diffCounts[it.difficulty] || 0) + 1; });
    if (diffCounts.hard > items.length * 0.5) {
      issues.push({
        severity: "med",
        itemId: "general",
        category: "difficulty_balance",
        message: `Varianta ${vid}: více než 50 % úloh je „hard".`,
        suggestion: "Přidejte více easy/medium úloh pro vyváženější rozložení.",
      });
    }
    if (diffCounts.easy === items.length) {
      issues.push({
        severity: "low",
        itemId: "general",
        category: "difficulty_balance",
        message: `Varianta ${vid}: všechny úlohy jsou „easy".`,
        suggestion: "Přidejte alespoň 1–2 medium/hard úlohy.",
      });
    }

    // Duplicate prompts
    const prompts = items.map((it) => it.prompt.trim().toLowerCase());
    const seen = new Set<string>();
    prompts.forEach((p, i) => {
      if (seen.has(p)) {
        issues.push({
          severity: "med",
          itemId: items[i].id,
          category: "duplicate",
          message: `Úloha ${items[i].itemNumber} má duplicitní zadání.`,
          suggestion: "Přeformulujte nebo odstraňte duplikát.",
        });
      }
      seen.add(p);
    });
  }

  return issues;
}

// ────────────────── AI-powered QA (edge function) ──────────────────

/**
 * Call the generate-worksheet-qa edge function for deep AI review.
 * Returns teacher notes, enriched answer key, and QA report.
 */
export async function generateWorksheetQa(
  items: WorksheetItem[],
  answerKey: AnswerKeyEntry[],
  metadata?: Record<string, any>,
  includeTeacherNotes = true,
): Promise<WorksheetQaResult> {
  const { data, error } = await supabase.functions.invoke("generate-worksheet-qa", {
    body: { items, answerKey, metadata, includeTeacherNotes },
  });

  if (error) throw new Error(error.message ?? "QA generation failed");

  return data as WorksheetQaResult;
}

// ────────────────── Combined Pipeline ──────────────────

/**
 * Full teacher pipeline: local QA → AI QA → merged report.
 */
export async function runFullQaPipeline(
  spec: WorksheetSpec,
  variantId: string,
  includeTeacherNotes = true,
): Promise<WorksheetQaResult & { localIssues: QaIssue[] }> {
  const variant = spec.variants.find((v) => v.variantId === variantId);
  if (!variant) throw new Error(`Variant "${variantId}" not found`);

  // Step 1: Fast local checks
  const localIssues = runLocalQa(spec);

  // Step 2: AI deep review
  const aiResult = await generateWorksheetQa(
    variant.items,
    spec.answerKeys[variantId] ?? [],
    spec.metadata as any,
    includeTeacherNotes,
  );

  // Merge local issues into AI report (deduplicate by itemId+category)
  const aiIssueKeys = new Set(
    aiResult.qaReport.issues.map((i) => `${i.itemId}:${i.category}`),
  );
  const uniqueLocal = localIssues.filter(
    (li) => !aiIssueKeys.has(`${li.itemId}:${li.category}`),
  );
  aiResult.qaReport.issues = [...aiResult.qaReport.issues, ...uniqueLocal];

  // Upgrade overallQuality if high-severity issues exist
  const hasHigh = aiResult.qaReport.issues.some((i) => i.severity === "high");
  if (hasHigh && aiResult.qaReport.overallQuality !== "needs_review") {
    aiResult.qaReport.overallQuality = "needs_review";
  }

  return { ...aiResult, localIssues };
}
