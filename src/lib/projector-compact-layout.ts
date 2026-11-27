import { isWordcloudShown } from "@/lib/wordcloud-visibility";

/** Je zeď na tomto snímku zveřejněná učitelem? (výslovné true pro aktuální snímek) */
export function isWallPublished(settings: any, questionIndex: number): boolean {
  return settings?.wallPublished === true && settings?.wallPublishedQuestion === questionIndex;
}

/** Jsou výsledky ankety zveřejněné učitelem pro tento snímek? */
export function isPollPublished(settings: any, questionIndex: number): boolean {
  return settings?.pollPublished === true && settings?.pollPublishedQuestion === questionIndex;
}

/**
 * Živé aktivity s rozvržením „kompaktní otázka nahoře + obsah uprostřed“
 * (jako Mentimeter). Slovní mrak vždy, zeď až po zveřejnění. Další aktivity
 * (např. anketa) lze později přidat sem, aniž by se měnil projektor.
 */
export function usesCompactProjectorLayout(activityType: string | null | undefined, settings: any, questionIndex: number): boolean {
  if (activityType === "wordcloud") return true;
  if (activityType === "wall") return isWallPublished(settings, questionIndex);
  if (activityType === "poll") return isPollPublished(settings, questionIndex);
  return false;
}

/** Velikost lístků zdi podle počtu odpovědí (px na stage 1600×900). */
export function wallNoteSizing(count: number): { fontSize: number; maxWidth: number; padding: string; gap: number } {
  if (count <= 3) return { fontSize: 44, maxWidth: 620, padding: "28px 40px", gap: 32 };
  if (count <= 6) return { fontSize: 34, maxWidth: 460, padding: "22px 32px", gap: 28 };
  if (count <= 12) return { fontSize: 27, maxWidth: 380, padding: "18px 26px", gap: 22 };
  if (count <= 20) return { fontSize: 24, maxWidth: 340, padding: "14px 22px", gap: 20 };
  if (count <= 30) return { fontSize: 22, maxWidth: 300, padding: "12px 20px", gap: 16 };
  return { fontSize: 18, maxWidth: 260, padding: "10px 16px", gap: 12 };
}
