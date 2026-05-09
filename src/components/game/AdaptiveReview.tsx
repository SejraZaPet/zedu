import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Monitor, RotateCcw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WEAK_THRESHOLD = 60;

type AnyResponse = {
  question_index: number;
  is_correct?: boolean | null;
  score?: number | null;
};

type AnySlide = {
  type?: string;
  projector?: { headline?: string; body?: string };
  activitySpec?: any;
  [k: string]: any;
};

export interface WeakSlide {
  index: number;
  slide: AnySlide;
  total: number;
  successPct: number;
  question: string;
  correctAnswer: string;
}

function extractCorrectAnswer(slide: AnySlide): string {
  const spec = slide?.activitySpec || {};
  if (typeof spec.correctAnswer === "string") return spec.correctAnswer;
  if (typeof spec.answer === "string") return spec.answer;
  if (Array.isArray(spec.options) && typeof spec.correctIndex === "number") {
    const opt = spec.options[spec.correctIndex];
    if (typeof opt === "string") return opt;
    if (opt && typeof opt.text === "string") return opt.text;
  }
  if (Array.isArray(spec.options)) {
    const correct = spec.options.find((o: any) => o && (o.correct || o.isCorrect));
    if (correct) return typeof correct === "string" ? correct : correct.text || "—";
  }
  return "—";
}

export function computeWeakSlides(
  slides: AnySlide[],
  responses: AnyResponse[]
): WeakSlide[] {
  if (!Array.isArray(slides) || slides.length === 0) return [];
  const out: WeakSlide[] = [];
  slides.forEach((slide, idx) => {
    if (slide?.type !== "activity") return;
    const spec = slide?.activitySpec || {};
    // Skip pure expressive activities (no right/wrong)
    if (["wall", "poll"].includes(spec.activityType)) return;

    const rel = responses.filter((r) => r.question_index === idx);
    if (rel.length === 0) return;

    // Prefer score average, fall back to is_correct ratio
    const scored = rel.filter((r) => typeof r.score === "number");
    let pct: number;
    if (scored.length > 0) {
      pct = Math.round(
        scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length
      );
    } else {
      const correct = rel.filter((r) => r.is_correct === true).length;
      pct = Math.round((correct / rel.length) * 100);
    }

    if (pct < WEAK_THRESHOLD) {
      out.push({
        index: idx,
        slide,
        total: rel.length,
        successPct: pct,
        question: slide?.projector?.headline || spec.question || `Otázka ${idx + 1}`,
        correctAnswer: extractCorrectAnswer(slide),
      });
    }
  });
  return out.sort((a, b) => a.successPct - b.successPct);
}

interface AdaptiveReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  slides: AnySlide[];
  responses: AnyResponse[];
  currentSettings: any;
}

