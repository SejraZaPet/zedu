import { cn } from "@/lib/utils";

interface AiContentBadgeProps {
  /** Vytvořeno umělou inteligencí. */
  aiGenerated?: boolean | null;
  /** Kdy byl AI výstup poprvé upraven člověkem. */
  aiModifiedAt?: string | null;
  className?: string;
}

/**
 * Označení AI generovaného obsahu podle EU AI Act (čl. 50).
 * ai_generated=true & ai_modified_at IS NULL → "AI generováno"
 * ai_generated=true & ai_modified_at IS NOT NULL → "AI upraveno"
 */
export default function AiContentBadge({
  aiGenerated,
  aiModifiedAt,
  className,
}: AiContentBadgeProps) {
  if (!aiGenerated) return null;
  const modified = !!aiModifiedAt;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground align-middle whitespace-nowrap",
        className,
      )}
      title={
        modified
          ? "Obsah byl vygenerován umělou inteligencí a následně upraven člověkem."
          : "Obsah byl vygenerován umělou inteligencí a nebyl upraven."
      }
    >
      <span aria-hidden="true">🤖</span>
      {modified ? "AI upraveno" : "AI generováno"}
    </span>
  );
}
