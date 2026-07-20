import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SECTION_EDITORS, SECTION_TYPE_LABELS } from "./section-editors";
import { DEFAULT_PROPS_BY_TYPE } from "@/lib/landing-defaults";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionType: string;
  initialProps: Record<string, any> | null;
  onSave: (nextProps: Record<string, any>) => Promise<void> | void;
  saving?: boolean;
}

export function LandingSectionEditorDialog({ open, onOpenChange, sectionType, initialProps, onSave, saving }: Props) {
  const Editor = SECTION_EDITORS[sectionType];
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    if (open) {
      // Snapshot into local state so Cancel really discards changes.
      const base = DEFAULT_PROPS_BY_TYPE[sectionType] ?? {};
      setDraft({ ...base, ...(initialProps ?? {}) });
    }
  }, [open, sectionType, initialProps]);

  const handleSave = async () => {
    await onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upravit sekci — {SECTION_TYPE_LABELS[sectionType] ?? sectionType}</DialogTitle>
        </DialogHeader>
        {Editor ? (
          <Editor value={draft} onChange={setDraft} />
        ) : (
          <p className="text-sm text-muted-foreground">Pro tento typ zatím neexistuje editor.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Zrušit
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Ukládám…" : "Uložit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
