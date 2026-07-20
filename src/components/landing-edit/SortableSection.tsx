import { type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import EditableSectionWrapper from "./EditableSectionWrapper";
import type { LandingSectionRow } from "@/hooks/useLandingSections";

interface Props {
  section: LandingSectionRow;
  onDelete: () => void;
  children: ReactNode;
}

export default function SortableSection({ section, onDelete, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <EditableSectionWrapper
        section={section}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners } as any}
      >
        {children}
      </EditableSectionWrapper>
    </div>
  );
}
