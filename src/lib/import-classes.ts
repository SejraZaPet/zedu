import { supabase } from "@/integrations/supabase/client";
import { parseClassCode } from "@/lib/import-users";

/** Odvodí ročník ze zkratky třídy (Č1.A → 1), s fallbackem na první číslo. */
export const classYearFromCode = (code: string): number | null => {
  const parsed = parseClassCode(code);
  if (parsed.rocnik != null) return parsed.rocnik;
  const m = String(code ?? "").match(/(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
};

export interface EnsureClassOptions {
  name: string;
  year?: number | null;
  schoolId?: string | null;
  createdBy: string;
  schoolName?: string;
}

/**
 * Najde nebo vytvoří třídu pro import. Klíč je (school_id, name) — u importu
 * bez konkrétní školy (globální admin) se hledá mezi třídami bez school_id
 * založenými stejným uživatelem, aby nevznikaly duplicity.
 */
export const ensureImportClass = async (
  opts: EnsureClassOptions,
): Promise<{ id?: string; created?: boolean; error?: string }> => {
  const name = String(opts.name ?? "").trim();
  if (!name) return { error: "Chybí název třídy." };

  let query = supabase.from("classes").select("id").eq("name", name).limit(1);
  query = opts.schoolId
    ? query.eq("school_id", opts.schoolId)
    : query.is("school_id", null).eq("created_by", opts.createdBy);
  const { data: found, error: findError } = await query.maybeSingle();
  if (findError) return { error: findError.message };
  if (found?.id) return { id: found.id as string, created: false };

  const { data: created, error: insertError } = await supabase
    .from("classes")
    .insert({
      name,
      year: opts.year ?? classYearFromCode(name),
      school_id: opts.schoolId ?? null,
      created_by: opts.createdBy,
      field_of_study: name,
      school: opts.schoolName ?? "",
    })
    .select("id")
    .single();
  if (insertError || !created?.id) {
    return { error: insertError?.message ?? "Třídu se nepodařilo vytvořit." };
  }
  return { id: created.id as string, created: true };
};

/** Zařadí žáka do třídy, existující členství nechá být. */
export const addImportClassMember = async (classId: string, userId: string): Promise<string | null> => {
  const { data: existing } = await supabase
    .from("class_members")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.id) return null;
  const { error } = await supabase.from("class_members").insert({ class_id: classId, user_id: userId });
  return error ? error.message : null;
};

/** Jednoduchá cache tříd v rámci jednoho importu (název → id třídy). */
export class ImportClassCache {
  private map = new Map<string, string>();

  constructor(private readonly opts: Omit<EnsureClassOptions, "name" | "year">) {}

  async resolve(name: string, year?: number | null): Promise<{ id?: string; created?: boolean; error?: string }> {
    const key = String(name ?? "").trim();
    if (!key) return {};
    const cached = this.map.get(key);
    if (cached) return { id: cached, created: false };
    const res = await ensureImportClass({ ...this.opts, name: key, year });
    if (res.id) this.map.set(key, res.id);
    return res;
  }
}
