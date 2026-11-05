/** Nabídka „Přepnout roli“ – jen role, které uživatel už podle stávajících oprávnění smí. */
export type RoleSwitchKey = "admin" | "school_admin" | "teacher" | "user" | "back";

export interface RoleSwitchOption {
  key: RoleSwitchKey;
  label: string;
  /** "viewAs" = stávající admin náhled, "preferred" = trvalý pohled školní admin/učitel,
   *  "preview" = přepnutí na vlastní testovací účet, "return" = návrat z testovacího žáka */
  mode: "viewAs" | "preferred" | "preview" | "return";
  current: boolean;
}

export interface RoleSwitchInput {
  realRole: string | null;
  roles: string[];
  viewAsRole: string | null;
  canSwitchSchoolView: boolean;
  preferredView: "school_admin" | "teacher" | null;
  role: string | null;
  isPreviewSession: boolean;
}

export function roleSwitchOptions(i: RoleSwitchInput): RoleSwitchOption[] {
  if (i.isPreviewSession) {
    return [{ key: "back", label: "Zpět na admina / učitele", mode: "return", current: false }];
  }
  if (i.realRole === "admin") {
    const cur = i.viewAsRole ?? "admin";
    return [
      { key: "admin", label: "Admin", mode: "viewAs", current: cur === "admin" },
      { key: "school_admin", label: "Admin školy", mode: "viewAs", current: cur === "school_admin" },
      { key: "teacher", label: "Učitel", mode: "viewAs", current: cur === "teacher" },
      { key: "user", label: "Žák (testovací žák)", mode: "preview", current: false },
    ];
  }
  if (i.canSwitchSchoolView) {
    const teacherView = i.preferredView ? i.preferredView === "teacher" : i.role === "teacher" || i.role === "lektor";
    return [
      { key: "teacher", label: "Učitel", mode: "preferred", current: teacherView },
      { key: "school_admin", label: "Admin školy", mode: "preferred", current: !teacherView },
    ];
  }
  return [];
}

/** Odkaz „Administrace“ v patičce: jen skutečný admin, nikdy v relaci testovacího žáka. */
export function showFooterAdminLink(realRole: string | null, isPreviewSession: boolean): boolean {
  return realRole === "admin" && !isPreviewSession;
}
