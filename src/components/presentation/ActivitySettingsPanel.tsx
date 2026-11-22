import type { ReactNode } from "react";
import { AlertTriangle, FileDown, Monitor, Sparkles, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { activityTypeLabel } from "@/lib/presentation-activity";
import { activityMissing } from "@/lib/activity-completeness";
import ActivityEditor from "@/components/activities/editor/ActivityEditor";
import { ActivityContentEditor } from "@/components/admin/block-editors/ActivityBlock";
import { activityModelFromSlide, applyActivityModelToSlide, type ActivityModel } from "@/lib/activity-model";
import { stepTypeInfo } from "@/lib/studio-step";

/** Pravý panel prezentace: sdílený editor + akce a poznámky specifické pro slide. */
export default function ActivitySettingsPanel({
  slide, onSlideChange, settings, autoFocus, onPrint, printing, onLaunch, onClose,
  teacherNotes = "", onTeacherNotesChange,
}: {
  slide: any;
  onSlideChange: (next: any) => void;
  settings?: ReactNode;
  autoFocus?: boolean;
  onPrint: () => void;
  printing?: boolean;
  onLaunch: () => void;
  onClose: () => void;
  teacherNotes?: string;
  onTeacherNotesChange?: (notes: string) => void;
}) {
  const spec = slide?.activitySpec ?? {};
  const at = String(spec.activityType ?? "");
  const missing = activityMissing(spec);
  const model = activityModelFromSlide(slide);
  const changeModel = (next: ActivityModel) => onSlideChange(applyActivityModelToSlide(slide, next));
  return (
    <aside aria-label="Vlastnosti aktivity" className="deck-properties-panel" data-testid="activity-properties">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[11px] text-deck-muted">Vlastnosti</p><h2 className="font-deck-heading text-lg uppercase tracking-wide text-deck-violet">Aktivita · {activityTypeLabel(at)}</h2></div>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Skrýt panel aktivity" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-deck-soft p-3 text-xs text-deck-violet-deep"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Aktivita z editoru</strong><br />Obsah i nastavení upravíte přímo zde. Před spuštěním prosím zkontrolujte.</span></div>
      {missing.length > 0 && <p role="status" className="mt-2 flex gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-foreground"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" /> Pro spuštění chybí: {missing.join(", ")}.</p>}
      {settings && <section className="mt-4 space-y-3 border-t border-border pt-3"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Typ a herní režim</h3>{settings}</section>}
      <div className="mt-4">
        <ActivityEditor
          model={model}
          onChange={changeModel}
          context="presentation"
          autoFocus={autoFocus}
          scored={stepTypeInfo(at).scored || at === "quiz"}
          renderLegacyContent={(content, onChange) => <ActivityContentEditor activityType={at} props={content} onChange={onChange} />}
        />
      </div>
      <section className="mt-4 space-y-2 border-t border-border pt-3"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Digi i offline</h3><Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={onPrint} disabled={printing}><FileDown className="h-3.5 w-3.5" /> Vytisknout jako list (PDF tohoto slidu)</Button><Button size="sm" className="w-full gap-1.5 text-xs" onClick={onLaunch}><Monitor className="h-3.5 w-3.5" /> Pustit jako živou hru</Button></section>
      <section className="mt-4 space-y-2 border-t border-border pt-3"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Poznámky řečníka</h3><div className="rounded-xl bg-deck-notes p-3"><p className="mb-2 text-[11px] text-deck-muted">Vidíte je jen vy, žáci je neuvidí.</p><Textarea aria-label="Poznámky řečníka k aktivitě" rows={4} value={teacherNotes} onChange={(event) => onTeacherNotesChange?.(event.target.value)} placeholder="Poznámka k této aktivitě…" className="border-deck-line bg-transparent text-xs" /></div></section>
    </aside>
  );
}
