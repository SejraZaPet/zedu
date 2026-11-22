/**
 * Převod úkol ↔ materiál bez ztráty dat. Mění jen `settings` a úkolová pole řádku
 * `assignments`; pokusy (`assignment_attempts`) se nikdy nemažou. Původní nastavení
 * úkolu se ukládá do `settings.previousTask`, takže převod lze vrátit.
 */
import { assignmentKind, neutralizeForKind, type KindRowFields } from "@/lib/assignment-kind";

const obj = (s: unknown): Record<string, unknown> => (s && typeof s === "object" && !Array.isArray(s) ? { ...(s as Record<string, unknown>) } : {});

export interface ConvertibleRow extends KindRowFields { id: string; settings?: unknown }

const ROW_KEYS = ["deadline", "max_attempts", "exam_type", "group_mode", "group_size", "randomize_order", "randomize_choices", "is_portfolio_task", "lockdown_mode"] as const;
const SETTING_KEYS = ["lateUntil", "notifyOverdue", "cheatSheetAllowed"] as const;

export type ConvertPatch = Record<string, unknown> & { settings: Record<string, unknown> };

/** Úkol → materiál. Vrací patch pro update (bez id). */
export function toMaterialPatch(row: ConvertibleRow): ConvertPatch {
  const settings = obj(row.settings);
  const prevRow: Record<string, unknown> = {};
  for (const k of ROW_KEYS) if ((row as any)[k] !== undefined) prevRow[k] = (row as any)[k];
  const prevSettings: Record<string, unknown> = {};
  for (const k of SETTING_KEYS) if (k in settings) { prevSettings[k] = settings[k]; delete settings[k]; }
  settings.previousTask = { row: prevRow, settings: prevSettings, convertedAt: new Date().toISOString() };
  settings.kind = "material";
  const existing = Array.isArray(settings.worksheets) ? settings.worksheets as any[] : [];
  if (row.worksheet_id && !existing.some((w) => w?.id === row.worksheet_id)) settings.worksheets = [{ id: row.worksheet_id }, ...existing];
  const neutral = neutralizeForKind("material", { ...pickRow(row) });
  return { ...neutral, settings };
}

/** Materiál → úkol (obnoví z `previousTask`). */
export function toTaskPatch(row: ConvertibleRow): ConvertPatch {
  const settings = obj(row.settings);
  const prev = obj(settings.previousTask);
  const prevRow = obj(prev.row);
  const prevSettings = obj(prev.settings);
  delete settings.previousTask;
  delete settings.kind;
  for (const [k, v] of Object.entries(prevSettings)) settings[k] = v;
  const worksheets = Array.isArray(settings.worksheets) ? settings.worksheets as any[] : [];
  const worksheet_id = row.worksheet_id ?? worksheets[0]?.id ?? null;
  return { ...prevRow, worksheet_id, settings };
}

function pickRow(row: ConvertibleRow): KindRowFields {
  const out: Record<string, unknown> = {};
  for (const k of [...ROW_KEYS, "worksheet_id", "lesson_id", "lesson_source"]) if ((row as any)[k] !== undefined) out[k] = (row as any)[k];
  return out as KindRowFields;
}

export const canRevertToTask = (settings: unknown) => assignmentKind(settings) === "material" && !!obj(settings).previousTask;

/** Souhrn dopadu pro potvrzovací dialog. */
export function impactText(submissions: number, graded: number): string {
  return `${submissions} odevzdání a ${graded} hodnocení zmizí z výsledků a z fronty hodnocení, nic se nesmaže, jde vrátit zpět.`;
}
