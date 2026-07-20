import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SECTION_TYPE_LABELS } from "./section-editors";
import type { LandingSectionType } from "@/hooks/useLandingSections";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: LandingSectionType) => void;
  /** Types already present (can still be added — landing supports duplicates, but we warn). */
  existingTypes?: string[];
}

const TYPES: LandingSectionType[] = [
  "hero",
  "social_proof",
  "features_grid",
  "how_it_works",
  "for_whom",
  "platform_showcase",
  "podcast",
  "final_cta",
];

export function AddSectionDialog({ open, onOpenChange, onPick, existingTypes = [] }: Props) {
  const [type, setType] = useState<LandingSectionType>("features_grid");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přidat sekci</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Typ sekce</Label>
          <Select value={type} onValueChange={(v) => setType(v as LandingSectionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SECTION_TYPE_LABELS[t]}
                  {existingTypes.includes(t) && " (již přidáno)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Sekce se vytvoří s výchozím obsahem a přidá se na konec seznamu. Obsah pak upravíte tlačítkem „Upravit".
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button
            onClick={() => {
              onPick(type);
              onOpenChange(false);
            }}
          >
            Přidat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
