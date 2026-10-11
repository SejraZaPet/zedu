import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Check, Clock, Send } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Prezentační tlačítka formuláře úkolu. U už publikované úlohy zobrazí jen
 * "Uložit změny" (status se nemění), u konceptu/naplánované původní tři akce.
 * Veškerá logika ukládání zůstává v nadřazené stránce (TeacherAssignments).
 */
interface Props {
  isEditingPublished: boolean;
  creating: boolean;
  canSchedule: boolean;
  onSaveDraft: () => void;
  onSchedule: () => void;
  onPublish: () => void;
  onCancel: () => void;
}

const AssignmentFormActions = ({
  isEditingPublished,
  creating,
  canSchedule,
  onSaveDraft,
  onSchedule,
  onPublish,
  onCancel,
}: Props) => {
  const spinner = <Loader2 className="w-4 h-4 mr-2 animate-spin" />;
  const scheduleBtn = (
    <Button onClick={onSchedule} disabled={creating || !canSchedule}>
      {creating ? spinner : <Clock className="w-4 h-4 mr-2" />}
      Naplánovat
    </Button>
  );
  const scheduleWithTooltip = canSchedule ? (
    scheduleBtn
  ) : (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">{scheduleBtn}</span>
        </TooltipTrigger>
        <TooltipContent>Nejdřív vyber datum a čas</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isEditingPublished ? (
        <Button onClick={onPublish} disabled={creating}>
          {creating ? spinner : <Check className="w-4 h-4 mr-2" />}
          Uložit změny
        </Button>
      ) : (
        <>
          <Button onClick={onSaveDraft} disabled={creating}>
            {creating ? spinner : <Pencil className="w-4 h-4 mr-2" />}
            Uložit koncept
          </Button>
          {scheduleWithTooltip}
          <Button onClick={onPublish} disabled={creating}>
            {creating ? spinner : <Send className="w-4 h-4 mr-2" />}
            Publikovat
          </Button>
        </>
      )}
      <Button variant="outline" onClick={onCancel}>Zrušit</Button>
      {isEditingPublished && (
        <p className="w-full text-xs text-muted-foreground">
          Úkol je publikovaný, změny se projeví žákům hned po uložení.
        </p>
      )}
    </div>
  );
};

export default AssignmentFormActions;
