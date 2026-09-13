/**
 * Společná metadata typů aktivit – ikona, popis, barevný akcent a souhrn obsahu.
 * Používá editor lekce (BlockEditor / ActivityBlock), žákovský renderer
 * i přehled aktivit a jejich PDF export, aby byl vzhled a text všude stejný.
 */

import { getQuizQuestions } from "@/lib/quiz-questions";

export interface ActivityTypeMeta {
  value: string;
  label: string;
  /** Emoji ikona typu – funguje v UI i v tiskovém HTML. */
  icon: string;
  /** Tailwind akcent (okraj + podklad) podle typu aktivity. */
  accent: string;
  /** Barva pro tiskový export (hex). */
  printColor: string;
}

export const ACTIVITY_TYPE_META: Record<string, ActivityTypeMeta> = {
  quiz: { value: "quiz", label: "Kvíz", icon: "❓", accent: "border-l-4 border-l-[hsl(var(--primary))] bg-primary/5", printColor: "#2f7fa3" },
  flashcards: { value: "flashcards", label: "Otáčecí kartičky", icon: "🃏", accent: "border-l-4 border-l-[hsl(var(--secondary))] bg-secondary/5", printColor: "#7a4fd0" },
  reveal_cards: { value: "reveal_cards", label: "Otevři kartičku", icon: "🎴", accent: "border-l-4 border-l-[hsl(var(--secondary))] bg-secondary/5", printColor: "#7a4fd0" },
  memory_game: { value: "memory_game", label: "Pexeso", icon: "🧠", accent: "border-l-4 border-l-[hsl(var(--accent))] bg-accent/10", printColor: "#c2557a" },
  matching: { value: "matching", label: "Přiřazování A–B", icon: "🔗", accent: "border-l-4 border-l-[hsl(var(--primary))] bg-primary/5", printColor: "#2f7fa3" },
  ordering: { value: "ordering", label: "Seřaď pořadí", icon: "🔢", accent: "border-l-4 border-l-[hsl(var(--primary))] bg-primary/5", printColor: "#2f7fa3" },
  sorting: { value: "sorting", label: "Třídění do skupin", icon: "🗂️", accent: "border-l-4 border-l-[hsl(var(--accent))] bg-accent/10", printColor: "#c2557a" },
  true_false: { value: "true_false", label: "Pravda / Nepravda", icon: "⚖️", accent: "border-l-4 border-l-[hsl(var(--primary))] bg-primary/5", printColor: "#2f7fa3" },
  fill_blanks: { value: "fill_blanks", label: "Doplň slova", icon: "✏️", accent: "border-l-4 border-l-[hsl(var(--secondary))] bg-secondary/5", printColor: "#7a4fd0" },
  fill_choice: { value: "fill_choice", label: "Doplň z nabídky", icon: "📝", accent: "border-l-4 border-l-[hsl(var(--secondary))] bg-secondary/5", printColor: "#7a4fd0" },
  crossword: { value: "crossword", label: "Křížovka", icon: "🧩", accent: "border-l-4 border-l-[hsl(var(--accent))] bg-accent/10", printColor: "#c2557a" },
  image_label: { value: "image_label", label: "Popis obrázku (slepá mapa)", icon: "🖼️", accent: "border-l-4 border-l-[hsl(var(--primary))] bg-primary/5", printColor: "#2f7fa3" },
  image_hotspot: { value: "image_hotspot", label: "Klikni na správnou část", icon: "🎯", accent: "border-l-4 border-l-[hsl(var(--primary))] bg-primary/5", printColor: "#2f7fa3" },
  wall: { value: "wall", label: "Zeď (odpovědi žáků)", icon: "🧱", accent: "border-l-4 border-l-[hsl(var(--accent))] bg-accent/10", printColor: "#c2557a" },
  poll: { value: "poll", label: "Anketa", icon: "📊", accent: "border-l-4 border-l-[hsl(var(--accent))] bg-accent/10", printColor: "#c2557a" },
};

export const activityMeta = (type?: string): ActivityTypeMeta =>
  ACTIVITY_TYPE_META[type ?? ""] ?? {
    value: type ?? "activity",
    label: "Aktivita",
    icon: "🎯",
    accent: "border-l-4 border-l-border bg-muted/30",
    printColor: "#555555",
  };

const count = (arr: unknown): number => (Array.isArray(arr) ? arr.filter(Boolean).length : 0);

/** Krátký souhrn obsahu aktivity, např. „8 párů" nebo „5 otázek". */
export function activitySummary(props: Record<string, any> | undefined | null): string {
  const p = props ?? {};
  const type = p.activityType || "flashcards";
  switch (type) {
    case "quiz": {
      const qs = getQuizQuestions(p.quiz);
      if (qs.length === 0) return "bez otázky";
      if (qs.length === 1) return `${count(qs[0].answers)} možností`;
      return `${qs.length} otázek`;
    }
    case "flashcards":
      return `${count(p.flashcards)} kartiček`;
    case "reveal_cards":
      return `${count(p.revealCards?.cards)} kartiček`;
    case "memory_game":
      return `${count(p.memoryGame?.pairs)} párů`;
    case "matching":
      return `${count(p.matching?.left)} párů`;
    case "ordering":
      return `${count(p.ordering?.items)} kroků`;
    case "sorting":
      return `${count(p.sorting?.groups)} skupin · ${count(p.sorting?.items)} položek`;
    case "true_false":
      return `${count(p.trueFalse?.statements)} tvrzení`;
    case "fill_blanks":
      return `${count(p.fillBlanks?.tokens)} částí`;
    case "fill_choice":
      return `${count(p.fillChoice?.options)} možností`;
    case "crossword":
      return `${count(p.crossword?.entries)} slov`;
    case "image_label":
      return `${count(p.imageLabel?.markers)} popisků`;
    case "image_hotspot":
      return `${count(p.imageHotspot?.hotspots)} oblastí`;
    case "wall":
    case "poll":
      return p.question ? "otázka připravena" : "bez otázky";
    default:
      return "";
  }
}

/** Odhadovaný čas v minutách (volitelné pole), nebo null. */
export function activityMinutes(props: Record<string, any> | undefined | null): number | null {
  const raw = props?.estimatedMinutes;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const WORK_MODE_LABELS: Record<string, string> = {
  individual: "👤 Individuální práce",
  pairs: "👥 Práce ve dvojicích",
  group: "👨‍👩‍👧‍👦 Skupinová práce",
  whole_class: "🏫 Společně se třídou",
};

/** True, pokud je aktivita navržená AI a učitel ji ještě ručně nepotvrdil. */
export const isAiSuggestedActivity = (props: Record<string, any> | undefined | null): boolean =>
  props?.ai_generated === true;
