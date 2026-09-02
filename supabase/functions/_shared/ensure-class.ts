// Společná logika „najdi nebo vytvoř třídu“ pro hromadný import uživatelů.
//
// Import z Bakalářů dává jen textovou zkratku třídy (Č1.A). Aby žák skutečně
// patřil do třídy (úkoly, pochvaly, rozvrh, engagement statistiky), musí být
// v `classes` + `class_members`. Tento helper zajistí odpovídající záznam
// třídy pro danou školu a vrátí jeho id.

// deno-lint-ignore no-explicit-any
type Client = any;

/** Odvodí ročník ze zkratky třídy (Č1.A → 1). */
export function classYearFromCode(code: string): number | null {
  const m = String(code ?? "").match(/(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export interface EnsureClassResult {
  id?: string;
  created?: boolean;
  error?: string;
}

/**
 * Najde (podle school_id + name) nebo vytvoří třídu. Volá se service-role
 * klientem, takže obchází RLS — proto se školou smí být pouze `schoolId`
 * ověřený na straně volající funkce.
 */
export async function ensureClass(
  admin: Client,
  opts: { schoolId: string; name: string; year?: number | null; createdBy: string; schoolName?: string },
): Promise<EnsureClassResult> {
  const name = String(opts.name ?? "").trim();
  if (!name || !opts.schoolId) return { error: "Chybí název třídy nebo škola." };

  const { data: found, error: findError } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", opts.schoolId)
    .eq("name", name)
    .maybeSingle();
  if (findError) return { error: findError.message };
  if (found?.id) return { id: found.id as string, created: false };

  const year = opts.year ?? classYearFromCode(name);
  const { data: created, error: insertError } = await admin
    .from("classes")
    .insert({
      name,
      year: year ?? null,
      school_id: opts.schoolId,
      created_by: opts.createdBy,
      field_of_study: name,
      school: opts.schoolName ?? "",
    })
    .select("id")
    .single();
  if (insertError || !created?.id) return { error: insertError?.message ?? "Třídu se nepodařilo vytvořit." };
  return { id: created.id as string, created: true };
}

/** Zařadí uživatele do třídy; existující členství nechá být. */
export async function addClassMember(
  admin: Client,
  classId: string,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("class_members")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.id) return null;
  const { error } = await admin.from("class_members").insert({ class_id: classId, user_id: userId });
  return error ? error.message : null;
}
