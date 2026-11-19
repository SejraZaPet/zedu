/** Jediné místo „Studio – aktivity a hry“ pro učitele a jeho záložky v URL. */
export const STUDIO_PATH = "/ucitel/studio";
export type StudioTab = "hry" | "aktivity";
export const STUDIO_GAMES_HREF = `${STUDIO_PATH}?tab=hry`;
export const STUDIO_ACTIVITIES_HREF = `${STUDIO_PATH}?tab=aktivity`;
export const STUDIO_TEACHER_ROLES = ["teacher", "lektor", "school_admin", "admin"] as const;

/** Neznámá nebo chybějící hodnota = „Sady a hry“. */
export function studioTabFromSearch(search: string): StudioTab {
  return new URLSearchParams(search).get("tab") === "aktivity" ? "aktivity" : "hry";
}

/** Přihlášený učitel jde z veřejné /aktivity do Studia; nepřihlášený/žák zůstává. */
export function activitiesRedirectFor(isLoggedIn: boolean, role: string | null | undefined): string | null {
  if (!isLoggedIn || !role) return null;
  return (STUDIO_TEACHER_ROLES as readonly string[]).includes(role) ? STUDIO_ACTIVITIES_HREF : null;
}
