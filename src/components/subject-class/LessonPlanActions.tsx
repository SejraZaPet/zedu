import type { ReactNode } from "react";
import { FileText, Link2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  hasPlan: boolean;
  dateLabel: string;
  /** Ikony propojených materiálů plánu. */
  icons?: ReactNode;
  onOpen: () => void;
  onAssign: () => void;
  onNew: () => void;
  onUnlink: () => void;
}

/** Sdílené ovládání plánu u hodiny (budoucí i proběhlé): Otevřít/Změnit nebo Přiřadit/Nový. */
export default function LessonPlanActions({ hasPlan, dateLabel, icons, onOpen, onAssign, onNew, onUnlink }: Props) {
  if (!hasPlan) {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" className="min-h-[44px] sm:min-h-0" onClick={onAssign} aria-label={`Přiřadit plán hodiny ${dateLabel}`}>
          <Link2 className="h-3.5 w-3.5 mr-1" />Přiřadit
        </Button>
        <Button size="sm" variant="ghost" className="min-h-[44px] sm:min-h-0" onClick={onNew} aria-label={`Nový plán hodiny ${dateLabel}`}>
          <Plus className="h-3.5 w-3.5 mr-1" />Nový
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {icons}
      <Button size="sm" variant="ghost" className="min-h-[44px] sm:min-h-0" onClick={onOpen}>
        <FileText className="h-3.5 w-3.5 mr-1" />Otevřít
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="min-h-[44px] sm:min-h-0" aria-label={`Změnit plán hodiny ${dateLabel}`}>
            <Pencil className="h-3.5 w-3.5 mr-1" />Změnit
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-[44px]" onSelect={onAssign}><Link2 className="h-3.5 w-3.5 mr-2" />Přiřadit jiný plán</DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px]" onSelect={onNew}><Plus className="h-3.5 w-3.5 mr-2" />Nový plán</DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px] text-destructive" onSelect={onUnlink}><X className="h-3.5 w-3.5 mr-2" />Odebrat plán z hodiny</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
