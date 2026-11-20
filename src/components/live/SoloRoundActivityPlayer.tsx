import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import MatchingActivity from "@/components/activities/MatchingActivity";
import OrderingActivity from "@/components/activities/OrderingActivity";
import FillBlanksActivity from "@/components/activities/FillBlanksActivity";
import FillChoiceActivity from "@/components/activities/FillChoiceActivity";
import SortingActivity from "@/components/activities/SortingActivity";
import ImageLabelActivity from "@/components/activities/ImageLabelActivity";
import ImageHotspotActivity from "@/components/activities/ImageHotspotActivity";
import FlashcardsActivity from "@/components/activities/FlashcardsActivity";
import MemoryGameActivity from "@/components/activities/MemoryGameActivity";
import CrosswordActivity from "@/components/activities/CrosswordActivity";
import RevealCardsActivity from "@/components/activities/RevealCardsActivity";
import ActivityTaskPreview from "@/components/live/ActivityTaskPreview";
import { resolveTimeLimitSec } from "@/lib/live-timing";
import { serverTsToClientMs } from "@/lib/clock-sync";
import type { GameResponse } from "@/lib/game-types";

interface Props {
  spec: any;
  session: any;
  sessionId: string;
  joinToken: string;
  playerId: string;
  questionIndex: number;
  response?: GameResponse;
}

