import type { ReactNode } from "react";
import { AlertTriangle, FileDown, Monitor, X } from "lucide-react";
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
}: {
  spec: any;
  onSpecChange: (patch: Record<string, unknown>) => void;
  settings: ReactNode;
  autoFocus?: boolean;
  onPrint: () => void;
  printing?: boolean;
  onLaunch: () => void;
  onClose: () => void;
}) {
  const at = String(spec?.activityType ?? "");
  const missing = activityMissing(spec);
  return (
    <aside aria-label="Vlastnosti aktivity" className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background p-3 font-deck-body xl:w-[340px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet">Aktivita · {activityTypeLabel(at)}</h2>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Skrýt panel aktivity" onClick={onClose}><X className="h-4 w-4" /></Button>
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

      <Section title="Použití">
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={onPrint} disabled={printing}>
          <FileDown className="h-3.5 w-3.5" /> Vytisknout jako list (PDF tohoto slidu)
        </Button>
        <Button size="sm" className="w-full gap-1.5 text-xs" onClick={onLaunch}>
          <Monitor className="h-3.5 w-3.5" /> Pustit jako živou hru
        </Button>
      </Section>
    </aside>
  );
}
