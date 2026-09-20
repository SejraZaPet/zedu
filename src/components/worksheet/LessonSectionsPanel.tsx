/**
 * LessonSectionsPanel — stavba pracovního listu sekce po sekci.
 *
 * Nahrazuje jeden velký AI dotaz na celou lekci: učitel vidí sekce lekce
 * v chronologickém pořadí a u každé zvolí, co se do listu vloží.
 * Výsledný list se sestaví přesně v pořadí sekcí.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, QrCode, FileText, Check, Table as TableIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { LessonSection } from "@/lib/lesson-content-splitter";
import type { ItemType, WorksheetItem } from "@/lib/worksheet-spec";
import { buildItemsFromLessonActivity } from "@/lib/lesson-activity-to-worksheet";
import TableFieldsEditor from "./TableFieldsEditor";

/** Jedna hotová položka připravená k vložení do pracovního listu. */
export type BuiltWorksheetItem = {
  type: ItemType;
  patch: Partial<WorksheetItem>;
  correct?: string | string[];
};

type SectionMode = "notes" | "lesson_activity" | "ai";

type AiItem = {
  type: ItemType;
  prompt: string;
  choices?: string[];
  correctChoice?: string;
  correctBoolean?: boolean;
  blankText?: string;
  blankAnswers?: string[];
  matchPairs?: { left: string; right: string }[];
  orderItems?: string[];
};

const AI_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "auto", label: "Ať vybere AI podle obsahu" },
  { value: "mcq", label: "Kvíz (výběr z možností)" },
  { value: "matching", label: "Přiřazování" },
  { value: "ordering", label: "Řazení" },
  { value: "true_false", label: "Pravda / nepravda" },
  { value: "fill_blank", label: "Doplňovačka" },
];

function aiItemToBuilt(ai: AiItem): BuiltWorksheetItem {
  const patch: Partial<WorksheetItem> = { prompt: ai.prompt };
  if (ai.choices) patch.choices = ai.choices;
  if (ai.matchPairs) patch.matchPairs = ai.matchPairs;
  if (ai.orderItems) patch.orderItems = ai.orderItems;
  if (ai.blankText) patch.blankText = ai.blankText;

  let correct: string | string[] | undefined;
  if (ai.type === "mcq") correct = ai.correctChoice ?? ai.choices?.[0];
  else if (ai.type === "true_false")
    correct = ai.correctBoolean === undefined ? undefined : ai.correctBoolean ? "true" : "false";
  else if (ai.type === "fill_blank") correct = ai.blankAnswers;
  else if (ai.type === "matching")
    correct = (ai.matchPairs ?? []).map((p) => `${p.left}=${p.right}`);
  else if (ai.type === "ordering") correct = ai.orderItems;

  return { type: ai.type, patch, ...(correct !== undefined ? { correct } : {}) };
}

