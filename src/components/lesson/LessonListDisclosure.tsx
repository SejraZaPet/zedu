import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Presentation only: callers keep the complete filtered list and own data loading. */
export function useLessonListDisclosure<T>(lessons: T[]) {
  const [expanded, setExpanded] = useState(false);
  return {
    visible: expanded ? lessons : lessons.slice(0, 5),
    expanded,
    total: lessons.length,
    toggle: () => setExpanded((value) => !value),
    className: expanded ? "space-y-2 max-h-[70vh] overflow-y-auto" : "space-y-2",
  };
}

export function LessonListDisclosure({ total, expanded, toggle }: {
  total: number;
  expanded: boolean;
  toggle: () => void;
}) {
  if (total <= 5) return null;
  const Icon = expanded ? ChevronUp : ChevronDown;
  return (
    <Button type="button" variant="ghost" className="mt-2 min-h-11" aria-expanded={expanded} onClick={toggle}>
      <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
      {expanded ? "Zobrazit méně" : `Ukázat vše (${total})`}
    </Button>
  );
}