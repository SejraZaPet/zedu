import { useState, type ReactNode } from "react";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import { useLandingEditMode } from "@/contexts/LandingEditModeContext";
import type { LandingSectionRow } from "@/hooks/useLandingSections";
import { SECTION_TYPE_LABELS } from "@/components/admin/landing/section-editors";
import { SectionProvider } from "./SectionContext";
import { cn } from "@/lib/utils";

interface Props {
  section: LandingSectionRow;
  children: ReactNode;
  onDelete?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export default function EditableSectionWrapper({ section, children, onDelete, dragHandleProps }: Props) {
  const { isEditMode, openPanel, isDirty } = useLandingEditMode();
  const [hover, setHover] = useState(false);

  if (!isEditMode) return <SectionProvider section={section}>{children}</SectionProvider>;

  const dirty = isDirty(section.id);

  return (
    <div
      className={cn(
        "relative transition-all",
        "outline-dashed outline-2 outline-offset-[-2px]",
        dirty ? "outline-primary" : hover ? "outline-primary/50" : "outline-transparent",
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-section-id={section.id}
    >
      {/* Section toolbar */}
      <div
        className={cn(
          "absolute top-2 right-2 z-30 flex items-center gap-1 rounded-lg bg-background/95 backdrop-blur border border-border shadow-md p-1 transition-opacity",
          hover ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <span className="text-xs font-medium text-muted-foreground px-2">
          {SECTION_TYPE_LABELS[section.section_type] ?? section.section_type}
          {dirty && <span className="ml-1 text-primary">•</span>}
        </span>
        {dragHandleProps && (
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
            aria-label="Přesunout sekci"
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          className="p-1.5 rounded hover:bg-muted"
          aria-label="Upravit sekci"
          onClick={() => openPanel(section.id)}
        >
          <Pencil className="w-4 h-4" />
        </button>
        {onDelete && (
          <button
            type="button"
            className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
            aria-label="Smazat sekci"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <SectionProvider section={section}>{children}</SectionProvider>
    </div>
  );
}
