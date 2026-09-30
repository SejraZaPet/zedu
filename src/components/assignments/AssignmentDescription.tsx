import { cn } from "@/lib/utils";
import { sanitizeAssignmentDescription } from "@/lib/assignment-description";

interface Props {
  description: string;
  className?: string;
}

const AssignmentDescription = ({ description, className }: Props) => (
  <div
    className={cn(
      "break-words text-sm leading-relaxed text-foreground [&_p]:mb-2 [&_p:last-child]:mb-0",
      className,
    )}
    dangerouslySetInnerHTML={{ __html: sanitizeAssignmentDescription(description) }}
  />
);

export default AssignmentDescription;