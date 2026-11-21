import { useLayoutEffect, useState, type RefObject } from "react";

type Placement = { side: "top" | "bottom"; maxHeight: number };

/** Drží nabídku ve visualViewport, tedy i nad zobrazenou mobilní klávesnicí. */
export function usePopoverListPlacement(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  reservedHeight = 52,
): Placement {
  const [placement, setPlacement] = useState<Placement>({ side: "bottom", maxHeight: 300 });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = viewportTop + viewportHeight - rect.bottom - 16;
      const above = rect.top - viewportTop - 16;
      const side = below >= 180 || below >= above ? "bottom" : "top";
      const available = side === "bottom" ? below : above;
      setPlacement({ side, maxHeight: Math.max(44, Math.min(300, available - reservedHeight)) });
    };

    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, reservedHeight, triggerRef]);

  return placement;
}
