import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SourceInput from "@/components/sources/SourceInput";
import AiContentBadge from "@/components/ai/AiContentBadge";
import ActivityCatalog from "@/components/presentation/ActivityCatalog";
import MyLessonActivitiesList from "@/components/presentation/MyLessonActivitiesList";
import ActivityEditor from "@/components/activities/editor/ActivityEditor";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import { ActivityContentEditor } from "@/components/admin/block-editors/ActivityBlock";
import { supabase } from "@/integrations/supabase/client";
import { useSourceBundle } from "@/lib/use-source-bundle";
import { activityBlockToSlide } from "@/lib/plan-to-slides";
import { cloneStudioSlide } from "@/lib/presentation-activity-sources";
import { activityModelFromSlide, applyActivityModelToSlide, type ActivityModel } from "@/lib/activity-model";
import { activityMissing } from "@/lib/activity-completeness";
import { draftStepsToSlides, stepsFromAi, type DraftStepType } from "@/lib/fromtext-slides";
import { uploadWorksheetImage } from "@/lib/worksheet-images";
import { stepTypeInfo } from "@/lib/studio-step";

export type ActivityInsertTarget = "slide" | "new";
type SourcePath = "new" | "material" | "lesson" | "studio";

const PATHS: { id: SourcePath; label: string }[] = [
  { id: "new", label: "Vytvořit novou" },
  { id: "material", label: "Navrhnout z mého materiálu" },
  { id: "lesson", label: "Z lekce" },
  { id: "studio", label: "Ze Studia a knihovny" },
];

