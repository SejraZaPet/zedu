import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SECTION_TYPE_LABELS } from "./section-editors";
import type { LandingSectionRow } from "@/hooks/useLandingSections";

interface Props {
  section: LandingSectionRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

export function SortableSectionCard({ section, onEdit, onDelete, onToggleEnabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Přesunout sekci"
        type="button"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {SECTION_TYPE_LABELS[section.section_type] ?? section.section_type}
        </div>
        <div className="text-xs text-muted-foreground">
          Pořadí #{section.order_index} · typ <code className="text-[10px]">{section.section_type}</code>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={section.enabled} onCheckedChange={onToggleEnabled} />
          {section.enabled ? "Aktivní" : "Skrytá"}
        </label>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-1" /> Upravit
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
