/**
 * Přiřazení primární role uživateli (verze pro edge funkce).
 *
 * Trigger `handle_new_user` zakládá u nových auth účtů výchozí roli `user`.
 * U zaměstnaneckých/rodičovských rolí je taková zbytková role chyba — učitel
 * by se počítal i jako žák (statistiky školy, licenční seaty).
 *
 * POZOR: stejná logika žije i v `src/lib/assign-primary-role.ts` pro frontend
 * (edge funkce nemohou importovat ze `src/`). Když měníš jednu, změň druhou.
 */

export const NON_STUDENT_ROLES = ["teacher", "lektor", "rodic", "admin", "school_admin"] as const;

export const isNonStudentRole = (role: string): boolean =>
  (NON_STUDENT_ROLES as readonly string[]).includes(role);

interface RoleClient {
  from: (table: string) => any;
}

/** @returns chybová zpráva, nebo null při úspěchu. */
export async function assignPrimaryRole(
  client: RoleClient,
  userId: string,
  role: string,
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

/** Mapování role → `role_label` pro auth metadata (trigger handle_new_user). */
export const roleLabelFor = (role: string): string =>
  role === "teacher" || role === "lektor" || role === "rodic" ? role : "student";
