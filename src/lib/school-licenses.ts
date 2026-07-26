export type LicensePlan = "start" | "rust" | "skola" | "lektor";
export type LicenseStatus = "trial" | "active" | "expired";

export const PLAN_LABELS: Record<LicensePlan, string> = {
  start: "Start",
  rust: "Růst",
  skola: "Škola",
  lektor: "Lektor",
};

export const STATUS_LABELS: Record<LicenseStatus, string> = {
  trial: "Zkušební",
  active: "Aktivní",
  expired: "Vypršelo",
};

// Reference defaults for admin convenience (nulls = unlimited).
export const PLAN_DEFAULTS: Record<LicensePlan, { seats_teachers: number | null; seats_students: number | null }> = {
  start: { seats_teachers: 3, seats_students: 70 },
  rust: { seats_teachers: 8, seats_students: 250 },
  skola: { seats_teachers: null, seats_students: null },
  lektor: { seats_teachers: 1, seats_students: null },
};

export interface SchoolLicense {
  id: string;
  school_id: string;
  plan: LicensePlan;
  seats_teachers: number | null;
  seats_students: number | null;
  starts_at: string;
  expires_at: string | null;
  status: LicenseStatus;
  billing_cycle: "monthly" | "yearly" | null;
  admin_notes: string | null;
  updated_at: string;
}

export const isExpired = (l: Pick<SchoolLicense, "expires_at" | "status">) => {
  if (l.status === "expired") return true;
  if (!l.expires_at) return false;
  return new Date(l.expires_at).getTime() < Date.now();
};
