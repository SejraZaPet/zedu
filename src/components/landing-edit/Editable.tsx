import { useEffect, useRef, type KeyboardEvent } from "react";
import { useLandingEditModeOptional } from "@/contexts/LandingEditModeContext";
import { useCurrentSection } from "./SectionContext";
import { cn } from "@/lib/utils";

interface EditableProps {
  /** Dot-path inside the section props, e.g. "subtitle" or "primary_cta.label". */
  path: string;
  /** Current value to render. */
  value: string | undefined | null;
  /** Fallback shown when value is empty (edit mode only). */
  placeholder?: string;
  /** Allow line breaks (Shift+Enter inserts \n, Enter also commits). Default: false. */
  multiline?: boolean;
  /** Extra classes for the editable span (applied only in edit mode). */
  className?: string;
  /** Optional wrapper for non-edit rendering. Defaults to a plain fragment. */
  children?: React.ReactNode;
}

/**
 * Inline editable text field. Outside edit mode renders `children` (or the raw value) unchanged.
 * Inside edit mode renders a contentEditable span with the same visual footprint and commits
 * changes into the draft via `setDraftField` on blur / Enter. Escape reverts.
 */
export default function Editable({ path, value, placeholder, multiline, className, children }: EditableProps) {
  const ctx = useLandingEditModeOptional();
  const section = useCurrentSection();
  const ref = useRef<HTMLSpanElement | null>(null);
  const initial = value ?? "";

  // Keep the DOM in sync when the value prop changes externally (e.g. discard, side panel edit)
  // but only when the element is not currently focused, to avoid clobbering the user's caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const current = multiline ? el.innerText : el.textContent ?? "";
    if (current !== initial) {
      el.textContent = initial;
    }
  }, [initial, multiline]);

  if (!ctx?.isEditMode || !section) {
    return <>{children ?? value ?? ""}</>;
  }

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = multiline ? el.innerText : (el.textContent ?? "");
    if (next === initial) return;
    ctx.setDraftField(section, path, next);
  };

  const revert = () => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initial;
    el.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      revert();
      return;
    }
    if (e.key === "Enter") {
      if (multiline && e.shiftKey) return; // allow shift+enter newline in multiline
      if (!multiline) {
        e.preventDefault();
        commit();
        ref.current?.blur();
      } else {
        // Plain Enter in multiline: commit & blur.
        e.preventDefault();
        commit();
        ref.current?.blur();
      }
    }
  };

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={path}
      data-placeholder={placeholder}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={cn(
        "outline-none rounded px-1 -mx-1 transition-colors cursor-text",
        "hover:bg-primary/10 focus:bg-primary/15",
        "ring-1 ring-transparent focus:ring-primary/50",
        multiline && "whitespace-pre-line",
        // Empty-state placeholder
        "empty:before:content-[attr(data-placeholder)] empty:before:opacity-50",
        className,
      )}
    >
      {initial}
    </span>
  );
}