/** Telefonní hráč jednoho kola. Skóre se zde pouze zobrazuje, nikdy se nepočítá. */
export default function SoloRoundActivityPlayer({ spec, session, sessionId, joinToken, playerId, questionIndex, response }: Props) {
  const latest = useRef<any>({});
  const submitRef = useRef<() => void>(() => {});
  const raceLocalStart = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localResult, setLocalResult] = useState<any>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submitted = !!response || !!localResult;
  const finished = session?.status === "question_results";
  const isRace = session?.settings?.gameMode === "race";
  const onStateChange = useCallback((state: any) => { latest.current = state ?? {}; }, []);

  const submit = useCallback(async () => {
    if (submitted || busy || !joinToken || !playerId) return;
    setBusy(true);
    setError("");
    try {
      const startedAt = session?.question_started_at ? serverTsToClientMs(session.question_started_at) : raceLocalStart.current;
      const { data, error: invokeError } = await supabase.functions.invoke("submit-activity-response", {
        body: {
          joinToken,
          playerId,
          sessionId,
          questionIndex,
          responseTimeMs: Math.max(0, Date.now() - startedAt),
          // Server tato pole záměrně ignoruje; posíláme jen volby žáka.
          answerData: latest.current ?? {},
        },
      });
      if (invokeError || data?.error) throw new Error(data?.error || invokeError?.message || "Odpověď se nepodařilo odeslat.");
      setLocalResult(data);
    } catch (e: any) {
      setError(e?.message || "Odpověď se nepodařilo odeslat. Zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  }, [submitted, busy, joinToken, playerId, sessionId, questionIndex, session?.question_started_at]);
  submitRef.current = () => { void submit(); };

  // Odpočet kola; v Závodu běží od otevření kola na tomto telefonu.
  useEffect(() => {
    if (submitted || finished) { setRemaining(null); return; }
    const limit = resolveTimeLimitSec({ activitySpec: spec }, session?.settings, "live");
    if (limit === null) { setRemaining(null); return; }
    const started = isRace ? raceLocalStart.current : session?.question_started_at ? serverTsToClientMs(session.question_started_at) : Date.now();
    const tick = () => {
      const left = Math.max(0, Math.ceil((started + limit * 1000 - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) submitRef.current();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [spec, session?.settings, session?.question_started_at, isRace, submitted, finished]);

  // Předčasné ukončení učitelem: rozpracovaný stav se ještě jednou odešle.
  useEffect(() => {
    if (finished && !submitted && !busy) submitRef.current();
  }, [finished, submitted, busy]);

  const result = response ?? localResult;
  const correctCount = result?.answer?.correctCount ?? result?.correctCount;
  const totalCount = result?.answer?.totalCount ?? result?.totalCount;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-5" aria-label="Samostatné kolo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-heading text-lg font-semibold">{spec?.question || "Samostatné kolo"}</p>
          <p className="text-xs text-muted-foreground">Jedna aktivita = jedna odpověď. Rychlost neboduje.</p>
        </div>
        {remaining !== null && !submitted && !finished && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-mono text-sm font-semibold" aria-label={`Zbývá ${remaining} sekund`}>
            <Timer className="h-4 w-4" /> {remaining} s
          </span>
        )}
      </div>

      {submitted && !finished ? (
        <div className="rounded-lg bg-primary/10 p-6 text-center" role="status">
          <p className="text-lg font-semibold">Čekejte na ostatní</p>
          <p className="text-sm text-muted-foreground">Vaši práci jsme uložili. Výsledek uvidíte po skončení kola.</p>
        </div>
      ) : submitted && finished ? (
        <div className="space-y-4" role="status">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-2xl font-bold">{Number(correctCount) || 0} / {Number(totalCount) || 0} správně</p>
            <p className="text-sm text-muted-foreground">Připsáno {Number(result?.score) || 0} bodů</p>
          </div>
          {spec?.showSolution !== false && (
            <div className="space-y-2">
              <h2 className="font-heading text-base font-semibold">Správné řešení</h2>
              <ActivityTaskPreview spec={spec} showSolution />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={busy || finished ? "pointer-events-none opacity-70" : ""} aria-disabled={busy || finished}>
            <SoloActivity spec={spec} onStateChange={onStateChange} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="button" className="min-h-12 w-full gap-2 text-base" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {busy ? "Odesílání…" : "Odeslat a čekat"}
          </Button>
          {isRace && <p className="text-xs text-muted-foreground">V Závodu postupujete vlastním tempem. Toto kolo je jedna pozice na dráze.</p>}
        </>
      )}
    </section>
  );
}

function SoloActivity({ spec, onStateChange }: { spec: any; onStateChange: (state: any) => void }) {
  const common = { deferFeedback: true, onStateChange };
  switch (String(spec?.activityType ?? "")) {
    case "matching": return <MatchingActivity matching={spec.matching ?? { left: [], right: [] }} {...common} />;
    case "ordering": return <OrderingActivity ordering={spec.ordering ?? { items: [] }} {...common} />;
    case "fill_blanks": return <FillBlanksActivity text={spec.fillBlanks?.text ?? ""} tokens={spec.fillBlanks?.tokens} caseSensitive={spec.fillBlanks?.caseSensitive} diacriticSensitive={spec.fillBlanks?.diacriticSensitive} showWordBank={spec.fillBlanks?.showWordBank} distractors={spec.fillBlanks?.distractors} {...common} />;
    case "fill_choice": return <FillChoiceActivity tokens={spec.fillChoice?.tokens ?? []} options={spec.fillChoice?.options ?? []} {...common} />;
    case "sorting": return <SortingActivity sorting={spec.sorting ?? { groups: [], items: [] }} {...common} />;
    case "image_label": return <ImageLabelActivity imageUrl={spec.imageLabel?.imageUrl ?? ""} markers={spec.imageLabel?.markers ?? []} tolerance={spec.imageLabel?.tolerance} shuffleWords={spec.imageLabel?.shuffleWords} {...common} />;
    case "image_hotspot": return <ImageHotspotActivity imageUrl={spec.imageHotspot?.imageUrl ?? ""} hotspots={spec.imageHotspot?.hotspots ?? []} {...common} />;
    case "flashcards": return <FlashcardsActivity cards={spec.flashcards ?? []} onStateChange={onStateChange} />;
    case "memory_game": return <MemoryGameActivity pairs={spec.memoryGame?.pairs ?? []} {...common} />;
    case "crossword": return <CrosswordActivity entries={spec.crossword?.entries ?? []} {...common} />;
    case "reveal_cards": return <RevealCardsActivity cards={spec.revealCards?.cards ?? []} onStateChange={onStateChange} />;
    default: return <p className="text-sm text-destructive">Tento typ aktivity zatím nejde spustit.</p>;
  }
}
