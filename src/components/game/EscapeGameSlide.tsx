import { useMemo, useState } from "react";
import { KeyRound, Lock, Unlock, PartyPopper } from "lucide-react";
import Confetti from "@/components/game/Confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EscapeLock {
  clue: string;
  code: string;
}

export interface EscapeActivitySpec {
  activityType: "escape";
  intro?: string;
  locks: EscapeLock[];
  finalMessage?: string;
}

function normalizeCode(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Student view — entirely local. Progress does NOT persist to DB (per spec).
 */
export function EscapeGameStudent({ slide }: { slide: any }) {
  const spec: EscapeActivitySpec = (slide?.activitySpec || {}) as EscapeActivitySpec;
  const locks = Array.isArray(spec.locks) ? spec.locks : [];
  // Keyed by slide id so switching slide resets local state cleanly
  const slideId = slide?.slideId || "escape";

  const [attempt, setAttempt] = useState("");
  const [step, setStep] = useState(0);
  const [wrongPulse, setWrongPulse] = useState(false);
  const [unlockPulse, setUnlockPulse] = useState(false);
  const [done, setDone] = useState(false);

  const total = locks.length;
  const currentLock = locks[step];

  // Reset when slide changes
  useMemo(() => {
    setStep(0);
    setAttempt("");
    setDone(false);
    setWrongPulse(false);
    setUnlockPulse(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  const tryUnlock = () => {
    if (!currentLock || done) return;
    if (normalizeCode(attempt) && normalizeCode(attempt) === normalizeCode(currentLock.code)) {
      setUnlockPulse(true);
      setTimeout(() => {
        setUnlockPulse(false);
        setAttempt("");
        if (step + 1 >= total) {
          setDone(true);
        } else {
          setStep((s) => s + 1);
        }
      }, 700);
    } else {
      setWrongPulse(true);
      setTimeout(() => setWrongPulse(false), 500);
    }
  };

  if (total === 0) {
    return (
      <div className="mx-3 sm:mx-4 mt-3 p-4 rounded-xl bg-white/10 border border-white/15 text-white text-sm">
        Úniková hra nemá zadané žádné zámky.
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-4 mt-3 sm:mt-4 space-y-3">
      {spec.intro && (
        <div className="p-3 rounded-xl bg-white/10 border border-white/15 text-white/90 text-sm whitespace-pre-wrap">
          {spec.intro}
        </div>
      )}

      {!done && currentLock && (
        <div
          className={cn(
            "relative p-4 rounded-2xl border transition-all",
            "bg-gradient-to-br from-slate-800/70 to-slate-900/70 border-white/15 text-white",
            wrongPulse && "animate-shake border-red-400/60",
            unlockPulse && "border-emerald-400/70"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
              <Lock className="w-3.5 h-3.5" />
              Zámek {step + 1} / {total}
            </div>
            <div className="flex gap-1">
              {locks.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    i < step ? "bg-emerald-400" : i === step ? "bg-amber-400" : "bg-white/20"
                  )}
                />
              ))}
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-center py-3 transition-transform",
              unlockPulse && "scale-110"
            )}
          >
            {unlockPulse ? (
              <Unlock className="w-14 h-14 text-emerald-400" strokeWidth={1.5} />
            ) : (
              <Lock className="w-14 h-14 text-amber-400" strokeWidth={1.5} />
            )}
          </div>

          <div className="p-3 rounded-lg bg-black/20 border border-white/10 text-sm whitespace-pre-wrap">
            {currentLock.clue}
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") tryUnlock();
              }}
              placeholder="Zadej kód…"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              disabled={unlockPulse}
            />
            <Button
              onClick={tryUnlock}
              disabled={!attempt.trim() || unlockPulse}
              className="gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              Odemknout
            </Button>
          </div>

          {wrongPulse && (
            <p className="mt-2 text-xs text-red-300">Špatný kód, zkus to znovu.</p>
          )}
        </div>
      )}

      {done && (
        <div className="relative overflow-hidden p-5 rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-purple-500/20 text-white text-center">
          <Confetti count={80} />
          <PartyPopper className="w-14 h-14 mx-auto text-amber-300 mb-2" />
          <p className="text-lg font-bold mb-1">Všechny zámky odemčené!</p>
          {spec.finalMessage ? (
            <p className="text-sm text-white/90 whitespace-pre-wrap">{spec.finalMessage}</p>
          ) : (
            <p className="text-sm text-white/80">Skvělá práce.</p>
          )}
        </div>
      )}

      <style>{`
        @keyframes escape-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: escape-shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

/**
 * Teacher / projector overview. Progress is local per student, so we just show
 * a summary: number of locks and (if available) the intro.
 */
export function EscapeGameOverview({ slide }: { slide: any }) {
  const spec: EscapeActivitySpec = (slide?.activitySpec || {}) as EscapeActivitySpec;
  const locks = Array.isArray(spec.locks) ? spec.locks : [];
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary" />
        <p className="text-sm font-medium">Žáci luští únikovou hru</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Postup každého žáka běží lokálně na jejich zařízení a není skórován.
      </p>
      <div className="flex items-center gap-3 text-xs">
        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
          {locks.length} {locks.length === 1 ? "zámek" : locks.length >= 2 && locks.length <= 4 ? "zámky" : "zámků"}
        </span>
        {spec.finalMessage && (
          <span className="text-muted-foreground">Vyplněný závěrečný vzkaz</span>
        )}
      </div>
      {spec.intro && (
        <div className="p-3 rounded-md bg-background border border-border text-sm whitespace-pre-wrap">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Scénář</p>
          {spec.intro}
        </div>
      )}
    </div>
  );
}

export function EscapeGameProjector({ slide }: { slide: any }) {
  const spec: EscapeActivitySpec = (slide?.activitySpec || {}) as EscapeActivitySpec;
  const locks = Array.isArray(spec.locks) ? spec.locks : [];
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}
    >
      <div className="max-w-3xl text-center text-white space-y-6">
        <KeyRound className="w-24 h-24 mx-auto text-amber-300" strokeWidth={1.2} />
        <h1 className="text-5xl font-bold">Úniková hra</h1>
        {spec.intro && (
          <p className="text-xl text-white/85 whitespace-pre-wrap">{spec.intro}</p>
        )}
        <p className="text-lg text-white/70">
          {locks.length} {locks.length === 1 ? "zámek" : locks.length >= 2 && locks.length <= 4 ? "zámky" : "zámků"} k odemčení
        </p>
        <p className="text-sm text-white/50">Žáci luští na svých zařízeních.</p>
      </div>
    </div>
  );
}
