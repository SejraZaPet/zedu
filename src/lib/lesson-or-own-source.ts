/**
 * Výběr zdroje pro AI: „Z lekce / Vlastní materiál / Obojí“ – čisté funkce.
 * Sloučí text lekce a vlastní materiál učitele do jednoho textu. Nikdy tiše neořezává:
 * při překročení limitu vrátí varování a generování se zablokuje. Nic se neukládá.
 */
import type { BundleState, SourceItem } from "@/lib/source-bundle";

export type LessonOrOwnMode = "lesson" | "own" | "both";
export const OWN_MATERIAL_HEADING = "Materiál učitele";
export const LESSON_TEXT_HEADING = "Text lekce";
export const OWN_SOURCE_HINT = "Materiál z Teamsu nebo Classroomu stačí nahrát jako soubor nebo vložit odkaz/text.";
export const OWN_SOURCE_PRIVACY = "Nevkládejte osobní údaje žáků (jména, hodnocení, kontakty).";
export const SCANNED_PDF_HINT = "PDF neobsahuje čitelný text (nejspíš je naskenované). Nahrajte jeho stránky jako fotky.";
/** Pod tuto hranici považujeme přečtené PDF za sken bez textové vrstvy. */
export const SCANNED_PDF_MAX_CHARS = 50;

export const usesLesson = (m: LessonOrOwnMode) => m !== "own";
export const usesOwn = (m: LessonOrOwnMode) => m !== "lesson";

export interface CombinedSource { text: string; chars: number; limit: number; overBy: number; ok: boolean; message: string | null }

export function combineLessonAndOwn(args: {
  mode: LessonOrOwnMode; lessonText: string; ownText: string; limit: number;
  /** Stav balíku vlastních zdrojů (načítání, limity, chyby). */
  ownState?: Pick<BundleState, "ok" | "message">;
}): CombinedSource {
  const { mode, limit } = args;
  const lesson = usesLesson(mode) ? (args.lessonText ?? "").trim() : "";
  const own = usesOwn(mode) ? (args.ownText ?? "").trim() : "";
  const fmt = (n: number) => n.toLocaleString("cs-CZ");
  const parts: string[] = [];
  if (lesson) parts.push(mode === "both" ? `## ${LESSON_TEXT_HEADING}\n${lesson}` : lesson);
  if (own) parts.push(`## ${OWN_MATERIAL_HEADING}\n${own}`);
  const text = parts.join("\n\n");
  const chars = text.length;
  const overBy = Math.max(0, chars - limit);
  let message: string | null = null;
  if (usesLesson(mode) && !lesson) message = "Vyberte lekci s textem, nebo zvolte Vlastní materiál.";
  else if (usesOwn(mode) && args.ownState && !args.ownState.ok) message = args.ownState.message ?? "Vlastní materiál zatím nelze použít.";
  else if (usesOwn(mode) && !own) message = "Přidejte vlastní materiál – text, soubor, fotku nebo odkaz.";
  else if (overBy > 0) message = `Podklady mají ${fmt(chars)} znaků, limit je ${fmt(limit)} – přebývá ${fmt(overBy)}. Odeberte zdroj nebo text zkraťte.`;
  return { text, chars, limit, overBy, ok: message === null, message };
}

/** Připravená PDF bez čitelného textu (skeny) – nabídnout nahrání jako fotek. */
export function scannedPdfItems(items: Pick<SourceItem, "id" | "kind" | "status" | "text">[]): string[] {
  return items.filter((i) => i.kind === "pdf" && i.status === "ready" && (i.text ?? "").trim().length < SCANNED_PDF_MAX_CHARS).map((i) => i.id);
}
