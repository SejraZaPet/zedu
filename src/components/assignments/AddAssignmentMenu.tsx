import { Plus, ClipboardList, BookOpen, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { KIND_LABELS, type AssignmentKind } from "@/lib/assignment-kind";

const ICONS = { task: ClipboardList, material: BookOpen, announcement: Megaphone };

/** Tlačítko „Přidat“ s volbou Úkol / Materiál / Oznámení. */
const AddAssignmentMenu = ({ onPick, size = "sm" }: { onPick: (k: AssignmentKind) => void; size?: "sm" | "default" }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size={size} className="min-h-11"><Plus className="h-4 w-4 mr-1" aria-hidden />Přidat</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {(Object.keys(KIND_LABELS) as AssignmentKind[]).map((k) => {
        const Icon = ICONS[k];
        return <DropdownMenuItem key={k} className="min-h-11 gap-2 cursor-pointer" onSelect={() => onPick(k)}>
          <Icon className="h-4 w-4" aria-hidden />{KIND_LABELS[k]}
        </DropdownMenuItem>;
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default AddAssignmentMenu;
