import { useMemo, useState } from "react";
import type { Block } from "@/lib/textbook-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileDown, Lock, LockOpen } from "lucide-react";
import { activityMeta, activityMinutes, activitySummary, WORK_MODE_LABELS } from "@/lib/activity-meta";
import { printActivities } from "@/lib/activity-pdf-export";

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  lessonTitle: string;
}

/**
 * Přehled aktivit v lekci – souhrn, hromadné nastavení povinnosti
 * a export vybraných aktivit do PDF (zadání pro žáky / s řešením pro učitele).
 */
const LessonActivitiesPanel = ({ blocks, onChange, lessonTitle }: Props) => {
  const activities = useMemo(() => blocks.filter((b) => b.type === "activity"), [blocks]);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allSelected = activities.length > 0 && selected.length === activities.length;

  const setRequired = (required: boolean) => {
    if (selected.length === 0) return;
    onChange(
      blocks.map((b) =>
        selected.includes(b.id) && b.type === "activity"
          ? { ...b, props: { ...b.props, required } }
          : b,
      ),
    );
    toast.success(
      required ? "Vybrané aktivity jsou nastavené jako povinné." : "Vybrané aktivity jsou nepovinné.",
    );
  };

  const exportPdf = (variant: "student" | "teacher") => {
    const chosen = activities.filter((a) => selected.includes(a.id));
    if (chosen.length === 0) {
      toast.error("Vyberte alespoň jednu aktivitu k exportu.");
      return;
    }
    try {
      printActivities(chosen, { lessonTitle: lessonTitle || "Aktivity lekce", variant });
    } catch (e: any) {
      toast.error(e?.message ?? "Export se nepodařilo otevřít.");
    }
  };

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
        V této lekci ještě nejsou žádné aktivity. Přidejte je v záložce Obsah lekce.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(v) => setSelected(v ? activities.map((a) => a.id) : [])}
          />
          Vybrat vše ({activities.length})
        </label>
        <span className="flex-1" />
        <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => setRequired(true)}>
          <Lock className="w-3.5 h-3.5 mr-1" /> Nastavit jako povinné
        </Button>
        <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => setRequired(false)}>
          <LockOpen className="w-3.5 h-3.5 mr-1" /> Nastavit jako nepovinné
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportPdf("student")}>
          <FileDown className="w-3.5 h-3.5 mr-1" /> PDF – zadání pro žáky
        </Button>
        <Button size="sm" onClick={() => exportPdf("teacher")}>
          <FileDown className="w-3.5 h-3.5 mr-1" /> PDF – s řešením
        </Button>
      </div>

      <div className="space-y-1.5">
        {activities.map((a, idx) => {
          const p = (a.props ?? {}) as Record<string, any>;
          const meta = activityMeta(p.activityType || "flashcards");
          const minutes = activityMinutes(p);
          const methods: string[] = Array.isArray(p.aiMethodNames) ? p.aiMethodNames : [];
          return (
            <div key={a.id} className={`flex items-start gap-3 rounded-lg border border-border p-3 ${meta.accent}`}>
              <Checkbox
                checked={selected.includes(a.id)}
                onCheckedChange={() => toggle(a.id)}
                className="mt-0.5"
                aria-label={`Vybrat aktivitu ${p.title || idx + 1}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {idx + 1}. {p.title || "Aktivita"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {meta.icon} {meta.label}
                  {activitySummary(p) && ` · ${activitySummary(p)}`}
                  {minutes && ` · ~${minutes} min`}
                  {` · ${WORK_MODE_LABELS[p.workMode || "individual"]}`}
                  {methods.length > 0 && ` · Metody: ${methods.join(", ")}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={p.required === true ? "default" : "secondary"} className="text-[10px]">
                  {p.required === true ? "Povinné" : "Nepovinné"}
                </Badge>
                {p.ai_generated === true && (
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    🤖 Navrženo AI
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LessonActivitiesPanel;
