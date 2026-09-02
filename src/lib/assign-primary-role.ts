/**
 * Přiřazení primární role uživateli.
 *
 * Trigger `handle_new_user` zakládá u nových auth účtů výchozí roli `user`
 * (pokud metadata neobsahují `role_label`). U zaměstnaneckých/rodičovských rolí
 * je taková zbytková role chyba — pak se učitel počítá i jako žák (statistiky,
 * licenční seaty) a filtry „kdo je žák“ se rozcházejí.
 *
 * Proto se `user` u těchto rolí nejdřív odstraní a teprve pak se přiřadí
 * cílová role.
 *
 * POZOR: stejná logika žije i v `supabase/functions/_shared/assign-primary-role.ts`
 * pro edge funkce (ty nemohou importovat ze `src/`). Když měníš jednu, změň druhou.
 */

/** Role, u kterých je zbytková `user` nežádoucí. */
export const NON_STUDENT_ROLES = ["teacher", "lektor", "rodic", "admin", "school_admin"] as const;

export type PrimaryRole = "user" | (typeof NON_STUDENT_ROLES)[number];

/** Minimální rozhraní supabase klienta, které helper potřebuje. */
interface RoleClient {
  from: (table: string) => any;
}

export const isNonStudentRole = (role: string): boolean =>
  (NON_STUDENT_ROLES as readonly string[]).includes(role);

/**
 * Nastaví uživateli roli. U ne-žákovských rolí předtím smaže zbytkovou `user`.
 * @returns chybová zpráva, nebo null při úspěchu.
 */
export async function assignPrimaryRole(
  client: RoleClient,
  userId: string,
  role: PrimaryRole | string,
): Promise<string | null> {
  if (isNonStudentRole(role)) {
    const { error: cleanupError } = await client
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "user");
    if (cleanupError) return cleanupError.message;
  }

  const { error } = await client
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });

  return error ? error.message : null;
}
