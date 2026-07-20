import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useLandingEditMode } from "@/contexts/LandingEditModeContext";
import { SECTION_EDITORS, SECTION_TYPE_LABELS } from "@/components/admin/landing/section-editors";
import { DEFAULT_PROPS_BY_TYPE } from "@/lib/landing-defaults";
import type { LandingSectionRow } from "@/hooks/useLandingSections";

interface Props {
  /** All sections currently rendered on the page (in order). */
  sections: LandingSectionRow[];
}

/**
 * Side panel that hosts the full SECTION_EDITORS UI for the currently active section.
 * Writes go into the draft — the user still saves through the floating bar.
 */
export default function LandingEditSidePanel({ sections }: Props) {
  const { activePanelSectionId, closePanel, getEffectiveProps, setDraftProps } = useLandingEditMode();

  const section = useMemo(
    () => sections.find((s) => s.id === activePanelSectionId) ?? null,
    [sections, activePanelSectionId],
  );

  const open = !!section;
  const Editor = section ? SECTION_EDITORS[section.section_type] : null;

  // Merge defaults with current effective (draft-aware) props for a stable editor value.
  const value = useMemo(() => {
    if (!section) return {};
    const base = DEFAULT_PROPS_BY_TYPE[section.section_type] ?? {};
    return { ...base, ...getEffectiveProps(section) };
  }, [section, getEffectiveProps]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closePanel()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {section ? `Upravit — ${SECTION_TYPE_LABELS[section.section_type] ?? section.section_type}` : "Upravit sekci"}
          </SheetTitle>
          <SheetDescription>
            Změny se projeví ihned v náhledu. Ulož je tlačítkem „Uložit změny" v dolní liště.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {section && Editor ? (
            <Editor value={value} onChange={(next) => setDraftProps(section.id, next)} />
          ) : section ? (
            <p className="text-sm text-muted-foreground">Pro tento typ zatím neexistuje editor.</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
