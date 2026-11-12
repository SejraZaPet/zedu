import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Úprava prostého textu přímo v listu (jen editor). Žádné HTML – zapisuje stejné textové pole spec
 * jako formulář. Jeden zápis (= jeden krok zpět) na dokončenou úpravu: při opuštění pole, Enteru
 * (jednořádkové pole), Ctrl/Cmd+Enter, odpojení nebo před odchodem ze stránky. Esc vrátí původní text.
 */
export interface InlineTextProps {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

export function InlineText({ value, onCommit, multiline = false, placeholder, ariaLabel, className }: InlineTextProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const focused = useRef(false);
  const draftRef = useRef(value);
  const valueRef = useRef(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  valueRef.current = value;

  // Synchronizace s formulářem: cizí změna se převezme, jen když se v poli právě nepíše.
  useEffect(() => {
    if (!focused.current) {
      setDraft(value);
      draftRef.current = value;
    }
  }, [value]);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(resize, [draft, resize]);

  const flush = useCallback(() => {
    const next = draftRef.current;
    if (next !== valueRef.current) {
      valueRef.current = next;
      commitRef.current(next);
    }
  }, []);

  // Před odchodem ze stránky / při odpojení nic rozepsaného neztratit.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draftRef.current !== valueRef.current) {
        flush();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, [flush]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      draftRef.current = valueRef.current;
      setDraft(valueRef.current);
      ref.current?.blur();
      return;
    }
    if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      spellCheck
      data-inline-text=""
      onChange={(e) => {
        const v = multiline ? e.target.value : e.target.value.replace(/\r?\n/g, " ");
        draftRef.current = v;
        setDraft(v);
      }}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; flush(); }}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 m-0 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit",
        "cursor-text rounded-sm outline-none transition-colors hover:bg-primary/5 focus:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring",
        "placeholder:font-normal placeholder:italic placeholder:text-muted-foreground",
        className,
      )}
    />
  );
}

export default InlineText;
