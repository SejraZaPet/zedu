import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AiContentBadge from "@/components/ai/AiContentBadge";
import BezlaiTutorChat from "@/components/BezlaiTutorChat";
import { toast } from "sonner";
import { Layers, HelpCircle, ListChecks, MessageCircleQuestion, Loader2, RotateCw } from "lucide-react";
import {
  blocksToPlainText,
  extractCardsFromBlocks,
  pickStudyMethod,
  type StudyCard,
} from "@/lib/lesson-study";

interface LessonStudyBarProps {
  lessonId: string;
  lessonTitle: string;
  blocks: unknown;
  subject?: string;
}

/** Studijní lišta u lekce: Kartičky · Kvíz · Shrnutí · Zeptat se. */
const LessonStudyBar = ({ lessonId, lessonTitle, blocks, subject }: LessonStudyBarProps) => {
  const navigate = useNavigate();
  const [cardsOpen, setCardsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [cardsAi, setCardsAi] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [busy, setBusy] = useState<"cards" | "summary" | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  const openCards = async () => {
    setFlipped(new Set());
    const local = extractCardsFromBlocks(blocks);
    if (local.length > 0) {
      setCards(local);
      setCardsAi(false);
      setCardsOpen(true);
      return;
    }
    setBusy("cards");
    try {
      const { data, error } = await supabase.functions.invoke("lesson-study-helper", {
        body: { lesson_id: lessonId, mode: "cards" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCards((data as any)?.cards ?? []);
      setCardsAi(true);
      setCardsOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Kartičky se nepodařilo vytvořit. Zkus to znovu.");
    } finally {
      setBusy(null);
    }
  };

  const openSummary = async () => {
    setBusy("summary");
    try {
      const { data, error } = await supabase.functions.invoke("lesson-study-helper", {
        body: { lesson_id: lessonId, mode: "summary" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setBullets((data as any)?.bullets ?? []);
      setSummaryOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Shrnutí se nepodařilo vytvořit. Zkus to znovu.");
    } finally {
      setBusy(null);
    }
  };

  const goQuiz = async () => {
    const [{ data: methods }, { data: prefs }] = await Promise.all([
      supabase.from("study_methods").select("id, slug").order("name"),
      supabase.from("student_preferred_methods").select("method_id"),
    ]);
    const method = pickStudyMethod(
      (methods as any[]) ?? [],
      ((prefs as any[]) ?? []).map((p) => p.method_id),
    );
    if (!method) {
      navigate("/student/metody");
      return;
    }
    navigate(`/student/metody/${method.slug}/procviceni?lesson=${lessonId}&min=5`);
  };

  const lessonText = blocksToPlainText(blocks);

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
        aria-label="Studijní nástroje lekce"
      >
        <Button size="sm" variant="outline" className="gap-1.5" onClick={openCards} disabled={busy !== null}>
          {busy === "cards" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          Kartičky
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={goQuiz}>
          <HelpCircle className="w-4 h-4" />
          Kvíz
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={openSummary} disabled={busy !== null}>
          {busy === "summary" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
          Shrnutí
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setChatOpen(true)}>
          <MessageCircleQuestion className="w-4 h-4" />
          Zeptat se
        </Button>
      </div>

      <Dialog open={cardsOpen} onOpenChange={setCardsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kartičky – {lessonTitle}</DialogTitle>
            {cardsAi && <AiContentBadge aiGenerated aiModifiedAt={null} />}
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
            {cards.map((card, i) => {
              const isFlipped = flipped.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setFlipped((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                  className="min-h-[96px] rounded-xl border border-border bg-muted/40 p-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Kartička ${i + 1}: ${isFlipped ? card.back : card.front}`}
                >
                  <span className="block text-xs text-muted-foreground mb-1">
                    {isFlipped ? "Odpověď" : "Otázka"}
                  </span>
                  {isFlipped ? card.back : card.front}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <RotateCw className="w-3 h-3" /> Kliknutím kartičku otočíš.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Shrnutí – {lessonTitle}</DialogTitle>
            <AiContentBadge aiGenerated aiModifiedAt={null} />
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <BezlaiTutorChat
        question={`Lekce: ${lessonTitle}\n\nObsah lekce:\n${lessonText}`}
        subject={subject}
        contextKey={lessonId}
        open={chatOpen}
        onOpenChange={setChatOpen}
        hideTrigger
      />
    </>
  );
};

export default LessonStudyBar;
