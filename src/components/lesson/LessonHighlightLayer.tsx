import { useCallback, useEffect, useRef, useState } from "react";
import { Highlighter, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLessonHighlights, type LessonSource } from "@/hooks/useLessonHighlights";

interface Props {
  lessonId: string | undefined;
  lessonSource: LessonSource;
  /** Změna této hodnoty znovu použije zvýraznění na obsah (např. po přepnutí lekce). */
  contentKey?: string;
  children: React.ReactNode;
  className?: string;
}

const HIGHLIGHT_CLASS =
  "rounded-[2px] bg-yellow-200/80 px-0.5 text-foreground cursor-pointer dark:bg-yellow-400/40";

type Pending = { blockId: string; text: string; x: number; y: number };
type Active = { id: string; x: number; y: number };

/**
 * Zvýrazňování a poznámky v textu lekce. Obalí obsah lekce, zachytí výběr textu
 * uvnitř bloků s atributem `data-highlight-block` a po načtení znovu obarví
 * uložené úryvky (best-effort hledání shody v rámci bloku).
 */
const LessonHighlightLayer = ({ lessonId, lessonSource, contentKey, children, className }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { highlights, addHighlight, updateNote, removeHighlight } = useLessonHighlights(lessonId, lessonSource);
  const [pending, setPending] = useState<Pending | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [activeNoteDraft, setActiveNoteDraft] = useState("");

  const activeHighlight = active ? highlights.find((h) => h.id === active.id) ?? null : null;

  // --- Znovu obarvení uložených zvýraznění ---
  const applyHighlights = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    // Nejdřív odstraň dřívější obarvení
    root.querySelectorAll("mark[data-lesson-highlight]").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    });

    for (const h of highlights) {
      const block = root.querySelector(`[data-highlight-block="${CSS.escape(h.block_id)}"]`);
      if (!block) continue;
      const needle = h.selected_text.trim();
      if (!needle) continue;

      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const text = node.textContent || "";
        const idx = text.indexOf(needle);
        if (idx >= 0 && node.parentElement?.tagName !== "MARK") {
          const target = node as Text;
          const after = target.splitText(idx);
          after.splitText(needle.length);
          const mark = document.createElement("mark");
          mark.setAttribute("data-lesson-highlight", h.id);
          mark.className = HIGHLIGHT_CLASS;
          if (h.note) mark.setAttribute("title", "Poznámka – klikni pro zobrazení");
          mark.textContent = after.textContent || "";
          after.parentNode?.replaceChild(mark, after);
          break;
        }
        node = walker.nextNode();
      }
    }
  }, [highlights]);

  useEffect(() => {
    const t = window.setTimeout(applyHighlights, 0);
    return () => window.clearTimeout(t);
  }, [applyHighlights, contentKey]);

  // --- Výběr textu myší ---
  const handleMouseUp = () => {
    if (!lessonId) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length < 3) return;
    const anchorEl =
      selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode?.parentElement ?? null;
    const block = anchorEl?.closest("[data-highlight-block]") as HTMLElement | null;
    if (!block) return;
    if (block.querySelector("mark[data-lesson-highlight]") && selection.toString().includes("\n")) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setActive(null);
    setNoteDraft(null);
    setPending({
      blockId: block.dataset.highlightBlock || "",
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  // --- Klik na zvýrazněný text ---
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const mark = target?.closest("mark[data-lesson-highlight]") as HTMLElement | null;
      if (!mark) return;
      e.preventDefault();
      const rect = mark.getBoundingClientRect();
      const id = mark.getAttribute("data-lesson-highlight") || "";
      setPending(null);
      setActive({ id, x: rect.left + rect.width / 2, y: rect.top });
      setActiveNoteDraft(highlights.find((h) => h.id === id)?.note ?? "");
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [highlights]);

  const save = async (note?: string | null) => {
    if (!pending) return;
    const created = await addHighlight(pending.blockId, pending.text, note ?? null);
    if (!created) {
      toast.error("Zvýraznění se nepodařilo uložit. Zkus to prosím znovu.");
      return;
    }
    window.getSelection()?.removeAllRanges();
    setPending(null);
    setNoteDraft(null);
    toast.success(note ? "Poznámka uložena" : "Zvýrazněno");
  };

  return (
    <div className={className}>
      <div ref={containerRef} onMouseUp={handleMouseUp}>
        {children}
      </div>

      {pending && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover p-2 shadow-lg"
          style={{ left: pending.x, top: Math.max(pending.y - 8, 56) }}
        >
          {noteDraft === null ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => save(null)}>
                <Highlighter className="h-4 w-4" /> Zvýraznit
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setNoteDraft("")}>
                <StickyNote className="h-4 w-4" /> Přidat poznámku
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Zavřít"
                onClick={() => {
                  setPending(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-64 space-y-2">
              <Textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Tvoje poznámka k označenému textu…"
                className="min-h-[70px] text-sm"
              />
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setNoteDraft(null)}>
                  Zrušit
                </Button>
                <Button size="sm" onClick={() => save(noteDraft)}>
                  Uložit
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {active && activeHighlight && (
        <div
          className="fixed z-50 w-72 -translate-x-1/2 -translate-y-full space-y-2 rounded-lg border border-border bg-popover p-3 shadow-lg"
          style={{ left: active.x, top: Math.max(active.y - 8, 56) }}
        >
          <p className="text-xs italic text-muted-foreground">„{activeHighlight.selected_text}“</p>
          <Textarea
            value={activeNoteDraft}
            onChange={(e) => setActiveNoteDraft(e.target.value)}
            placeholder="Bez poznámky – můžeš ji napsat tady."
            className="min-h-[70px] text-sm"
          />
          <div className="flex items-center justify-between gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive"
              onClick={async () => {
                const ok = await removeHighlight(activeHighlight.id);
                if (!ok) {
                  toast.error("Smazání se nepovedlo.");
                  return;
                }
                setActive(null);
                toast.success("Zvýraznění smazáno");
              }}
            >
              <Trash2 className="h-4 w-4" /> Smazat
            </Button>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setActive(null)}>
                Zavřít
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await updateNote(activeHighlight.id, activeNoteDraft);
                  if (!ok) {
                    toast.error("Poznámku se nepodařilo uložit.");
                    return;
                  }
                  setActive(null);
                  toast.success("Poznámka uložena");
                }}
              >
                Uložit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonHighlightLayer;
