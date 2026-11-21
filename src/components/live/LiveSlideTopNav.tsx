import { useState } from "react";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClassroomToolsOverlay, classroomTools, type ClassroomToolRequest } from "@/components/classroom/ClassroomToolsOverlay";

/** Kláves/cíl, který nemá posouvat slidy (psaní do polí, editory). */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/** Klávesa → směr posunu slidu (šipky, PageUp/PageDown). */
export function slideKeyDirection(key: string): -1 | 1 | 0 {
  if (key === "ArrowRight" || key === "PageDown") return 1;
  if (key === "ArrowLeft" || key === "PageUp") return -1;
  return 0;
}

/**
 * Horní lišta promítání: Předchozí / číslo slidu / Další a nástroje do hodiny.
 * Stejná pro každou prezentaci (vytvořenou i generovanou z lekce).
 */
export default function LiveSlideTopNav({
  index, total, onPrev, onNext,
}: { index: number; total: number; onPrev: () => void; onNext: () => void }) {
  const [tool, setTool] = useState<ClassroomToolRequest | null>(null);
  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  return (
    <div
      role="toolbar"
      aria-label="Ovládání promítání"
      className="sticky top-0 z-30 -mx-6 flex items-center gap-2 border-b border-border bg-background/95 px-6 py-2 font-deck-body backdrop-blur"
    >
      <Button size="sm" variant="outline" className="min-h-11 gap-1" disabled={atStart} onClick={onPrev} aria-label="Předchozí slide">
        <ChevronLeft className="h-4 w-4" /> Předchozí
      </Button>
      <span className="min-w-[5.5rem] rounded-full bg-deck-cream px-3 py-1 text-center font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep" aria-live="polite">
        {Math.max(1, index + 1)} / {total}
      </span>
      <Button size="sm" className="min-h-11 gap-1 border-0 bg-deck-violet text-primary-foreground hover:bg-deck-violet-deep" disabled={atEnd} onClick={onNext} aria-label="Další slide">
        Další <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="min-h-11 gap-1.5 border-deck-teal">
              <Wrench className="h-4 w-4" /> Nástroje do hodiny
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {classroomTools.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => setTool({ id: t.id })} className="gap-2">
                <t.icon className="h-4 w-4" /> {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ClassroomToolsOverlay request={tool} onClose={() => setTool(null)} />
    </div>
  );
}