export function AdaptiveReviewDialog({
  open,
  onOpenChange,
  sessionId,
  slides,
  responses,
  currentSettings,
}: AdaptiveReviewDialogProps) {
  const weak = useMemo(
    () => computeWeakSlides(slides, responses),
    [slides, responses]
  );
  const [busy, setBusy] = useState(false);

  const handleShowOnProjector = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("game_sessions")
        .update({
          settings: {
            ...(currentSettings || {}),
            adaptive: {
              showProjector: true,
              weakIndices: weak.map((w) => w.index),
              shownAt: new Date().toISOString(),
            },
          },
        })
        .eq("id", sessionId);
      if (error) throw error;
      toast.success("Přehled odeslán na projektor.");
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se odeslat na projektor.");
    } finally {
      setBusy(false);
    }
  };

  const handleReplayWeak = async () => {
    if (weak.length === 0) return;
    setBusy(true);
    try {
      const newSlides = weak.map((w) => w.slide);
      const { error } = await supabase
        .from("game_sessions")
        .update({
          activity_data: newSlides as any,
          current_question_index: -1,
          status: "playing",
          settings: {
            ...(currentSettings || {}),
            adaptive: {
              ...(currentSettings?.adaptive || {}),
              showProjector: false,
              replayActive: true,
              replayStartedAt: new Date().toISOString(),
            },
          },
        })
        .eq("id", sessionId);
      if (error) throw error;
      toast.success(`Připraveno ${newSlides.length} slabých otázek. Klikněte „Další slide".`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se připravit nové kolo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Adaptivní závěr
          </DialogTitle>
          <DialogDescription>
            Otázky s úspěšností pod {WEAK_THRESHOLD} % – seřazeno od nejhorší.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {weak.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">
                Žádné otázky pod hranicí {WEAK_THRESHOLD} %. Skvělý výsledek!
              </p>
            </div>
          ) : (
            weak.map((w) => (
              <div
                key={w.index}
                className="border border-border rounded-lg p-3 bg-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {w.question}
                    </p>
                    {w.correctAnswer && w.correctAnswer !== "—" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Správně: <span className="text-foreground">{w.correctAnswer}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {w.successPct} %
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {w.total} odpovědí
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleShowOnProjector}
            disabled={busy || weak.length === 0}
            className="gap-1.5"
          >
            <Monitor className="w-4 h-4" />
            Zobrazit na projektoru
          </Button>
          <Button
            onClick={handleReplayWeak}
            disabled={busy || weak.length === 0}
            className="gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Zopakovat slabé otázky
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AdaptiveReviewProjectorProps {
  slides: AnySlide[];
  responses: AnyResponse[];
  weakIndices?: number[];
}

export function AdaptiveReviewProjector({
  slides,
  responses,
  weakIndices,
}: AdaptiveReviewProjectorProps) {
  const items = useMemo(() => {
    if (Array.isArray(weakIndices) && weakIndices.length > 0) {
      // Recompute pct for the chosen indices
      return weakIndices
        .map((idx) => {
          const slide = slides[idx];
          if (!slide) return null;
          const rel = responses.filter((r) => r.question_index === idx);
          const scored = rel.filter((r) => typeof r.score === "number");
          let pct = 0;
          if (scored.length > 0) {
            pct = Math.round(
              scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length
            );
          } else if (rel.length > 0) {
            pct = Math.round(
              (rel.filter((r) => r.is_correct === true).length / rel.length) * 100
            );
          }
          return {
            index: idx,
            slide,
            total: rel.length,
            successPct: pct,
            question: slide?.projector?.headline || `Otázka ${idx + 1}`,
            correctAnswer: extractCorrectAnswer(slide),
          } as WeakSlide;
        })
        .filter((x): x is WeakSlide => !!x)
        .sort((a, b) => a.successPct - b.successPct);
    }
    return computeWeakSlides(slides, responses);
  }, [slides, responses, weakIndices]);

  return (
    <div
      className="min-h-screen flex flex-col text-white px-12 py-10"
      style={{
        background:
          "var(--game-bg, linear-gradient(135deg, #1a1a2e, #16213e, #0f3460))",
      }}
    >
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 bg-white/10 rounded-full px-5 py-2 mb-5">
          <Brain className="w-6 h-6" />
          <span className="text-lg uppercase tracking-wider">Adaptivní závěr</span>
        </div>
        <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
          Co nám ještě nejde
        </h1>
        <p className="text-2xl text-gray-300 mt-4">
          Otázky s úspěšností pod {WEAK_THRESHOLD} %
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-3xl text-gray-300">
            🎉 Žádná slabá místa – třída zvládá všechno.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl w-full mx-auto">
          {items.map((w) => (
            <div
              key={w.index}
              className="bg-white/5 border border-white/15 rounded-2xl p-6 backdrop-blur"
              style={{ borderColor: "var(--game-accent, rgba(255,255,255,0.15))" }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="text-sm uppercase tracking-wide text-gray-400">
                  Otázka {w.index + 1}
                </span>
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-200 text-sm font-bold">
                  {w.successPct} %
                </span>
              </div>
              <h3 className="text-2xl font-bold leading-snug mb-3">{w.question}</h3>
              {w.correctAnswer && w.correctAnswer !== "—" && (
                <p className="text-lg text-gray-200">
                  <span className="text-gray-400">Správně: </span>
                  <span className="font-semibold">{w.correctAnswer}</span>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {w.total} odpovědí třídy
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