export default function InsertActivityDialog({ open, onOpenChange, onInsert, themeId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (slide: any, target: ActivityInsertTarget) => void;
  themeId: string;
}) {
  const [path, setPath] = useState<SourcePath>("new");
  const [draft, setDraft] = useState<any>(null);
  const [target, setTarget] = useState<ActivityInsertTarget>("new");
  const [aiType, setAiType] = useState<DraftStepType>("mcq");
  const [generating, setGenerating] = useState(false);
  const bundle = useSourceBundle("teacher", (message) => toast.error(message));
  const model = draft ? activityModelFromSlide(draft) : null;
  const missing = draft ? activityMissing(draft.activitySpec) : [];

  const generate = async () => {
    if (!bundle.state.ok) { toast.error(bundle.state.message || "Zdroje nejsou připravené."); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-activity-from-text", { body: { text: bundle.state.text, types: [aiType], count: 1 } });
      if (error) {
        let message = error.message;
        try { message = (await (error as any).context?.json?.())?.error || message; } catch { /* původní hláška */ }
        throw new Error(message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const slides = draftStepsToSlides(stepsFromAi(data));
      if (!slides.length) throw new Error("AI nevrátila použitelnou aktivitu. Zkuste upravit materiál nebo typ.");
      setDraft(slides[0]);
      toast.success("Návrh je hotový. Před vložením ho zkontrolujte.");
    } catch (error: any) { toast.error(error?.message || "Aktivitu se nepodařilo navrhnout."); }
    finally { setGenerating(false); }
  };

  const changeModel = (next: ActivityModel) => {
    if (!draft) return;
    const updated = applyActivityModelToSlide(draft, next);
    if (draft.ai_generated) updated.ai_modified_at = new Date().toISOString();
    setDraft(updated);
  };

  const uploadImage = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    return uploadWorksheetImage(file, user?.id);
  };

  const insert = () => {
    if (!draft) return;
    onInsert(draft, target);
    onOpenChange(false);
    setDraft(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-w-6xl flex-col gap-0 overflow-hidden border-deck-line bg-deck-cream p-0 font-deck-body">
        <DialogHeader className="border-b border-deck-line bg-deck-panel px-5 py-4 text-left">
          <DialogTitle className="font-deck-heading text-xl uppercase tracking-wide text-deck-violet">Vložit aktivitu</DialogTitle>
          <DialogDescription>Vyberte zdroj, upravte obsah a zkontrolujte živý náhled. Do prezentace se vloží až po potvrzení.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-h-0 overflow-y-auto bg-deck-panel p-4">
            <div role="tablist" aria-label="Zdroj nové aktivity" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-deck-soft p-1 xl:grid-cols-4">
              {PATHS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={path === item.id} onClick={() => setPath(item.id)} className={`min-h-11 rounded-lg px-2 py-2 text-xs font-semibold ${path === item.id ? "bg-deck-violet text-deck-on-violet" : "text-deck-violet-deep hover:bg-deck-panel"}`}>{item.label}</button>)}
            </div>
            {path === "new" && <ActivityCatalog onPick={(preset) => setDraft(preset.build())} />}
            {path === "material" && <div className="space-y-4">
              <SourceInput bundle={bundle} disabled={generating} />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div><Label htmlFor="activity-ai-type">Typ návrhu</Label><Select value={aiType} onValueChange={(value) => setAiType(value as DraftStepType)}><SelectTrigger id="activity-ai-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mcq">Kvíz</SelectItem><SelectItem value="true_false">Pravda / nepravda</SelectItem><SelectItem value="open">Otevřená otázka</SelectItem></SelectContent></Select></div>
                <Button className="min-h-11 gap-2 bg-deck-violet text-deck-on-violet hover:bg-deck-violet-deep" disabled={generating || !bundle.state.ok} onClick={() => void generate()}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Navrhnout aktivitu</Button>
              </div>
              <p className="text-xs text-deck-muted">Materiál se neukládá. AI vytvoří koncept, který před vložením upravíte a schválíte.</p>
            </div>}
            {path === "lesson" && <MyLessonActivitiesList onPick={(item) => setDraft(activityBlockToSlide(item.block))} />}
            {path === "studio" && <MyLessonActivitiesList defaultTab="studio" onPick={(item) => setDraft(activityBlockToSlide(item.block))} onPickStudio={(item) => setDraft(cloneStudioSlide(item.slide))} />}
          </div>
          <aside className="min-h-0 overflow-y-auto border-t border-deck-line bg-deck-cream p-4 lg:border-l lg:border-t-0" aria-label="Náhled a nastavení aktivity">
            {draft && model ? <div className="space-y-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Živý náhled</h3><AiContentBadge aiGenerated={draft.ai_generated} aiModifiedAt={draft.ai_modified_at} /></div>
              <SlidePreviewFrame slide={draft} themeId={themeId} label="Živý náhled aktivity" />
              {missing.length > 0 && <p role="status" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-deck-ink">Před spuštěním doplňte: {missing.join(", ")}.</p>}
              <ActivityEditor model={model} onChange={changeModel} context="presentation" scored={stepTypeInfo(String(draft.activitySpec?.activityType)).scored || draft.activitySpec?.activityType === "quiz"} onUploadImage={uploadImage} renderLegacyContent={(content, onChange) => <ActivityContentEditor activityType={String(draft.activitySpec?.activityType)} props={content} onChange={onChange} />} />
              <div className="space-y-2 border-t border-deck-line pt-4"><Label>Kam vložit</Label><div role="radiogroup" aria-label="Kam vložit aktivitu z dialogu" className="grid grid-cols-2 gap-1 rounded-lg bg-deck-soft p-1">{([["slide", "Na aktuální slide"], ["new", "Na nový slide"]] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={target === value} onClick={() => setTarget(value)} className={`min-h-11 rounded-md px-2 text-xs font-semibold ${target === value ? "bg-deck-violet text-deck-on-violet" : "text-deck-violet-deep"}`}>{label}</button>)}</div><Button className="min-h-11 w-full bg-deck-violet text-deck-on-violet hover:bg-deck-violet-deep" onClick={insert}>Vložit aktivitu</Button></div>
            </div> : <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-deck-line bg-deck-panel p-6 text-center"><Sparkles className="mb-3 h-8 w-8 text-deck-violet" /><h3 className="font-deck-heading text-lg uppercase text-deck-violet-deep">Náhled a nastavení</h3><p className="mt-2 text-sm text-deck-muted">Vyberte typ, lekci nebo aktivitu ze Studia, případně nechte AI navrhnout obsah.</p></div>}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
