import type { ReactNode } from "react";
import { AlertTriangle, FileDown, Monitor, Sparkles, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activityTypeLabel } from "@/lib/presentation-activity";
import { activityMissing } from "@/lib/activity-completeness";
import McqSpecEditor from "./McqSpecEditor";
import ActivityColorsEditor from "./ActivityColorsEditor";

/** Typy, u kterých se počítají body (activitySpec.points 0/1/2). */
const SCORED = new Set(["mcq", "quiz", "true_false", "matching", "fill_blanks", "fill_choice", "ordering"]);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Pravý panel vlastností aktivity – vše na jednom místě: obsah, čas, body,
 * jednotlivě/týmy, barvy, tisk jako list a spuštění živé hry.
 * `settings` = stávající ovládání (typ, herní režim a týmy, čas, typové editory).
 */
export default function ActivitySettingsPanel({
  spec, onSpecChange, settings, autoFocus, onPrint, printing, onLaunch, onClose,
  teacherNotes = "", onTeacherNotesChange,
}: {
  spec: any;
  onSpecChange: (patch: Record<string, unknown>) => void;
  settings: ReactNode;
  autoFocus?: boolean;
  onPrint: () => void;
  printing?: boolean;
  onLaunch: () => void;
  onClose: () => void;
  teacherNotes?: string;
  onTeacherNotesChange?: (notes: string) => void;
}) {
  const at = String(spec?.activityType ?? "");
  const missing = activityMissing(spec);
  return (
    <aside aria-label="Vlastnosti aktivity" className="deck-properties-panel" data-testid="activity-properties">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-deck-muted">Vlastnosti</p>
          <h2 className="font-deck-heading text-lg uppercase tracking-wide text-deck-violet">Aktivita · {activityTypeLabel(at)}</h2>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Skrýt panel aktivity" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-deck-soft p-3 text-xs text-deck-violet-deep">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <span><strong>Aktivita z editoru</strong><br />Obsah i nastavení upravíte přímo zde. Před spuštěním prosím zkontrolujte.</span>
      </div>
      {missing.length > 0 && (
        <p role="status" className="mt-2 flex gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" /> Pro spuštění chybí: {missing.join(", ")}.
        </p>
      )}

      {(at === "mcq" || at === "poll") && (
        <Section title="Obsah">
          <McqSpecEditor spec={spec} onChange={onSpecChange} autoFocus={autoFocus} />
        </Section>
      )}

      <Section title="Nastavení">
        {SCORED.has(at) && (
          <div>
            <Label className="text-xs">Body za správnou odpověď</Label>
            <Select value={String(spec?.points ?? 1)} onValueChange={(v) => onSpecChange({ points: Number(v) })}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Bez bodů (jen procvičení)</SelectItem>
                <SelectItem value="1">Běžné body</SelectItem>
                <SelectItem value="2">Dvojnásobné body</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {settings}
      </Section>

      <Section title="Vizuál a barvy">
        <ActivityColorsEditor value={spec?.colors} onChange={(colors) => onSpecChange({ colors })} />
      </Section>

      <Section title="Digi i offline">
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={onPrint} disabled={printing}>
          <FileDown className="h-3.5 w-3.5" /> Vytisknout jako list (PDF tohoto slidu)
        </Button>
        <Button size="sm" className="w-full gap-1.5 text-xs" onClick={onLaunch}>
          <Monitor className="h-3.5 w-3.5" /> Pustit jako živou hru
        </Button>
      </Section>

      <Section title="Poznámky řečníka">
        <div className="rounded-xl bg-deck-notes p-3">
          <p className="mb-2 text-[11px] text-deck-muted">Vidíte je jen vy, žáci je neuvidí.</p>
          <Textarea
            aria-label="Poznámky řečníka k aktivitě"
            rows={4}
            value={teacherNotes}
            onChange={(event) => onTeacherNotesChange?.(event.target.value)}
            placeholder="Poznámka k této aktivitě…"
            className="border-deck-line bg-transparent text-xs"
          />
        </div>
      </Section>
    </aside>
  );
}
