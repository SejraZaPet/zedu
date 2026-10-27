import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  advance, formatMs, pause, POMODORO_IDLE, POMODORO_PRESETS, remainingMs, resume, startWork,
  type PomodoroMode, type PomodoroState,
} from "@/lib/practice-method";

const KEY = "bezli.pomodoro.timer";
const LABEL: Record<PomodoroMode, string> = {
  idle: "Připraveno", work: "Práce", break: "Krátká pauza", long_break: "Dlouhá pauza",
};

function load(): { state: PomodoroState; preset: string } {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (v?.state && POMODORO_PRESETS[v.preset]) return v;
  } catch { /* ignore */ }
  return { state: POMODORO_IDLE, preset: "25/5" };
}

/** Skutečný časovač Pomodoro. Nic neukládá do databáze – jen do relace prohlížeče. */
export default function PomodoroTimer({ onWorkFinished }: { onWorkFinished?: () => void }) {
  const [{ state, preset }, setAll] = useState(load);
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const p = POMODORO_PRESETS[preset];

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ state, preset })); } catch { /* ignore */ }
  }, [state, preset]);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setAll((cur) => {
        const r = advance(cur.state, t, POMODORO_PRESETS[cur.preset]);
        if (!r.finished) return cur;
        const msg = r.finished === "work" ? "Blok skončil – dej si pauzu a odpověz na otázky." : "Pauza skončila. Můžeš spustit další blok.";
        setNotice(msg);
        if (r.finished === "work") onWorkFinished?.();
        if (sound && audio.current) {
          const o = audio.current.createOscillator(); const g = audio.current.createGain();
          o.frequency.value = 880; g.gain.value = 0.1; o.connect(g); g.connect(audio.current.destination);
          o.start(); o.stop(audio.current.currentTime + 0.3);
        }
        return { ...cur, state: r.state };
      });
    };
    const id = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [sound, onWorkFinished]);

  const set = (s: PomodoroState) => setAll((c) => ({ ...c, state: s }));
  const rem = state.mode === "idle" ? p.work * 60_000 : remainingMs(state, now);
  const paused = state.pausedMs !== null;

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Délka bloku">
        {Object.keys(POMODORO_PRESETS).map((k) => (
          <Button key={k} type="button" size="sm" variant={k === preset ? "default" : "outline"}
            className="min-h-11" disabled={state.mode !== "idle"} aria-pressed={k === preset}
            onClick={() => setAll((c) => ({ ...c, preset: k }))}>
            {k} min
          </Button>
        ))}
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{LABEL[state.mode]}{paused ? " · pozastaveno" : ""}</p>
        <p className="font-heading text-5xl font-bold tabular-nums" aria-live="off">{formatMs(rem)}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Hotové bloky: {state.cycles}. Po 4 blocích přijde delší pauza ({p.long} min).
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {state.mode === "idle" && (
          <Button type="button" className="min-h-11 gap-2" onClick={() => { setNotice(""); set(startWork(state, Date.now(), p)); }}>
            <Play className="w-4 h-4" /> Spustit blok ({p.work} min)
          </Button>
        )}
        {state.mode !== "idle" && (
          <Button type="button" variant="outline" className="min-h-11 gap-2"
            onClick={() => set(paused ? resume(state, Date.now()) : pause(state, Date.now()))}>
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {paused ? "Pokračovat" : "Pozastavit"}
          </Button>
        )}
        <Button type="button" variant="ghost" className="min-h-11 gap-2" onClick={() => { setNotice(""); set(POMODORO_IDLE); }}>
          <RotateCcw className="w-4 h-4" /> Vynulovat
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 gap-2" aria-pressed={sound}
          onClick={() => {
            if (!sound) { try { audio.current ??= new AudioContext(); } catch { /* bez zvuku */ } }
            setSound((v) => !v);
          }}>
          {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} {sound ? "Zvuk zapnutý" : "Bez zvuku"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm font-medium text-center text-primary min-h-5">{notice}</p>
    </div>
  );
}
