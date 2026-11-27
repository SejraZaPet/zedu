import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  summary: string;
  /** Obsah dostane `close`, aby se sekce po výběru zavřela. */
  children: (close: () => void) => ReactNode;
}

/**
 * Sbalitelná sekce nastavení v čekárně živé hry. Je v toku stránky (nikdy
 * nepřekrývá QR ani kód), výchozí zavřená; zavře se po výběru, Esc a klepnutím mimo.
 */
export function LobbySettingsSection({ title, summary, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="mx-auto w-full max-w-md text-left rounded-xl border border-border bg-card shadow-sm">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 break-words">
          <span className="font-semibold">{title}:</span> {summary}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={id} className="space-y-3 border-t border-border p-3">
          {children(close)}
        </div>
      )}
    </div>
  );
}
