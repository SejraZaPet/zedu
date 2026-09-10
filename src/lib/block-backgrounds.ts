/**
 * Pozadí bloku lekce/učebnice.
 *
 * Volba se ukládá do `props.backgroundStyle` a používá se
 * v editoru, na žákovské straně i při generování prezentace z lekce.
 */

export type BlockBackgroundKey =
  | "none"
  | "note"
  | "important"
  | "example"
  | "tip"
  | "neutral";

export interface BlockBackgroundOption {
  key: BlockBackgroundKey;
  label: string;
  /** Barva plochy (konkrétní hodnota – přenáší se i do prezentace). */
  bg: string;
  /** Barva svislého pruhu vlevo (jen u „Poznámky“ a dalších akcentů). */
  accent?: string;
}

export const BLOCK_BACKGROUNDS: BlockBackgroundOption[] = [
  { key: "none", label: "Bez pozadí", bg: "transparent" },
  { key: "note", label: "Poznámka", bg: "hsl(205, 100%, 96%)", accent: "hsl(205, 85%, 52%)" },
  { key: "important", label: "Důležité", bg: "hsl(34, 100%, 95%)", accent: "hsl(28, 92%, 53%)" },
  { key: "example", label: "Příklad", bg: "hsl(146, 55%, 95%)", accent: "hsl(150, 58%, 40%)" },
  { key: "tip", label: "Tip", bg: "hsl(266, 100%, 96%)", accent: "hsl(266, 80%, 62%)" },
  { key: "neutral", label: "Neutrální", bg: "hsl(220, 16%, 96%)", accent: "hsl(220, 10%, 66%)" },
];

export function getBlockBackground(
  key?: string | null,
): BlockBackgroundOption | null {
  if (!key || key === "none") return null;
  return BLOCK_BACKGROUNDS.find((o) => o.key === key) ?? null;
}

/** Inline styl obalu bloku (nebo `undefined`, pokud pozadí není zvolené). */
export function blockBackgroundStyle(
  props?: Record<string, any> | null,
): React.CSSProperties | undefined {
  const opt = getBlockBackground(props?.backgroundStyle);
  if (!opt) return undefined;
  return {
    background: opt.bg,
    borderRadius: 10,
    padding: "12px 16px",
    borderLeft: opt.accent ? `4px solid ${opt.accent}` : undefined,
  };
}

/** Barva pozadí pro snímek prezentace vygenerovaný z tohoto bloku. */
export function blockBackgroundSlideColor(
  props?: Record<string, any> | null,
): string | null {
  const opt = getBlockBackground(props?.backgroundStyle);
  return opt ? opt.bg : null;
}
