import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { BookOpen, FilePlus2, LayoutTemplate, Plus, Puzzle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type SlideInsertKind = "blank" | "template" | "activity" | "lesson";

export default function SlideInsertMenu({
  index,
  onPick,
  trigger,
}: {
  /** Index, na který se nový obsah vloží. */
  index: number;
  onPick: (kind: SlideInsertKind, index: number) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openFromTrigger = () => setOpen(true);
  const defaultTrigger = (
    <button type="button" onClickCapture={openFromTrigger} className="deck-transition-gap-button" aria-label={`Vložit slide mezi ${index} a ${index + 1}`} title="Vložit slide na toto místo">
      <Plus className="h-4 w-4" />
    </button>
  );
  const renderedTrigger = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<any>, { onClickCapture: (event: any) => { (trigger as any).props?.onClickCapture?.(event); openFromTrigger(); } })
    : defaultTrigger;
  const pick = (kind: SlideInsertKind) => { onPick(kind, index); setOpen(false); };
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{renderedTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="z-[130] w-56 border-deck-line bg-deck-panel font-deck-body text-deck-ink">
        <DropdownMenuLabel className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Vložit na pozici {index + 1}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => pick("blank")}><FilePlus2 className="mr-2 h-4 w-4" />Prázdný slide</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => pick("template")}><LayoutTemplate className="mr-2 h-4 w-4" />Ze šablony</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => pick("activity")}><Puzzle className="mr-2 h-4 w-4" />Aktivita</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => pick("lesson")}><BookOpen className="mr-2 h-4 w-4" />Z lekce nebo prezentace</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
