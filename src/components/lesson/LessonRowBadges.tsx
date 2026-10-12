import { ClipboardList, ListChecks, Paperclip } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { assignmentLabel, pluralAttachments, worksheetLabel, type RowBadges } from "@/lib/lesson-row-badges";

function Item({ label, children, testId }: { label: string; children: React.ReactNode; testId: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={label}
          data-testid={testId}
          className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] opacity-80"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Drobné ikonky u řádku hodiny; nic nevykreslí, když k hodině nic není. */
export default function LessonRowBadges({ badges }: { badges: RowBadges }) {
  if (!badges.attachments && !badges.worksheets && !badges.assignment) return null;
  return (
    <TooltipProvider>
      <span className="inline-flex items-center gap-1">
        {badges.attachments > 0 && (
          <Item label={pluralAttachments(badges.attachments)} testId="badge-attachments">
            <Paperclip className="h-3 w-3" aria-hidden />
            {badges.attachments}
          </Item>
        )}
        {badges.worksheets > 0 && (
          <Item label={worksheetLabel(badges.worksheets)} testId="badge-worksheets">
            <ClipboardList className="h-3 w-3" aria-hidden />
            {badges.worksheets > 1 ? badges.worksheets : null}
          </Item>
        )}
        {badges.assignment && (
          <Item label={assignmentLabel(badges.assignment.deadline)} testId="badge-assignment">
            <ListChecks className="h-3 w-3" aria-hidden />
          </Item>
        )}
      </span>
    </TooltipProvider>
  );
}

export const TODAY_ROW_CLASS = "bg-gradient-brand text-primary-foreground border-transparent [&_.text-muted-foreground]:text-primary-foreground/85";
