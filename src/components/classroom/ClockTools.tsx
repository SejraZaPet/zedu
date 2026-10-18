import { useEffect, useRef, useState } from "react";
import { Flag, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useClassroomClock } from "@/hooks/useClassroomClock";
import { formatClassroomTime } from "@/lib/classroom-tools";

function ClockButtons({ running, toggle, reset }: { running: boolean; toggle: () => void; reset: () => void }) {
  return <div className="flex flex-wrap justify-center gap-3"><Button size="lg" onClick={toggle}>{running ? <Pause /> : <Play />}{running ? "Pozastavit" : "Spustit"}</Button><Button size="lg" variant="outline" onClick={reset}><RotateCcw />Resetovat</Button></div>;
}

export function CountdownTool({ initialDuration = 300000, autoStart = false }: { initialDuration?: number; autoStart?: boolean }) {
  const [duration, setDuration] = useState(initialDuration);
  const [minutes, setMinutes] = useState(String(Math.floor(initialDuration / 60000)));
  const [seconds, setSeconds] = useState(String(initialDuration / 1000 % 60));
  const [sound, setSound] = useState(true);
  const [finished, setFinished] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!autoStart) return;
    try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => {}); } catch { /* Visual timer works without audio permission. */ }
  }, [autoStart]);
  useEffect(() => () => { void audio.current?.close(); }, []);
  const clock = useClassroomClock(duration, () => {
    setFinished(true);
    const ctx = audio.current;
    if (!sound || !ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.8);
  }, autoStart);
  const reset = () => { clock.reset(); setFinished(false); };
  const selectTime = (ms: number) => { reset(); setDuration(ms); setMinutes(String(Math.floor(ms / 60000))); setSeconds(String(ms / 1000 % 60)); };
  const valid = Number.isInteger(Number(minutes)) && Number.isInteger(Number(seconds)) && Number(minutes) >= 0 && Number(seconds) >= 0 && Number(seconds) <= 59 && Number(minutes) * 60 + Number(seconds) > 0 && Number(minutes) <= 999;
  return <div className="classroom-tool-body">
    <div className="flex flex-wrap justify-center gap-2">{[1, 2, 3, 5, 10, 15].map(n => <Button key={n} variant={duration === n * 60000 ? "default" : "outline"} onClick={() => selectTime(n * 60000)}>{n} min</Button>)}</div>
    <div className="flex flex-wrap items-end justify-center gap-3">
      <label>Minuty<Input className="w-24" type="number" min={0} max={999} value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
      <label>Sekundy<Input className="w-24" type="number" min={0} max={59} value={seconds} onChange={e => setSeconds(e.target.value)} /></label>
      <Button variant="outline" disabled={!valid} onClick={() => selectTime((Math.floor(Number(minutes)) * 60 + Math.floor(Number(seconds))) * 1000)}>Nastavit čas</Button>
    </div>
    <div className="classroom-time" role="timer" aria-label="Zbývající čas">{formatClassroomTime(duration - clock.elapsed)}</div>
    <progress className={`classroom-progress classroom-volume-${clock.elapsed >= duration * 0.8 ? "loud" : clock.elapsed >= duration * 0.5 ? "warning" : "quiet"}`} max={duration} value={Math.max(0, duration - clock.elapsed)} aria-label="Zbývající čas" />
    <p className="h-8 text-center text-xl font-semibold" role="status">{finished ? "Čas vypršel" : ""}</p>
    <ClockButtons running={clock.running} reset={reset} toggle={() => {
      setFinished(false);
      if (sound && !clock.running) { try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => {}); } catch { /* Visual completion always remains available. */ } }
      clock.toggle();
    }} />
    <label className="flex items-center justify-center gap-3"><Switch checked={sound} onCheckedChange={setSound} />Zvuk po skončení</label>
  </div>;
}

export function StopwatchTool() {
  const clock = useClassroomClock(null);
  const [laps, setLaps] = useState<number[]>([]);
  return <div className="classroom-tool-body">
    <div className="classroom-time" role="timer" aria-label="Čas stopek">{formatClassroomTime(clock.elapsed, true)}</div>
    <ClockButtons running={clock.running} toggle={clock.toggle} reset={() => { clock.reset(); setLaps([]); }} />
    <Button className="self-center" size="lg" variant="outline" disabled={!clock.running} onClick={() => setLaps(v => [...v, clock.read()])}><Flag />Mezičas</Button>
    <ol className="classroom-laps">{laps.map((lap, i) => <li key={i} className="flex justify-between gap-4 border-b border-border py-3"><span>{i + 1}.</span><span>{formatClassroomTime(lap, true)}</span><span className="text-muted-foreground">+{formatClassroomTime(lap - (laps[i - 1] ?? 0), true)}</span></li>)}</ol>
  </div>;
}