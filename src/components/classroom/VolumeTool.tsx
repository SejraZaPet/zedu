import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function VolumeTool() {
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [level, setLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(3);
  const [threshold, setThreshold] = useState(60);
  const [error, setError] = useState("");
  const gain = useRef(sensitivity); gain.current = sensitivity;
  const resource = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    const r = resource.current;
    if (r) { cancelAnimationFrame(r.frame); r.stream.getTracks().forEach(t => t.stop()); void r.context.close(); resource.current = null; }
    setRunning(false); setPending(false); setLevel(0);
  };
  useEffect(() => () => { generation.current++; const r = resource.current; if (r) { cancelAnimationFrame(r.frame); r.stream.getTracks().forEach(t => t.stop()); void r.context.close(); } }, []);
  const start = async () => {
    const ticket = ++generation.current;
    setPending(true); setError("");
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (ticket !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
      context = new AudioContext(); await context.resume();
      if (ticket !== generation.current) { stream.getTracks().forEach(t => t.stop()); void context.close(); return; }
      const analyser = context.createAnalyser(); analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      // No destination, recorder, network request, or persistent audio buffer.
      const samples = new Float32Array(analyser.fftSize);
      const r = { stream, context, frame: 0 }; resource.current = r;
      let last = 0;
      const tick = (now: number) => {
        if (now - last > 80) {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
          setLevel(Math.min(100, Math.round(rms * gain.current * 400))); last = now;
        }
        r.frame = requestAnimationFrame(tick);
      };
      r.frame = requestAnimationFrame(tick); setRunning(true);
    } catch {
      stream?.getTracks().forEach(t => t.stop()); void context?.close();
      if (ticket === generation.current) setError("Mikrofon se nepodařilo zapnout. Povolte jej v prohlížeči a zkuste to znovu.");
    } finally { if (ticket === generation.current) setPending(false); }
  };
  const state = level >= threshold ? "loud" : level >= threshold * 0.65 ? "warning" : "quiet";
  return <div className="classroom-tool-body">
    <p className="text-center mx-auto max-w-2xl">Bezli žádá o mikrofon pro měření hlasitosti ve třídě; zvuk zpracovává pouze ve Vašem prohlížeči, nikam jej neposílá ani neukládá.</p>
    <div className={`classroom-volume classroom-volume-${state}`}><strong>{running ? `${level} %` : "—"}</strong><span>{!running ? "Mikrofon vypnutý" : state === "loud" ? "Příliš hlasito" : state === "warning" ? "Ztišit" : "Klid"}</span></div>
    <progress className={`classroom-progress classroom-volume-${state}`} value={level} max={100} aria-label="Úroveň hlasitosti" />
    <div className="mx-auto w-full max-w-lg space-y-6"><label className="block space-y-4"><span>Citlivost · {sensitivity}</span><Slider aria-label="Citlivost" min={1} max={10} step={1} value={[sensitivity]} onValueChange={v => setSensitivity(v[0])} /></label><label className="block space-y-4"><span>Práh hlasitosti · {threshold} %</span><Slider aria-label="Práh hlasitosti" min={10} max={100} step={5} value={[threshold]} onValueChange={v => setThreshold(v[0])} /></label></div>
    <Button className="self-center" size="lg" disabled={pending} onClick={() => running ? stop() : void start()}>{running ? <MicOff /> : <Mic />}{pending ? "Zapínání…" : running ? "Vypnout mikrofon" : "Zapnout mikrofon"}</Button>
    <p role="alert" className="text-center text-destructive">{error}</p>
  </div>;
}