export default function LessonSectionsPanel({
  open,
  onOpenChange,
  sections,
  lessonTitle,
  activityUrlFor,
  onBuild,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sections: LessonSection[];
  lessonTitle?: string;
  /** Vrátí odkaz na aktivitu v lekci pro QR kód (null = odkaz není dostupný). */
  activityUrlFor: (deepLinkIndex: number) => string | null;
  onBuild: (items: BuiltWorksheetItem[]) => void;
}) {
  const [modes, setModes] = useState<Record<number, SectionMode>>({});
  const [activityModes, setActivityModes] = useState<Record<number, "qr" | "convert">>({});
  const [aiTypes, setAiTypes] = useState<Record<number, string>>({});
  const [aiResults, setAiResults] = useState<Record<number, AiItem>>({});
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});
  const [tables, setTables] = useState<Record<number, { rows: string[][]; caption?: string }>>({});

  useEffect(() => {
    if (!open) return;
    const m: Record<number, SectionMode> = {};
    const am: Record<number, "qr" | "convert"> = {};
    const tb: Record<number, { rows: string[][]; caption?: string }> = {};
    for (const s of sections) {
      m[s.index] = "notes";
      if (s.activity) am[s.index] = s.activity.deepLinkIndex !== undefined ? "qr" : "convert";
      if (s.table) tb[s.index] = { rows: s.table.rows.map((r) => [...r]), caption: s.table.caption };
    }
    setModes(m);
    setActivityModes(am);
    setAiTypes({});
    setAiResults({});
    setAiLoading({});
    setTables(tb);
  }, [open, sections]);

  const chosenCount = useMemo(
    () => Object.values(modes).filter((m) => m !== "notes").length,
    [modes],
  );

  async function generateForSection(s: LessonSection) {
    setAiLoading((p) => ({ ...p, [s.index]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-section-activity", {
        body: {
          sectionTitle: s.title,
          sectionText: s.text,
          itemType: aiTypes[s.index] ?? "auto",
        },
      });
      if (error) throw error;
      const item = (data as any)?.item;
      if (!item?.type || !item?.prompt) throw new Error("AI nevrátila úlohu");
      setAiResults((p) => ({ ...p, [s.index]: item as AiItem }));
    } catch (err: any) {
      toast({
        title: "AI návrh se nepovedl",
        description: err?.message ?? "Zkuste to znovu",
        variant: "destructive",
      });
    } finally {
      setAiLoading((p) => ({ ...p, [s.index]: false }));
    }
  }

  function handleBuild() {
    const out: BuiltWorksheetItem[] = [];
    for (const s of sections) {
      const mode = modes[s.index] ?? "notes";

      // 1) Nadpis sekce
      out.push({ type: "section_header", patch: { prompt: s.title } });

      // 2) Tabulka ze sekce — vždy na svém místě (po vložení editovatelná)
      const t = tables[s.index];
      if (t && t.rows.length > 0) {
        out.push({
          type: "table",
          patch: { prompt: "", tableRows: t.rows, tableCaption: t.caption ?? "" },
        });
      }

      // 3) Zvolená akce
      if (mode === "lesson_activity" && s.activity) {
        const qrUrl =
          s.activity.deepLinkIndex !== undefined
            ? activityUrlFor(s.activity.deepLinkIndex)
            : null;
        if ((activityModes[s.index] ?? "qr") === "qr" && qrUrl) {
          out.push({
            type: "qr_link",
            patch: { prompt: `Naskenuj QR kód – ${s.activity.title}`, qrUrl },
          });
        } else {
          for (const m of buildItemsFromLessonActivity(s.activity)) {
            out.push({
              type: m.type,
              patch: m.patch,
              ...(m.correct !== undefined ? { correct: m.correct } : {}),
            });
          }
        }
      } else if (mode === "ai" && aiResults[s.index]) {
        out.push(aiItemToBuilt(aiResults[s.index]));
      } else {
        out.push({
          type: "write_lines",
          patch: {
            prompt: `Zapiš si hlavní body k tématu „${s.title}“:`,
            lineCount: 6,
            answerSpace: { type: "lines", heightMm: 45, lineCount: 6 },
          },
        });
      }
    }
    onBuild(out);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Sekce lekce{lessonTitle ? ` – ${lessonTitle}` : ""}
          </DialogTitle>
          <DialogDescription>
            Sekce jsou v pořadí, v jakém jsou v lekci. U každé vyberte, co se má do
            pracovního listu vložit. List se sestaví přesně v tomto pořadí.
          </DialogDescription>
        </DialogHeader>

        {sections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            V lekci se nenašly žádné sekce. Zkuste klasické generování z celé lekce.
          </p>
        )}

        <div className="space-y-3">
          {sections.map((s) => {
            const mode = modes[s.index] ?? "notes";
            const t = tables[s.index];
            return (
              <div key={s.index} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{s.index}.</Badge>
                      <span className="font-medium truncate">{s.title}</span>
                      {s.activity && (
                        <Badge variant="outline" className="text-xs">
                          Obsahuje aktivitu
                        </Badge>
                      )}
                      {s.table && (
                        <Badge variant="outline" className="text-xs">
                          <TableIcon className="w-3 h-3 mr-1" /> Tabulka
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">
                      {s.text || "(bez textu)"}
                    </p>
                  </div>
                  <Select
                    value={mode}
                    onValueChange={(v) =>
                      setModes((p) => ({ ...p, [s.index]: v as SectionMode }))
                    }
                  >
                    <SelectTrigger className="w-[230px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="notes">Nechat jako poznámky</SelectItem>
                      {s.activity && (
                        <SelectItem value="lesson_activity">Vložit aktivitu z lekce</SelectItem>
                      )}
                      <SelectItem value="ai">Navrhnout aktivitu (AI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === "lesson_activity" && s.activity && (
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select
                      value={activityModes[s.index] ?? "qr"}
                      onValueChange={(v) =>
                        setActivityModes((p) => ({ ...p, [s.index]: v as "qr" | "convert" }))
                      }
                    >
                      <SelectTrigger className="w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem
                          value="qr"
                          disabled={s.activity.deepLinkIndex === undefined}
                        >
                          QR kód na aktivitu v appce
                        </SelectItem>
                        <SelectItem value="convert">Převést na tisknutelnou úlohu</SelectItem>
                      </SelectContent>
                    </Select>
                    {s.activity.deepLinkIndex === undefined && (
                      <span className="text-xs text-muted-foreground">
                        Tato aktivita nemá vlastní odkaz – převede se na úlohu.
                      </span>
                    )}
                  </div>
                )}

                {mode === "ai" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={aiTypes[s.index] ?? "auto"}
                        onValueChange={(v) => setAiTypes((p) => ({ ...p, [s.index]: v }))}
                      >
                        <SelectTrigger className="w-[260px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {AI_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void generateForSection(s)}
                        disabled={!!aiLoading[s.index]}
                      >
                        {aiLoading[s.index] ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-1" />
                        )}
                        {aiResults[s.index] ? "Jiný návrh" : "Navrhnout"}
                      </Button>
                    </div>
                    {aiResults[s.index] && (
                      <div className="rounded-lg bg-muted/50 p-2 text-sm">
                        <Check className="w-3.5 h-3.5 inline mr-1 text-primary" />
                        <span className="whitespace-pre-wrap">{aiResults[s.index].prompt}</span>
                      </div>
                    )}
                    {!aiResults[s.index] && !aiLoading[s.index] && (
                      <p className="text-xs text-muted-foreground">
                        Bez návrhu se do listu vloží prostor na poznámky.
                      </p>
                    )}
                  </div>
                )}

                {t && (
                  <TableFieldsEditor
                    item={
                      {
                        type: "table",
                        tableRows: t.rows,
                        tableCaption: t.caption ?? "",
                      } as WorksheetItem
                    }
                    onUpdate={(patch) =>
                      setTables((p) => ({
                        ...p,
                        [s.index]: {
                          rows: (patch.tableRows as string[][]) ?? p[s.index].rows,
                          caption:
                            patch.tableCaption !== undefined
                              ? patch.tableCaption
                              : p[s.index].caption,
                        },
                      }))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <span className="text-xs text-muted-foreground mr-auto">
            {sections.length} sekcí · {chosenCount} s aktivitou
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button onClick={handleBuild} disabled={sections.length === 0}>
            <FileText className="w-4 h-4 mr-1" /> Vytvořit pracovní list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
