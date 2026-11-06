import { useEffect, useRef, useState } from "react";

/**
 * Ovládání viditelné, dokud se uživatel hýbe; po `delayMs` nečinnosti se skryje.
 * Neskrývá se, pokud je zaměřen prvek uvnitř `containerRef` (klávesnice).
 */
export function useIdleChrome(enabled = true, delayMs = 3000, containerRef?: React.RefObject<HTMLElement>) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) { setVisible(true); return; }
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const el = containerRef?.current;
        const active = document.activeElement;
        if (el && active && el.contains(active) && active !== document.body) {
          schedule();
          return;
        }
        setVisible(false);
      }, delayMs);
    };
    const wake = () => { setVisible(true); schedule(); };
    const events = ["mousemove", "pointerdown", "touchstart", "keydown", "focusin"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    schedule();
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, delayMs, containerRef]);

  return visible;
}
