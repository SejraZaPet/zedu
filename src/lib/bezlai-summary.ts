import type { PracticeSource } from "@/lib/practice-method";
import { SOURCE_TEXT_LIMIT } from "../../supabase/functions/_shared/practice-phases";

export interface BezlaiSummaryDraft {
  title: string;
  text: string;
  /** Čas první ruční úpravy AI konceptu; null = zatím neupraveno. */
  aiModifiedAt: string | null;
}

/** Přečte stabilní výstup tutora; neočekávaný tvar nikdy nezahodí. */
export function parseBezlaiSummary(raw: string): Omit<BezlaiSummaryDraft, "aiModifiedAt"> {
  const clean = raw.replace(/\r\n/g, "\n").trim();
  const titleMatch = clean.match(/^NÁZEV:\s*(.+)$/im);
  const bodyMatch = clean.match(/^HLAVNÍ BODY:\s*\n([\s\S]*?)(?=^ZDROJE:\s*$)/im);
  const sourcesMatch = clean.match(/^ZDROJE:\s*\n([\s\S]*)$/im);
  const title = titleMatch?.[1]?.trim().slice(0, 200) || "Poznámky z Bezlai";
  if (!bodyMatch) return { title, text: clean.slice(0, SOURCE_TEXT_LIMIT) };
  const body = bodyMatch[1].trim();
  const sources = sourcesMatch?.[1]?.trim();
  return {
    title,
    text: `Hlavní body:\n${body}${sources ? `\n\nZdroje:\n${sources}` : ""}`.slice(0, SOURCE_TEXT_LIMIT),
  };
}

export function practiceSourceFromBezlaiSummary(draft: Pick<BezlaiSummaryDraft, "title" | "text">): PracticeSource {
  return {
    kind: "text",
    label: `Bezlai – ${draft.title.trim() || "poznámky"}`.slice(0, 200),
    text: `${draft.title.trim()}\n\n${draft.text.trim()}`.trim().slice(0, SOURCE_TEXT_LIMIT),
  };
}

export function summaryPracticeUrl(kind: "flashcards" | "mcq"): string {
  return `/student/z-materialu?typ=${kind}`;
}
