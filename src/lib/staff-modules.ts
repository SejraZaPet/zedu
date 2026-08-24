export interface StaffModule {
  id: string;
  label: string;
}

/** Moduly odpovídající sekcím v administraci. */
export const STAFF_MODULES: StaffModule[] = [
  { id: "crm", label: "CRM" },
  { id: "users", label: "Uživatelé" },
  { id: "schools", label: "Školy" },
  { id: "school_licenses", label: "Spolupracující organizace" },
  { id: "textbook_overview", label: "Přehled učebnic" },
  { id: "academy", label: "Akademie" },
  { id: "avatar_manager", label: "Avatary" },
  { id: "notifications", label: "Notifikace" },
  { id: "landing", label: "Landing page" },
  { id: "templates", label: "Šablony" },
  { id: "audit", label: "Audit log" },
  { id: "stats", label: "Statistiky" },
  { id: "billing", label: "Fakturace" },
  { id: "website_assistant", label: "Bezlai web" },
];

export const CRM_STATUSES = [
  { value: "novy", label: "Nový", color: "hsl(var(--muted-foreground))" },
  { value: "kontaktovano", label: "Kontaktováno", color: "#63C7CF" },
  { value: "v_jednani", label: "V jednání", color: "#E9A23B" },
  { value: "zkusebni", label: "Zkušební", color: "#F2C14E" },
  { value: "zakaznik", label: "Zákazník", color: "#2FA36B" },
  { value: "odmitnuto", label: "Odmítnuto", color: "#E4572E" },
  { value: "neaktivni", label: "Neaktivní", color: "#7C93A6" },
] as const;

export const CRM_TYPES = [
  { value: "skola", label: "Škola" },
  { value: "lektor", label: "Lektor" },
  { value: "jina", label: "Jiná organizace" },
] as const;

export const CRM_SOURCES = [
  { value: "osobni kontakt", label: "Osobní kontakt" },
  { value: "doporuceni", label: "Doporučení" },
  { value: "web", label: "Web" },
  { value: "konference", label: "Konference" },
  { value: "jine", label: "Jiné" },
] as const;

export const CRM_INTERACTION_TYPES = [
  { value: "telefon", label: "Telefon" },
  { value: "email", label: "E-mail" },
  { value: "schuzka", label: "Schůzka" },
  { value: "jine", label: "Jiné" },
] as const;

export const CZ_REGIONS = [
  "Praha",
  "Středočeský",
  "Jihočeský",
  "Plzeňský",
  "Karlovarský",
  "Ústecký",
  "Liberecký",
  "Královéhradecký",
  "Pardubický",
  "Vysočina",
  "Jihomoravský",
  "Olomoucký",
  "Zlínský",
  "Moravskoslezský",
];

export const statusMeta = (status: string) =>
  CRM_STATUSES.find((s) => s.value === status) ?? CRM_STATUSES[0];
