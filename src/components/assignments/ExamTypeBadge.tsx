import { Badge } from "@/components/ui/badge";
import { getExamTypeMeta } from "@/lib/exam-types";
import { cn } from "@/lib/utils";

interface Props {
  examType?: string | null;
  /** When true, render even for the default 'ukol' type */
  showDefault?: boolean;
  className?: string;
}

export function ExamTypeBadge({ examType, showDefault = false, className }: Props) {
  if (!examType && !showDefault) return null;
  const meta = getExamTypeMeta(examType);
  const Icon = meta.icon;
  return (
    <Badge className={cn(meta.badgeClass, "text-xs gap-1 border-0", className)}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
}

export default ExamTypeBadge;
