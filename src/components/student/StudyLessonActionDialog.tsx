import { useEffect, useState } from "react";
import { Layers, ListChecks, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LessonSearchCombobox from "@/components/student/LessonSearchCombobox";
import { Button } from "@/components/ui/button";
import AiContentBadge from "@/components/ai/AiContentBadge";
import type { PracticeLessonGroup } from "@/lib/student-practice-lessons";
import type { StudyCard } from "@/lib/lesson-study";

export type StudyLessonAction = "cards" | "summary";

interface StudyLessonActionDialogProps {
  action: StudyLessonAction | null;
  onOpenChange: (open: boolean) => void;
  lessonGroups: PracticeLessonGroup[];
  initialLessonId: string | null;
  recentLessonIds?: string[];
  onError: (message: string) => void;
}

export default function StudyLessonActionDialog({ action, onOpenChange, lessonGroups, initialLessonId, recentLessonIds = [], onError }: StudyLessonActionDialogProps) {
  const [lessonId, setLessonId] = useState(initialLessonId ?? "");
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [bullets, setBullets] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!action) return;
    setLessonId(initialLessonId ?? "");
    setCards([]);
    setBullets([]);
    setFlipped(new Set());
    setBusy(false);
  }, [action, initialLessonId]);

  const hasResult = action === "cards" ? cards.length > 0 : bullets.length > 0;
  const title = action === "cards" ? "Chci si to zapamatovat" : "Shrnutí lekce";

  const createContent = async () => {
    if (!action || !lessonId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("lesson-study-helper", {
        body: { lesson_id: lessonId, mode: action },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
      if (action === "cards") {
        const nextCards = ((data as { cards?: StudyCard[] } | null)?.cards ?? []).filter((card) => card.front?.trim() && card.back?.trim());
        if (!nextCards.length) throw new Error("Z této lekce se kartičky nepodařilo vytvořit. Zkus jinou lekci.");
        setCards(nextCards);
        setFlipped(new Set());
      } else {
        const nextBullets = ((data as { bullets?: string[] } | null)?.bullets ?? []).filter((bullet) => bullet?.trim());
        if (!nextBullets.length) throw new Error("Z této lekce se shrnutí nepodařilo vytvořit. Zkus jinou lekci.");
        setBullets(nextBullets);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Obsah se nepodařilo vytvořit. Zkus to znovu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(action)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {action === "cards" ? <Layers className="h-5 w-5 text-primary" aria-hidden /> : <ListChecks className="h-5 w-5 text-primary" aria-hidden />}
            {title}
            {hasResult && <AiContentBadge aiGenerated aiModifiedAt={null} />}
          </DialogTitle>
          <DialogDescription>
            {hasResult
              ? action === "cards" ? "Kliknutím na kartičku otočíš otázku i odpověď." : "Nejdůležitější body z vybrané lekce."
              : "Vyber lekci, ze které se chceš učit."}
          </DialogDescription>
        </DialogHeader>

        {!hasResult ? (
          <div className="space-y-3">
            <LessonSearchCombobox
              groups={lessonGroups}
              recentLessonIds={recentLessonIds}
              value={lessonId}
              onValueChange={setLessonId}
              disabled={busy || lessonGroups.length === 0}
            />
            {lessonGroups.length === 0 && <p className="text-sm text-muted-foreground">Jakmile ti učitel zveřejní lekci, bude dostupná tady.</p>}
          </div>
        ) : action === "cards" ? (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {cards.map((card, index) => {
              const isFlipped = flipped.has(index);
              return (
                <button
                  key={`${card.front}-${index}`}
                  type="button"
                  className="min-h-36 rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={isFlipped}
                  aria-label={`Kartička ${index + 1}: ${isFlipped ? card.back : card.front}`}
                  onClick={() => setFlipped((current) => {
                    const next = new Set(current);
                    if (next.has(index)) next.delete(index); else next.add(index);
                    return next;
                  })}
                >
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isFlipped ? "Odpověď" : `Kartička ${index + 1}`}</span>
                  <span className="block whitespace-pre-wrap font-medium">{isFlipped ? card.back : card.front}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <ul className="max-h-[55vh] list-disc space-y-3 overflow-y-auto pl-5 pr-1 text-sm leading-relaxed">
            {bullets.map((bullet, index) => <li key={`${bullet}-${index}`}>{bullet}</li>)}
          </ul>
        )}

        <DialogFooter>
          {hasResult && <Button type="button" variant="outline" className="gap-2" onClick={() => { setCards([]); setBullets([]); }}><RotateCcw className="h-4 w-4" aria-hidden />Vybrat jinou lekci</Button>}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Zavřít</Button>
          {!hasResult && <Button type="button" className="gap-2" disabled={!lessonId || busy} onClick={() => void createContent()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : action === "cards" ? <Layers className="h-4 w-4" aria-hidden /> : <ListChecks className="h-4 w-4" aria-hidden />}
            {busy ? "Vytvářím…" : action === "cards" ? "Vytvořit kartičky" : "Vytvořit shrnutí"}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
