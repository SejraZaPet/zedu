/** Poslední volba učitele „Aktivity spouštět: ručně / automaticky“ (jen v prohlížeči). */
export type ActivityStartMode = "manual" | "auto";
export const ACTIVITY_START_PREF_KEY = "bezli.activityStartMode";

export function getActivityStartPref(): ActivityStartMode {
  try {
    return localStorage.getItem(ACTIVITY_START_PREF_KEY) === "auto" ? "auto" : "manual";
  } catch {
    return "manual";
  }
}

export function setActivityStartPref(mode: ActivityStartMode): void {
  try {
    localStorage.setItem(ACTIVITY_START_PREF_KEY, mode);
  } catch {
    /* soukromý režim apod. – volba platí jen do obnovení stránky */
  }
}
