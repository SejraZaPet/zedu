import { useEffect, useState } from "react";
import { Loader2, Sparkles, Check, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { LessonBlock } from "@/lib/lesson-content-splitter";
import { ITEM_TYPE_LABELS } from "@/lib/worksheet-defaults";
import type { ItemType } from "@/lib/worksheet-spec";

// ───── Picker (Sheet) ──────────────────────────────────────────────

export function LessonContentPickerSheet({
  open,
  onOpenChange,
  blocks,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  blocks: LessonBlock[];
  onPick: (block: LessonBlock) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Vyberte obsah z lekce</SheetTitle>
          <SheetDescription>Klikněte na blok pro vložení do otázky.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 mt-4">
          {blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">Lekce neobsahuje žádné bloky.</p>
          )}
          {blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => {
                onPick(block);
                onOpenChange(false);
              }}
              className="w-full text-left p-3 border rounded-lg hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
            >
              <span className="text-xs text-muted-foreground mb-1 block font-medium">
                {block.title}
              </span>
              <p className="text-sm whitespace-pre-wrap line-clamp-4">{block.text}</p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ───── AI Suggest from lesson (Dialog) ─────────────────────────────

export type AiGeneratedItem = {
  prompt: string;
  choices?: string[];
  correctChoice?: string;
  correctBoolean?: boolean;
  blankText?: string;
  blankAnswers?: string[];
  matchPairs?: { left: string; right: string }[];
  orderItems?: string[];
  shortAnswer?: string;
  rubric?: string;
  difficulty?: "easy" | "medium" | "hard";
  points?: number;
};

export function AiSuggestFromLessonDialog({
  open,
  onOpenChange,
  blocks,
  itemType,
  lessonTitle,
  lessonSubject,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  blocks: LessonBlock[];
  itemType: ItemType;
  lessonTitle?: string;
  lessonSubject?: string;
  onApply: (generated: AiGeneratedItem) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number[]>([]);
  const [aiHint, setAiHint] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedItem, setGeneratedItem] = useState<AiGeneratedItem | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedIdx([]);
      setAiHint("");
      setGeneratedItem(null);
    }
  }, [open]);

  const typeLabel = ITEM_TYPE_LABELS[itemType]?.label ?? itemType;

  function toggle(i: number) {
    setSelectedIdx((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );
  }

  async function handleGenerate() {
    if (selectedIdx.length === 0) return;
    setGenerating(true);
    setGeneratedItem(null);
    try {
      const selectedContent = selectedIdx
        .map((i) => blocks[i])
        .filter(Boolean)
        .map((b) => b.text)
        .join("\n\n");

      const instruction = [
        `Vygeneruj VÝHRADNĚ jednu úlohu typu "${itemType}" (${typeLabel}).`,
        aiHint ? `Pokyn učitele: ${aiHint}` : "",
        "Vrať 3 varianty, všechny stejného typu.",
      ]
        .filter(Boolean)
        .join(" ");

      const { data, error } = await supabase.functions.invoke("generate-block-suggestions", {
        body: {
          blockText: selectedContent,
          lessonTitle: lessonTitle ?? "",
          lessonSubject: lessonSubject ?? "",
          userInstruction: instruction,
        },
      });
      if (error) throw error;
      const list = ((data as any)?.suggestions ?? []) as Array<AiGeneratedItem & { type: ItemType }>;
      const match = list.find((s) => s.type === itemType) ?? list[0];
      if (!match) {
        toast({ title: "AI nevrátila návrh", variant: "destructive" });
        return;
      }
      setGeneratedItem(match);
    } catch (err: any) {
      toast({
        title: "AI generování selhalo",
        description: err?.message ?? "Zkuste to znovu",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI návrh otázky z lekce</DialogTitle>
          <DialogDescription>
            Vyberte části lekce jako zdroj. AI vytvoří otázku zvoleného typu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Vyberte část lekce jako zdroj:</Label>
            <div className="space-y-1 max-h-[280px] overflow-y-auto mt-2 border rounded-lg p-2">
              {blocks.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Lekce nemá obsah.</p>
              )}
              {blocks.map((block, i) => (
                <label
                  key={block.id}
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${
                    selectedIdx.includes(i)
                      ? "bg-primary/10 border border-primary"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <Checkbox
                    checked={selectedIdx.includes(i)}
                    onCheckedChange={() => toggle(i)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs">{block.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{block.text}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Typ otázky</Label>
              <p className="text-sm text-muted-foreground mt-1">{typeLabel}</p>
            </div>
            <div>
              <Label className="text-xs" htmlFor="ai-hint">Volitelný pokyn pro AI</Label>
              <Input
                id="ai-hint"
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
                placeholder="Např. zaměř se na definice…"
                className="h-9 mt-1"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || selectedIdx.length === 0}
            className="w-full sm:w-auto"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {generating ? "Generuji…" : "Generovat otázku"}
          </Button>

          {generatedItem && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <Label className="text-xs">Návrh AI:</Label>
              <p className="font-medium mt-1 whitespace-pre-wrap">{generatedItem.prompt}</p>
              {generatedItem.choices && generatedItem.choices.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {generatedItem.choices.map((c, i) => (
                    <li key={i} className="text-sm">
                      {generatedItem.correctChoice === c ? "✓ " : "• "}
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {generatedItem.blankText && (
                <p className="mt-2 text-sm whitespace-pre-wrap">{generatedItem.blankText}</p>
              )}
              {generatedItem.matchPairs && generatedItem.matchPairs.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {generatedItem.matchPairs.map((p, i) => (
                    <li key={i}>
                      <strong>{p.left}</strong> → {p.right}
                    </li>
                  ))}
                </ul>
              )}
              {generatedItem.orderItems && generatedItem.orderItems.length > 0 && (
                <ol className="mt-2 space-y-1 text-sm list-decimal list-inside">
                  {generatedItem.orderItems.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ol>
              )}
              {generatedItem.shortAnswer && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Vzorová odpověď: {generatedItem.shortAnswer}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    onApply(generatedItem);
                    onOpenChange(false);
                  }}
                >
                  <Check className="w-4 h-4 mr-1" /> Použít
                </Button>
                <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Jiný návrh
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
