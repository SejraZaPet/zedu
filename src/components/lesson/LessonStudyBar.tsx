import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { practiceErrorMessage } from "@/lib/practice-error";
import { methodPurpose, STUDY_TECHNIQUES, techniqueGuideUrl, techniquePracticeUrl } from "@/lib/study-method-info";
import { blocksToText, hasEnoughLessonText, INSUFFICIENT_LESSON_TEXT } from "../../../supabase/functions/_shared/lesson-text";
import { Layers, HelpCircle, ListChecks, MessageCircleQuestion, Loader2, RotateCw, GraduationCap } from "lucide-react";
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

export const SHORT_TEXT_HINT =
  "Tahle lekce zatím nemá dost textu na procvičení. Zkus Zeptat se, nebo si vyber vlastní text v „Učím se“.";

const friendlyError = async (e: unknown, fallback: string) => {
  const msg = await practiceErrorMessage(e);
  if (msg === INSUFFICIENT_LESSON_TEXT) return SHORT_TEXT_HINT;
  return msg && msg !== "Nepodařilo se vygenerovat cvičení." && !/non-2xx/i.test(msg) ? msg : fallback;
};

/** Tablet a mobil (< 1024 px) dostanou spodní list, PC dialog. */
const useSheetLayout = () => {
  const query = "(max-width: 1023px)";
  const [sheet, setSheet] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const on = () => setSheet(mql.matches);
    on();
    mql.addEventListener?.("change", on);
    return () => mql.removeEventListener?.("change", on);
  }, []);
  return sheet;
};

/** Studijní lišta u lekce: jedno tlačítko „Učím se“ → rychlé akce + techniky. */
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
  const [panelOpen, setPanelOpen] = useState(false);
  const sheetLayout = useSheetLayout();
  const textTooShort = !hasEnoughLessonText(blocksToText(blocks));

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
      const msg = await friendlyError(e, "Kartičky se nepodařilo vytvořit. Zkus to znovu.");
      if (msg === SHORT_TEXT_HINT) toast.info(msg); else toast.error(msg);
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
      const msg = await friendlyError(e, "Shrnutí se nepodařilo vytvořit. Zkus to znovu.");
      if (msg === SHORT_TEXT_HINT) toast.info(msg); else toast.error(msg);
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

  const runQuick = (fn: () => void) => {
    setPanelOpen(false);
    fn();
  };

  const panelBody = (
    <div className="space-y-6 pt-2">
      <section aria-labelledby="study-quick">
        <h3 id="study-quick" className="font-heading text-sm font-semibold mb-2">Rychle procvičit</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" className="gap-1.5 min-h-11" onClick={() => runQuick(openCards)}>
            <Layers className="w-4 h-4" aria-hidden /> Kartičky
          </Button>
          <Button variant="outline" className="gap-1.5 min-h-11" onClick={() => runQuick(goQuiz)}>
            <HelpCircle className="w-4 h-4" aria-hidden /> Kvíz
          </Button>
          <Button variant="outline" className="gap-1.5 min-h-11" onClick={() => runQuick(openSummary)}>
            <ListChecks className="w-4 h-4" aria-hidden /> Shrnutí
          </Button>
          <Button variant="outline" className="gap-1.5 min-h-11" onClick={() => runQuick(() => setChatOpen(true))}>
            <MessageCircleQuestion className="w-4 h-4" aria-hidden /> Zeptat se ZedAI
          </Button>
        </div>
      </section>
      <section aria-labelledby="study-techniques">
        <h3 id="study-techniques" className="font-heading text-sm font-semibold mb-2">Podle techniky</h3>
        {textTooShort && (
          <p role="status" className="mb-3 rounded-lg border border-border bg-muted/50 p-3 text-sm">{SHORT_TEXT_HINT}</p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {STUDY_TECHNIQUES.map((t) => {
            const info = methodPurpose(t.slug);
            return (
              <li key={t.slug} className="rounded-xl border border-border bg-card p-3">
                <Link
                  to={techniquePracticeUrl(t.slug, lessonId)}
                  onClick={() => setPanelOpen(false)}
                  className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Procvičit technikou ${t.name}${info ? `, ${info.purpose}, ${info.duration}` : ""}`}
                  data-testid={`technique-${t.slug}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {info && <span className="text-xs text-muted-foreground">{info.duration}</span>}
                  </span>
                  {info && <span className="block text-sm text-muted-foreground">{info.purpose}</span>}
                </Link>
                <Link
                  to={techniqueGuideUrl(t.slug)}
                  onClick={() => setPanelOpen(false)}
                  className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={`Jak technika ${t.name} funguje`}
                >
                  Jak technika funguje
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );


  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
        aria-label="Studijní nástroje lekce"
      >
        <Button
          className="gap-2 min-h-11"
          onClick={() => setPanelOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          disabled={busy !== null}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <GraduationCap className="w-4 h-4" aria-hidden />}
          Učím se
        </Button>
      </div>

      {sheetLayout ? (
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Učím se – {lessonTitle}</SheetTitle>
              <SheetDescription>Vyber, jak chceš lekci procvičit.</SheetDescription>
            </SheetHeader>
            {panelBody}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Učím se – {lessonTitle}</DialogTitle>
              <DialogDescription>Vyber, jak chceš lekci procvičit.</DialogDescription>
            </DialogHeader>
            {panelBody}
          </DialogContent>
        </Dialog>
      )}

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
