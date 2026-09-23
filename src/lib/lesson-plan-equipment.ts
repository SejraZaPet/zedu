/**
 * Pomůcky u jednotlivých fází plánu hodiny.
 * Ukládají se do `lesson_plan_phases` (řádky s `lesson_plan_id`), kam mají přístup
 * jen učitelé – žák je nikdy nenačte ani neuvidí.
 */
import { supabase } from "@/integrations/supabase/client";

export type PhaseEquipment = Record<string, string>;

export async function loadPlanEquipment(planId: string): Promise<PhaseEquipment> {
  const { data, error } = await supabase
    .from("lesson_plan_phases")
    .select("phase_key, equipment")
    .eq("lesson_plan_id", planId);
  if (error || !data) return {};
  const out: PhaseEquipment = {};
  for (const r of data as any[]) {
    if (r.equipment) out[r.phase_key] = r.equipment;
  }
  return out;
}

export async function savePlanEquipment(
  planId: string,
  teacherId: string,
  equipment: PhaseEquipment,
  phaseOrder: string[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("lesson_plan_phases")
    .delete()
    .eq("lesson_plan_id", planId);
  if (delErr) throw delErr;
  const rows = phaseOrder
    .map((key, i) => ({ key, i, value: (equipment[key] ?? "").trim() }))
    .filter((r) => r.value)
    .map((r) => ({
      lesson_plan_id: planId,
      teacher_id: teacherId,
      phase_key: r.key,
      equipment: r.value,
      sort_order: r.i,
      duration_min: 0,
    }));
  if (rows.length) {
    const { error } = await supabase.from("lesson_plan_phases").insert(rows as any);
    if (error) throw error;
  }
}
