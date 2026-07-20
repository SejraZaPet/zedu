import { Save, X, Undo2, Loader2 } from "lucide-react";
import { useLandingEditMode } from "@/contexts/LandingEditModeContext";
import { Button } from "@/components/ui/button";

export default function EditModeFloatingBar() {
  const { isEditMode, exitEditMode, dirtyCount, saveAll, discardAll, saving } = useLandingEditMode();

  if (!isEditMode) return null;

  const handleExit = () => {
    if (dirtyCount > 0) {
      const ok = window.confirm("Máte neuložené změny. Opravdu ukončit editaci a zahodit je?");
      if (!ok) return;
      discardAll();
    }
    exitEditMode();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-background/95 backdrop-blur border border-border shadow-2xl px-3 py-2">
      <div className="text-sm px-2">
        {dirtyCount === 0 ? (
          <span className="text-muted-foreground">Režim úprav</span>
        ) : (
          <span className="font-medium">
            {dirtyCount} {dirtyCount === 1 ? "neuložená změna" : dirtyCount < 5 ? "neuložené změny" : "neuložených změn"}
          </span>
        )}
      </div>
      <Button size="sm" variant="ghost" onClick={discardAll} disabled={dirtyCount === 0 || saving}>
        <Undo2 className="w-4 h-4 mr-1" /> Zrušit
      </Button>
      <Button size="sm" onClick={saveAll} disabled={dirtyCount === 0 || saving}>
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Uložit změny
      </Button>
      <Button size="sm" variant="outline" onClick={handleExit} disabled={saving}>
        <X className="w-4 h-4 mr-1" /> Ukončit
      </Button>
    </div>
  );
}
