import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation-templates";
import { LayoutTemplate } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (slides: any[]) => void;
}

const StartFromTemplateDialog = ({ open, onOpenChange, onPick }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4" /> Začít od šablony
        </DialogTitle>
        <DialogDescription>
          Vyberte startovní strukturu prezentace. Slidy se vytvoří prázdné, obsah doplníte sami.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESENTATION_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onPick(t.build());
              onOpenChange(false);
            }}
            className="rounded-lg border-2 border-border hover:border-primary hover:bg-muted/40 transition-colors p-3 text-left"
          >
            <div className="text-sm font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
          </button>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

export default StartFromTemplateDialog;
